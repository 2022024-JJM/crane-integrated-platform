// monitoring_web/src/pointcloudParser.js 의 TypeScript 포팅.
// PointCloud2 raw bytes → Float32Array(positions) + intensity + bounds.
//
// 입력 frame 의 fields/point_step/row_step/is_bigendian 메타데이터를 그대로
// 따라가며 점 단위로 좌표를 읽는다. 점이 60K 를 넘으면 step 다운샘플링.
//
// 매 프레임 새 Float32Array 를 할당하지 않고, 호출자가 제공한 pool buffer 를
// in-place 로 기록한 뒤 actual count 만 반환한다. (A1 — GC churn 회피)

import { MAX_POINTS_PER_SENSOR } from './config';
import type { PointCloudField, PointCloudFrame } from './proto-decoder';

type FieldReader = (view: DataView, baseOffset: number) => number;

/**
 * field.datatype + endian + offset 을 한 번에 묶어 매 점마다 객체 lookup /
 * 함수 분기를 없앤다. (A4 — hot loop 의 polymorphic call 제거)
 */
function bindFieldReader(
  field: PointCloudField,
  littleEndian: boolean,
): FieldReader {
  const offset = field.offset;
  switch (field.datatype) {
    case 1:
      return (v, b) => v.getInt8(b + offset);
    case 2:
      return (v, b) => v.getUint8(b + offset);
    case 3:
      return (v, b) => v.getInt16(b + offset, littleEndian);
    case 4:
      return (v, b) => v.getUint16(b + offset, littleEndian);
    case 5:
      return (v, b) => v.getInt32(b + offset, littleEndian);
    case 6:
      return (v, b) => v.getUint32(b + offset, littleEndian);
    case 7:
      // 가장 흔한 경로 (SOSLAB/OUSTER 등 LiDAR vendor 의 x/y/z 기본 표현).
      return (v, b) => v.getFloat32(b + offset, littleEndian);
    case 8:
      return (v, b) => v.getFloat64(b + offset, littleEndian);
    default:
      throw new Error(
        `Unsupported datatype ${field.datatype} for field "${field.name}"`,
      );
  }
}

function findField(
  fields: PointCloudField[],
  name: string,
): PointCloudField | undefined {
  // ROS 표준은 'x'/'y'/'z' (소문자) 만 정의하므로 정확 매칭 우선.
  const exact = fields.find((field) => field.name === name);
  if (exact) return exact;
  // 일부 vendor 가 'X' 등 대문자로 보내는 경우 fallback.
  return fields.find((field) => field.name?.toLowerCase() === name);
}

export interface ParsedFrameOk {
  ok: true;
  hasIntensity: boolean;
  pointCount: number;
  sampledPointCount: number;
  skippedPointCount: number;
  /** pool buffer 의 처음 sampledPointCount*3 개 원소만 유효 */
  positions: Float32Array;
  /** pool buffer 의 처음 sampledPointCount 개 원소만 유효, intensity 없으면 null */
  intensities: Float32Array | null;
  bounds: { min: [number, number, number]; max: [number, number, number] } | null;
}

export interface ParsedFrameError {
  ok: false;
  error: string;
}

export type ParsedFrame = ParsedFrameOk | ParsedFrameError;

export interface ParseFrameBuffers {
  /** 길이 ≥ MAX_POINTS_PER_SENSOR*3. 매번 같은 인스턴스를 전달해 재사용. */
  positions: Float32Array;
  /** 길이 ≥ MAX_POINTS_PER_SENSOR */
  intensities: Float32Array;
}

export function createParseFrameBuffers(
  maxPoints: number = MAX_POINTS_PER_SENSOR,
): ParseFrameBuffers {
  return {
    positions: new Float32Array(maxPoints * 3),
    intensities: new Float32Array(maxPoints),
  };
}

export function parseFrame(
  frame: PointCloudFrame,
  buffers: ParseFrameBuffers,
  options: { maxPoints?: number } = {},
): ParsedFrame {
  const maxPoints = options.maxPoints ?? MAX_POINTS_PER_SENSOR;
  const width = Number(frame.width ?? 0);
  const height = Math.max(Number(frame.height ?? 1), 1);
  const pointStep = Number(frame.point_step ?? 0);
  const pointCount = width * height;

  if (!pointCount) {
    return {
      ok: true,
      hasIntensity: false,
      pointCount: 0,
      sampledPointCount: 0,
      skippedPointCount: 0,
      positions: buffers.positions,
      intensities: null,
      bounds: null,
    };
  }

  if (!pointStep) {
    return { ok: false, error: 'point_step is 0.' };
  }

  const fields = Array.isArray(frame.fields) ? frame.fields : [];
  const xField = findField(fields, 'x');
  const yField = findField(fields, 'y');
  const zField = findField(fields, 'z');
  const intensityField = findField(fields, 'intensity');

  if (!xField || !yField || !zField) {
    return { ok: false, error: 'Missing one of x, y, z fields.' };
  }

  const rowStep = Number(frame.row_step ?? width * pointStep);
  const expectedRowStep = width * pointStep;

  if (rowStep < expectedRowStep) {
    return { ok: false, error: 'row_step is smaller than width * point_step.' };
  }

  const data = frame.data;
  const requiredBytes = rowStep * height;
  if (data.byteLength < requiredBytes) {
    return {
      ok: false,
      error: `Point data is too short. Expected at least ${requiredBytes} bytes, got ${data.byteLength}.`,
    };
  }

  const littleEndian = !frame.is_bigendian;
  const step = Math.max(1, Math.ceil(pointCount / maxPoints));

  // DataView 범위를 requiredBytes 로 명시 제한 — 잘못된 데이터에서 over-read 방지.
  const view = new DataView(data.buffer, data.byteOffset, requiredBytes);

  // pool buffer 가 maxPoints 보다 작으면 안 된다.
  if (
    buffers.positions.length < maxPoints * 3 ||
    buffers.intensities.length < maxPoints
  ) {
    return {
      ok: false,
      error: 'Parse buffers are smaller than maxPoints.',
    };
  }
  const positions = buffers.positions;
  const intensities = buffers.intensities;
  const hasIntensity = Boolean(intensityField);

  // field 별 reader 를 사전 바인딩 → loop 안에서 객체 lookup / 분기 제거.
  const readX = bindFieldReader(xField, littleEndian);
  const readY = bindFieldReader(yField, littleEndian);
  const readZ = bindFieldReader(zField, littleEndian);
  const readI = intensityField
    ? bindFieldReader(intensityField, littleEndian)
    : null;

  let sampledPointCount = 0;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  try {
    for (let flatIndex = 0; flatIndex < pointCount; flatIndex += step) {
      const rowIndex = Math.floor(flatIndex / width);
      const columnIndex = flatIndex - rowIndex * width;
      const baseOffset = rowIndex * rowStep + columnIndex * pointStep;

      const x = readX(view, baseOffset);
      const y = readY(view, baseOffset);
      const z = readZ(view, baseOffset);

      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        continue;
      }

      // intensity NaN 도 점 전체를 skip — x/y/z 와 일관 처리 (C1).
      // 일부 vendor 가 invalid 데이터 표시로 NaN intensity 를 쓰므로,
      // 0 으로 치환하면 어두운 점이 시각 artifact 가 된다.
      let intensity = 0;
      if (readI) {
        intensity = readI(view, baseOffset);
        if (!Number.isFinite(intensity)) continue;
      }

      const writeIndex = sampledPointCount * 3;
      positions[writeIndex] = x;
      positions[writeIndex + 1] = y;
      positions[writeIndex + 2] = z;

      if (readI) {
        intensities[sampledPointCount] = intensity;
      }

      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (z < minZ) minZ = z;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (z > maxZ) maxZ = z;

      sampledPointCount += 1;
    }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to parse point cloud payload.',
    };
  }

  return {
    ok: true,
    hasIntensity,
    pointCount,
    sampledPointCount,
    skippedPointCount: pointCount - sampledPointCount,
    // pool buffer 의 view 반환 — 호출자가 sampledPointCount 만큼만 사용해야 한다.
    positions,
    intensities: hasIntensity ? intensities : null,
    bounds:
      sampledPointCount > 0
        ? {
            min: [minX, minY, minZ],
            max: [maxX, maxY, maxZ],
          }
        : null,
  };
}

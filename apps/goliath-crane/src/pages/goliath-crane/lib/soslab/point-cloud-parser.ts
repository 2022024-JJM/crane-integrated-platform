// monitoring_web/src/pointcloudParser.js 의 TypeScript 포팅.
// PointCloud2 raw bytes → Float32Array(positions) + intensity + bounds.
//
// 입력 frame 의 fields/point_step/row_step/is_bigendian 메타데이터를 그대로
// 따라가며 점 단위로 좌표를 읽는다. 점이 60K 를 넘으면 step 다운샘플링.

import { MAX_POINTS_PER_SENSOR } from './config';
import type { SoslabPointCloudField, SoslabPointCloudFrame } from './proto-decoder';

type Reader = (
  view: DataView,
  offset: number,
  littleEndian: boolean,
) => number;

const DATATYPE_READERS: Record<number, Reader> = {
  1: (view, offset) => view.getInt8(offset),
  2: (view, offset) => view.getUint8(offset),
  3: (view, offset, le) => view.getInt16(offset, le),
  4: (view, offset, le) => view.getUint16(offset, le),
  5: (view, offset, le) => view.getInt32(offset, le),
  6: (view, offset, le) => view.getUint32(offset, le),
  7: (view, offset, le) => view.getFloat32(offset, le),
  8: (view, offset, le) => view.getFloat64(offset, le),
};

function findField(
  fields: SoslabPointCloudField[],
  name: string,
): SoslabPointCloudField | undefined {
  return fields.find((field) => field.name?.toLowerCase() === name);
}

function readFieldValue(
  view: DataView,
  baseOffset: number,
  field: SoslabPointCloudField,
  littleEndian: boolean,
): number {
  const reader = DATATYPE_READERS[field.datatype];
  if (!reader) {
    throw new Error(
      `Unsupported datatype ${field.datatype} for field "${field.name}"`,
    );
  }
  return reader(view, baseOffset + field.offset, littleEndian);
}

export interface ParsedFrameOk {
  ok: true;
  hasIntensity: boolean;
  pointCount: number;
  sampledPointCount: number;
  skippedPointCount: number;
  positions: Float32Array;
  intensities: Float32Array | null;
  bounds: { min: [number, number, number]; max: [number, number, number] } | null;
}

export interface ParsedFrameError {
  ok: false;
  error: string;
}

export type ParsedFrame = ParsedFrameOk | ParsedFrameError;

export function parseFrame(
  frame: SoslabPointCloudFrame,
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
      positions: new Float32Array(0),
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
  const capacity = Math.ceil(pointCount / step);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const positions = new Float32Array(capacity * 3);
  const intensities = intensityField ? new Float32Array(capacity) : null;

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

      const x = readFieldValue(view, baseOffset, xField, littleEndian);
      const y = readFieldValue(view, baseOffset, yField, littleEndian);
      const z = readFieldValue(view, baseOffset, zField, littleEndian);

      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        continue;
      }

      const writeIndex = sampledPointCount * 3;
      positions[writeIndex] = x;
      positions[writeIndex + 1] = y;
      positions[writeIndex + 2] = z;

      if (intensities && intensityField) {
        const intensity = readFieldValue(
          view,
          baseOffset,
          intensityField,
          littleEndian,
        );
        intensities[sampledPointCount] = Number.isFinite(intensity)
          ? intensity
          : 0;
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
    hasIntensity: Boolean(intensityField),
    pointCount,
    sampledPointCount,
    skippedPointCount: pointCount - sampledPointCount,
    positions: positions.slice(0, sampledPointCount * 3),
    intensities: intensities ? intensities.slice(0, sampledPointCount) : null,
    bounds:
      sampledPointCount > 0
        ? {
            min: [minX, minY, minZ],
            max: [maxX, maxY, maxZ],
          }
        : null,
  };
}

// monitoring_web/src/protoDecoder.js 의 TypeScript 포팅.
// 서버는 schema 를 함께 보내지 않고 binary protobuf 만 전송하므로,
// proto field id 와 wire type 을 직접 읽어 메시지를 만든다.
//
// 대응 메시지: edge_node.transport.ProcessedPointCloudBundle
// 참고: monitoring_web/CLIENT.md

import { Reader } from 'protobufjs/minimal';

// .proto schema 가 클라이언트에 동봉되지 않으므로 field tag 가 곧 magic number
// 가 되기 쉽다. 한 곳에 모아 두면 서버 schema 변경 시 추적이 쉽다.
const FIELD_TAG = {
  NAME: 1,
  OFFSET: 2,
  DATATYPE: 3,
  COUNT: 4,
} as const;

const FRAME_TAG = {
  SENSOR_NAME: 1,
  VENDOR: 2,
  SOURCE_TOPIC: 3,
  FRAME_ID: 4,
  TIMESTAMP_SEC: 5,
  TIMESTAMP_NANOSEC: 6,
  WIDTH: 7,
  HEIGHT: 8,
  IS_BIGENDIAN: 9,
  POINT_STEP: 10,
  ROW_STEP: 11,
  IS_DENSE: 12,
  FIELDS: 13,
  DATA: 14,
} as const;

const BUNDLE_TAG = {
  SEQUENCE: 1,
  CREATED_TIMESTAMP_NS: 2,
  WINDOW_CENTER_TIMESTAMP_NS: 3,
  WINDOW_SIZE_MS: 4,
  FRAMES: 5,
  PROCESSOR_NAME: 6,
  STATUS: 7,
} as const;

export interface PointCloudField {
  name: string;
  offset: number;
  datatype: number;
  count: number;
}

export interface PointCloudFrame {
  sensor_name: string;
  vendor: string;
  source_topic: string;
  frame_id: string;
  timestamp_sec: number;
  timestamp_nanosec: number;
  width: number;
  height: number;
  is_bigendian: boolean;
  point_step: number;
  row_step: number;
  is_dense: boolean;
  fields: PointCloudField[];
  data: Uint8Array;
}

export interface PointCloudBundle {
  sequence: bigint;
  created_timestamp_ns: bigint;
  window_center_timestamp_ns: bigint;
  window_size_ms: number;
  frames: PointCloudFrame[];
  processor_name: string;
  status: string;
  /** true 면 서버가 sequence 필드를 보내지 않은 것. gap 계산을 신뢰할 수 없다. */
  sequence_missing: boolean;
}

function decodePointCloudField(
  reader: Reader,
  length: number,
): PointCloudField {
  const end = reader.pos + length;
  const message: PointCloudField = {
    name: '',
    offset: 0,
    datatype: 0,
    count: 0,
  };

  while (reader.pos < end) {
    const tag = reader.uint32();
    switch (tag >>> 3) {
      case FIELD_TAG.NAME:
        message.name = reader.string();
        break;
      case FIELD_TAG.OFFSET:
        message.offset = reader.uint32();
        break;
      case FIELD_TAG.DATATYPE:
        message.datatype = reader.uint32();
        break;
      case FIELD_TAG.COUNT:
        message.count = reader.uint32();
        break;
      default:
        reader.skipType(tag & 7);
    }
  }

  return message;
}

function decodePointCloudFrame(
  reader: Reader,
  length: number,
): PointCloudFrame {
  const end = reader.pos + length;
  const message: PointCloudFrame = {
    sensor_name: '',
    vendor: '',
    source_topic: '',
    frame_id: '',
    timestamp_sec: 0,
    timestamp_nanosec: 0,
    width: 0,
    height: 0,
    is_bigendian: false,
    point_step: 0,
    row_step: 0,
    is_dense: false,
    fields: [],
    data: new Uint8Array(0),
  };

  while (reader.pos < end) {
    const tag = reader.uint32();
    switch (tag >>> 3) {
      case FRAME_TAG.SENSOR_NAME:
        message.sensor_name = reader.string();
        break;
      case FRAME_TAG.VENDOR:
        message.vendor = reader.string();
        break;
      case FRAME_TAG.SOURCE_TOPIC:
        message.source_topic = reader.string();
        break;
      case FRAME_TAG.FRAME_ID:
        message.frame_id = reader.string();
        break;
      case FRAME_TAG.TIMESTAMP_SEC:
        message.timestamp_sec = reader.int32();
        break;
      case FRAME_TAG.TIMESTAMP_NANOSEC:
        message.timestamp_nanosec = reader.uint32();
        break;
      case FRAME_TAG.WIDTH:
        message.width = reader.uint32();
        break;
      case FRAME_TAG.HEIGHT:
        message.height = reader.uint32();
        break;
      case FRAME_TAG.IS_BIGENDIAN:
        message.is_bigendian = reader.bool();
        break;
      case FRAME_TAG.POINT_STEP:
        message.point_step = reader.uint32();
        break;
      case FRAME_TAG.ROW_STEP:
        message.row_step = reader.uint32();
        break;
      case FRAME_TAG.IS_DENSE:
        message.is_dense = reader.bool();
        break;
      case FRAME_TAG.FIELDS:
        message.fields.push(decodePointCloudField(reader, reader.uint32()));
        break;
      case FRAME_TAG.DATA:
        message.data = reader.bytes();
        break;
      default:
        reader.skipType(tag & 7);
    }
  }

  return message;
}

function toBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(Math.trunc(value));
  if (typeof value === 'string') return BigInt(value);
  if (
    value !== null &&
    typeof value === 'object' &&
    'toString' in value &&
    typeof (value as { toString: () => string }).toString === 'function'
  ) {
    try {
      return BigInt((value as { toString: () => string }).toString());
    } catch {
      return 0n;
    }
  }
  return 0n;
}

export function decodeBundle(buffer: ArrayBuffer): PointCloudBundle {
  const reader = Reader.create(new Uint8Array(buffer));
  const end = reader.len;

  // protobufjs 의 uint64/int64 는 longs(string) 옵션이 없으면 Long 객체 또는
  // number 가 반환되므로 toBigInt 로 통일한다. message 객체에 직접 두지 않고
  // 로컬 변수로 받았다가 return 시점에 변환하는 게 타입 안전.
  let sequenceRaw: unknown = null;
  let createdRaw: unknown = null;
  let windowCenterRaw: unknown = null;
  let windowSizeMs = 0;
  const frames: PointCloudFrame[] = [];
  let processorName = 'unknown';
  let status = 'unknown';

  while (reader.pos < end) {
    const tag = reader.uint32();
    switch (tag >>> 3) {
      case BUNDLE_TAG.SEQUENCE:
        sequenceRaw = reader.uint64();
        break;
      case BUNDLE_TAG.CREATED_TIMESTAMP_NS:
        createdRaw = reader.int64();
        break;
      case BUNDLE_TAG.WINDOW_CENTER_TIMESTAMP_NS:
        windowCenterRaw = reader.int64();
        break;
      case BUNDLE_TAG.WINDOW_SIZE_MS:
        windowSizeMs = reader.uint32();
        break;
      case BUNDLE_TAG.FRAMES:
        frames.push(decodePointCloudFrame(reader, reader.uint32()));
        break;
      case BUNDLE_TAG.PROCESSOR_NAME:
        processorName = reader.string();
        break;
      case BUNDLE_TAG.STATUS:
        status = reader.string();
        break;
      default:
        reader.skipType(tag & 7);
    }
  }

  return {
    sequence: toBigInt(sequenceRaw),
    created_timestamp_ns: toBigInt(createdRaw),
    window_center_timestamp_ns: toBigInt(windowCenterRaw),
    window_size_ms: windowSizeMs,
    frames,
    processor_name: processorName || 'unknown',
    status: status || 'unknown',
    sequence_missing: sequenceRaw === null,
  };
}

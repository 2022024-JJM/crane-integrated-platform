// monitoring_web/src/protoDecoder.js 의 TypeScript 포팅.
// 서버는 schema 를 함께 보내지 않고 binary protobuf 만 전송하므로,
// proto field id 와 wire type 을 직접 읽어 메시지를 만든다.
//
// 대응 메시지: edge_node.transport.ProcessedPointCloudBundle
// 참고: monitoring_web/CLIENT.md

import { Reader } from 'protobufjs/minimal';

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
      case 1:
        message.name = reader.string();
        break;
      case 2:
        message.offset = reader.uint32();
        break;
      case 3:
        message.datatype = reader.uint32();
        break;
      case 4:
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
      case 1:
        message.sensor_name = reader.string();
        break;
      case 2:
        message.vendor = reader.string();
        break;
      case 3:
        message.source_topic = reader.string();
        break;
      case 4:
        message.frame_id = reader.string();
        break;
      case 5:
        message.timestamp_sec = reader.int32();
        break;
      case 6:
        message.timestamp_nanosec = reader.uint32();
        break;
      case 7:
        message.width = reader.uint32();
        break;
      case 8:
        message.height = reader.uint32();
        break;
      case 9:
        message.is_bigendian = reader.bool();
        break;
      case 10:
        message.point_step = reader.uint32();
        break;
      case 11:
        message.row_step = reader.uint32();
        break;
      case 12:
        message.is_dense = reader.bool();
        break;
      case 13:
        message.fields.push(decodePointCloudField(reader, reader.uint32()));
        break;
      case 14:
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

  const message = {
    sequence: 0n as unknown as bigint,
    created_timestamp_ns: 0n as unknown as bigint,
    window_center_timestamp_ns: 0n as unknown as bigint,
    window_size_ms: 0,
    frames: [] as PointCloudFrame[],
    processor_name: 'unknown',
    status: 'unknown',
  };

  // protobufjs 의 uint64/int64 는 longs(string) 옵션이 없으면
  // Long 객체 또는 number 가 반환되므로 toBigInt 로 통일한다.
  let sequenceRaw: unknown = 0n;
  let createdRaw: unknown = 0n;
  let windowCenterRaw: unknown = 0n;

  while (reader.pos < end) {
    const tag = reader.uint32();
    switch (tag >>> 3) {
      case 1:
        sequenceRaw = reader.uint64();
        break;
      case 2:
        createdRaw = reader.int64();
        break;
      case 3:
        windowCenterRaw = reader.int64();
        break;
      case 4:
        message.window_size_ms = reader.uint32();
        break;
      case 5:
        message.frames.push(decodePointCloudFrame(reader, reader.uint32()));
        break;
      case 6:
        message.processor_name = reader.string();
        break;
      case 7:
        message.status = reader.string();
        break;
      default:
        reader.skipType(tag & 7);
    }
  }

  return {
    sequence: toBigInt(sequenceRaw),
    created_timestamp_ns: toBigInt(createdRaw),
    window_center_timestamp_ns: toBigInt(windowCenterRaw),
    window_size_ms: message.window_size_ms,
    frames: message.frames,
    processor_name: message.processor_name || 'unknown',
    status: message.status || 'unknown',
  };
}

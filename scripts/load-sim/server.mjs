#!/usr/bin/env node
/**
 * 실시간 수신 부하 테스트용 시뮬레이션 백엔드.
 *
 * 실서버 계약을 흉내 낸다 — 의존성 0(Node 내장 http/crypto 만), 폐쇄망에서도
 * 그대로 돈다.
 *
 *   GET  /api/sites            MonitoringReplaySite[]
 *   GET  /api/tags             MonitoringTagDefinition[]
 *   GET  /api/alarms/runtime   RuntimeAlarmDictionaryItem[]
 *   GET  /api/playback/*       빈 응답([])
 *   GET  /healthz
 *   WS   /ws/cranes-lite/all   RealtimeCraneLiteMessage 스트림
 *
 * 프론트는 수정 없이 붙는다: apps/shell/.env.local 의 dev 프록시를 이 서버로
 * 돌리면 된다(VITE_DEV_PROXY_TARGET_HTTP / _WS = http(s)://127.0.0.1:33500).
 *
 * 사용:
 *   node scripts/load-sim/server.mjs [옵션]
 *     --port 33500            수신 포트
 *     --rate 100000           초당 태그 건수(전 연결 합이 아니라 연결당)
 *     --tags-per-crane 200    크레인당 태그 수(맵핑된 태그 코드는 항상 포함)
 *     --format per-tag|batch  per-tag: 메시지 1건 = 태그 1건(현재 계약)
 *                             batch:   tick 마다 JSON 배열 1프레임
 *     --tick-ms 10            전송 스케줄 간격
 *     --cranes C_171,GC_04    크레인 id 목록(기본: 레지스트리 20대 + 필리 2대)
 *     --alarm-rate 0          초당 알람 메시지 수(alarm.changed). 0 이면 끔
 *     --alarm-clear-ratio 0.5 알람 메시지 중 해제(value 0) 비율. 0 이면 발생만
 *                             쌓여 프론트 활성 목록이 계속 자란다
 *     --alarm-cranes a,b      알람 크레인 id(기본: 크레인 레지스트리 전부).
 *                             프론트는 레지스트리에 없는 크레인의 알람을 버린다
 *     --duration 0            초. 0 이면 무한
 *     --quiet                 초당 통계 출력 끄기
 *
 * 알람은 형식과 무관하게 항상 메시지 1건 = 알람 1건으로 보낸다 — 프론트의
 * RealtimeAlarmSync 는 배열 payload 를 풀지 않는다.
 *
 * 초당 한 줄씩 통계를 찍는다. `backlog` 가 계속 자라면 **서버/소켓** 이 병목이고
 * (브라우저가 못 받아 가는 것도 여기 포함), 0 근처면 프론트 쪽을 봐야 한다.
 */
import http from 'node:http';
import crypto from 'node:crypto';
import { parseArgs } from 'node:util';
import { collectAllSceneTags } from './scene-tags.mjs';
import { readRegistryCraneIds } from './registry-cranes.mjs';

// --------------------------------------------------------------------------
// 설정
// --------------------------------------------------------------------------

const { values: opt } = parseArgs({
  options: {
    port: { type: 'string', default: '33500' },
    rate: { type: 'string', default: '100000' },
    'tags-per-crane': { type: 'string', default: '200' },
    format: { type: 'string', default: 'per-tag' },
    'tick-ms': { type: 'string', default: '10' },
    cranes: { type: 'string' },
    'alarm-rate': { type: 'string', default: '0' },
    'alarm-clear-ratio': { type: 'string', default: '0.5' },
    'alarm-cranes': { type: 'string' },
    duration: { type: 'string', default: '0' },
    quiet: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
});

if (opt.help) {
  console.log(
    'node scripts/load-sim/server.mjs --port 33500 --rate 100000 --tags-per-crane 200 --format per-tag|batch --tick-ms 10 [--cranes a,b] [--alarm-rate n] [--alarm-clear-ratio r] [--alarm-cranes a,b] [--duration s] [--quiet]',
  );
  process.exit(0);
}

const PORT = toInt(opt.port, 33500);
const RATE = toInt(opt.rate, 100_000);
const TAGS_PER_CRANE = toInt(opt['tags-per-crane'], 200);
const FORMAT = opt.format === 'batch' ? 'batch' : 'per-tag';
const TICK_MS = Math.max(1, toInt(opt['tick-ms'], 10));
const DURATION_S = toInt(opt.duration, 0);
const ALARM_RATE = toInt(opt['alarm-rate'], 0);
const ALARM_CLEAR_RATIO = Math.min(
  1,
  Math.max(0, Number.parseFloat(opt['alarm-clear-ratio']) || 0),
);
const QUIET = Boolean(opt.quiet);

/** 소켓 쓰기 버퍼가 이 이상 밀리면 그 tick 은 건너뛴다(메모리 폭주 방지). */
const BACKPRESSURE_BYTES = 16 * 1024 * 1024;
/** backlog 상한을 넘긴 채 이 시간 동안 읽지 않으면 그 연결을 끊는다. */
const STALL_DROP_MS = 10_000;

function toInt(value, fallback) {
  const n = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// --------------------------------------------------------------------------
// 크레인 · 태그 카탈로그
// --------------------------------------------------------------------------

/**
 * 태그 표는 씬 JSON 이 원천이다 — 씬의 tagMappings/valueMapList 에 적힌 키를
 * 그 값 범위로 쏘면 모니터링의 모든 크레인이 움직인다. 거기에 크레인당
 * `--tags-per-crane` 가 될 때까지 filler 태그(tag_0001…)를 더해 부하를 만든다.
 */
const SCENE_TAGS = collectAllSceneTags();
const sceneCranes = [...new Set(SCENE_TAGS.map((t) => t.craneId))];
const CRANES = opt.cranes
  ? opt.cranes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : sceneCranes;

/** 전송 순서 표. 라운드로빈으로 돈다. */
const SCHEDULE = [];
for (const craneId of CRANES) {
  const real = SCENE_TAGS.filter((t) => t.craneId === craneId);
  for (const t of real)
    SCHEDULE.push({ ...t, phase: Math.random() * Math.PI * 2 });
  for (let i = real.length; i < TAGS_PER_CRANE; i += 1) {
    SCHEDULE.push({
      craneId,
      tagCode: `tag_${String(i).padStart(4, '0')}`,
      min: 0,
      max: 2000,
      periodMs: 20_000 + (i % 17) * 1000,
      phase: (i * 0.37) % (Math.PI * 2),
      source: 'filler',
    });
  }
}
const TOTAL_TAGS = SCHEDULE.length;
const TAG_CODES = [...new Set(SCHEDULE.map((t) => t.tagCode))];

/**
 * 장비 동작 프로필 — 태그 코드로 최대 속도·가속도(단위/s, 단위/s²)를 정한다.
 * 실제 크레인은 "정지 → 일정 속도로 목표까지 → 정지" 를 반복하고, 선회는
 * 분당 0.2~0.3 회전, 주행은 분당 20~30 m 수준이다.
 */
const MOTION_PROFILES = [
  { match: /slew/i, vmax: 1.5, accel: 0.25 }, // deg/s
  { match: /gantry/i, vmax: 0.45, accel: 0.08 }, // m/s
  { match: /trolley/i, vmax: 0.9, accel: 0.2 }, // m/s
  { match: /link|luff/i, vmax: 0.4, accel: 0.08 }, // deg/s (러핑)
];
const DEFAULT_PROFILE = { vmax: 0.8, accel: 0.15 };
/** 정지 시간(s) 범위 — 목표에 닿으면 이 안에서 쉬었다가 다음 목표로 간다. */
const DWELL_RANGE = [6, 40];

function profileFor(tagCode) {
  return MOTION_PROFILES.find((p) => p.match.test(tagCode)) ?? DEFAULT_PROFILE;
}

function rand(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

/**
 * 씬 태그는 사다리꼴 속도 프로필로 목표를 향해 움직인다. 호출 간격(라운드로빈
 * 주기)만큼 적분하므로 전송 속도와 무관하게 같은 빠르기로 움직인다.
 */
function stepMotion(entry, tSec) {
  let m = entry.motion;
  if (!m) {
    const p = profileFor(entry.tagCode);
    m = entry.motion = {
      pos: rand(entry.min, entry.max),
      target: 0,
      vel: 0,
      vmax: p.vmax,
      accel: p.accel,
      lastT: tSec,
      dwellUntil: tSec + rand(0, DWELL_RANGE[1]),
      moving: false,
    };
  }
  const dt = Math.min(Math.max(tSec - m.lastT, 0), 1);
  m.lastT = tSec;
  if (!m.moving) {
    if (tSec < m.dwellUntil) return m.pos;
    m.target = rand(entry.min, entry.max);
    m.moving = true;
  }
  const dist = m.target - m.pos;
  const dir = Math.sign(dist) || 1;
  // 남은 거리에서 멈출 수 있는 속도 상한(감속 구간).
  const stopV = Math.sqrt(2 * m.accel * Math.abs(dist));
  const want = dir * Math.min(m.vmax, stopV);
  const dv = Math.max(-m.accel * dt, Math.min(m.accel * dt, want - m.vel));
  m.vel += dv;
  const step = m.vel * dt;
  if (Math.abs(step) >= Math.abs(dist) || Math.abs(dist) < 1e-3) {
    m.pos = m.target;
    m.vel = 0;
    m.moving = false;
    m.dwellUntil = tSec + rand(DWELL_RANGE[0], DWELL_RANGE[1]);
  } else {
    m.pos += step;
  }
  return m.pos;
}

/** 씬 태그는 동작 프로필, 필러 태그는 사인파. 소수 둘째 자리까지. */
function valueFor(entry, tSec) {
  if (entry.source !== 'filler') {
    return Math.round(stepMotion(entry, tSec) * 100) / 100;
  }
  const w = Math.sin(
    ((tSec * 1000) / entry.periodMs) * Math.PI * 2 + entry.phase,
  );
  const mid = (entry.min + entry.max) / 2;
  const amp = (entry.max - entry.min) / 2;
  return Math.round((mid + w * amp) * 100) / 100;
}

// --------------------------------------------------------------------------
// REST
// --------------------------------------------------------------------------

function json(res, body, status = 200) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
  });
  res.end(text);
}

const SITES = [
  { siteId: 'okpo', siteName: 'Okpo', workType: 'outdoor', notes: null },
  { siteId: 'dock-in', siteName: 'Dock In', workType: 'indoor', notes: null },
  {
    siteId: 'philly',
    siteName: 'Philly Shipyard',
    workType: 'outdoor',
    notes: null,
  },
];

const TAG_DEFS = TAG_CODES.map((tagCode, i) => ({
  tagDefinitionId: i + 1,
  tagCode,
  displayName: tagCode,
  dataType: tagCode === 'crane_system_error' ? 'bool' : 'float',
  unit: tagCode.endsWith('_angle')
    ? 'deg'
    : tagCode.includes('position')
      ? 'm'
      : null,
}));

const ALARM_NAMES = [
  'Crane System Error',
  'Wind Warning',
  'Wind Stop',
  'Load Warning',
  'Overload',
  'E-Stop On',
  'Hoist Limit',
  'Slew Limit',
  'Gantry Limit',
  'Trolley Limit',
  'Brake Fault',
  'Inverter Fault',
  'Motor Overheat',
  'Comm Loss',
  'Anti-Collision',
  'Anemometer Fault',
];
/** 알람 번호 1..N. 이름은 순환, 홀수 번호엔 설명을 붙여 표시 경로를 넓게 탄다. */
const ALARM_DICT = Array.from({ length: 48 }, (_, i) => ({
  alarmNo: i + 1,
  alarmName: `${ALARM_NAMES[i % ALARM_NAMES.length]} ${Math.floor(i / ALARM_NAMES.length) + 1}`,
  description: i % 2 === 0 ? null : `simulated alarm #${i + 1}`,
  active: true,
}));

// --------------------------------------------------------------------------
// 알람 생성기 — alarm.changed 메시지. 태그와 별도 스케줄로, 항상 개별 프레임.
// --------------------------------------------------------------------------

const ALARM_CRANES = opt['alarm-cranes']
  ? opt['alarm-cranes']
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : readRegistryCraneIds();
/** critical 이 소리·배너를 타므로 비율을 낮게 — 실서버 분포 근사. */
const SEVERITY_MIX = [
  ['critical', 0.1],
  ['high', 0.2],
  ['medium', 0.3],
  ['info', 0.4],
];
let alarmSeq = 0;
let alarmCarry = 0;
let alarmLastTickAt = Date.now();
let alarmsSent = 0;

function pickSeverity(n) {
  // 결정론적 순환 — 같은 seq 면 같은 severity.
  const r = (((n * 0.6180339887) % 1) + 1) % 1;
  let acc = 0;
  for (const [sev, w] of SEVERITY_MIX) {
    acc += w;
    if (r < acc) return sev;
  }
  return 'info';
}

function buildAlarmMessage(nowIso) {
  alarmSeq += 1;
  const craneId = ALARM_CRANES[alarmSeq % ALARM_CRANES.length];
  const clear = ((alarmSeq * 7) % 100) / 100 < ALARM_CLEAR_RATIO;
  const alarmNo = clear ? 0 : 1 + ((alarmSeq * 13) % ALARM_DICT.length);
  return (
    '{"eventType":"alarm.changed","craneId":"' +
    craneId +
    '","tagCode":"alarm_no","severity":"' +
    pickSeverity(alarmSeq) +
    '","value":' +
    alarmNo +
    ',"timestamp":"' +
    nowIso +
    '"}'
  );
}

/** tick 마다 흐른 시간만큼 알람을 보낸다(태그 스케줄과 같은 시간 기반 방식). */
function alarmTick(nowIso, now) {
  if (ALARM_RATE === 0 || clients.size === 0) return;
  alarmCarry = Math.min(
    ALARM_RATE,
    alarmCarry + (ALARM_RATE * (now - alarmLastTickAt)) / 1000,
  );
  alarmLastTickAt = now;
  const count = Math.floor(alarmCarry);
  alarmCarry -= count;
  if (count === 0) return;
  const texts = new Array(count);
  let totalLen = 0;
  for (let i = 0; i < count; i += 1) {
    texts[i] = buildAlarmMessage(nowIso);
    totalLen += frameLength(Buffer.byteLength(texts[i]));
  }
  const out = Buffer.allocUnsafe(totalLen);
  let off = 0;
  for (let i = 0; i < count; i += 1) off = writeTextFrame(out, off, texts[i]);
  for (const client of clients) {
    const { socket } = client;
    if (socket.destroyed || socket.writableLength > BACKPRESSURE_BYTES) continue;
    socket.write(out);
    client.bytes += totalLen;
  }
  alarmsSent += count;
}

function handleHttp(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const p = url.pathname;
  if (p === '/healthz') return json(res, { ok: true });
  if (p === '/api/sites') return json(res, SITES);
  if (p === '/api/tags') return json(res, TAG_DEFS);
  if (p === '/api/alarms/runtime') return json(res, ALARM_DICT);
  if (p.startsWith('/api/playback')) return json(res, []);
  if (p === '/' || p === '/api' || p === '/api/') {
    return json(res, {
      service: 'crane load-sim',
      rate: RATE,
      format: FORMAT,
      totalTags: TOTAL_TAGS,
    });
  }
  return json(res, { error: 'not found', path: p }, 404);
}

// --------------------------------------------------------------------------
// WebSocket (RFC 6455 서버 측 최소 구현 — 텍스트 프레임 송신, close/ping 처리)
// --------------------------------------------------------------------------

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/** 텍스트 프레임 인코딩(마스킹 없음 — 서버→클라이언트). */
function encodeTextFrame(text) {
  const payload = Buffer.from(text, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.allocUnsafe(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.allocUnsafe(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.allocUnsafe(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = 0x81; // FIN + text
  return Buffer.concat([header, payload]);
}

function frameLength(payloadLen) {
  return payloadLen + (payloadLen < 126 ? 2 : payloadLen < 65536 ? 4 : 10);
}

/** 미리 할당한 버퍼의 `off` 위치에 텍스트 프레임을 쓰고 다음 offset 을 돌려준다. */
function writeTextFrame(buf, off, text) {
  const len = Buffer.byteLength(text);
  buf[off] = 0x81;
  if (len < 126) {
    buf[off + 1] = len;
    off += 2;
  } else if (len < 65536) {
    buf[off + 1] = 126;
    buf.writeUInt16BE(len, off + 2);
    off += 4;
  } else {
    buf[off + 1] = 127;
    buf.writeBigUInt64BE(BigInt(len), off + 2);
    off += 10;
  }
  buf.write(text, off, 'utf8');
  return off + len;
}

function encodeCloseFrame() {
  return Buffer.from([0x88, 0x00]);
}

function encodePongFrame(payload) {
  const len = payload.length;
  const header = Buffer.from([0x8a, len]);
  return Buffer.concat([header, payload]);
}

/** 클라이언트 프레임 파서 — close(8)/ping(9) 만 본다. 나머지는 버린다. */
function createFrameReader(onControl) {
  let pending = Buffer.alloc(0);
  return (chunk) => {
    pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
    for (;;) {
      if (pending.length < 2) return;
      const opcode = pending[0] & 0x0f;
      const masked = (pending[1] & 0x80) !== 0;
      let len = pending[1] & 0x7f;
      let off = 2;
      if (len === 126) {
        if (pending.length < 4) return;
        len = pending.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (pending.length < 10) return;
        len = Number(pending.readBigUInt64BE(2));
        off = 10;
      }
      const maskLen = masked ? 4 : 0;
      if (pending.length < off + maskLen + len) return;
      let payload = pending.subarray(off + maskLen, off + maskLen + len);
      if (masked) {
        const mask = pending.subarray(off, off + 4);
        const out = Buffer.allocUnsafe(len);
        for (let i = 0; i < len; i += 1) out[i] = payload[i] ^ mask[i & 3];
        payload = out;
      }
      pending = pending.subarray(off + maskLen + len);
      if (opcode === 0x8 || opcode === 0x9) onControl(opcode, payload);
    }
  };
}

const clients = new Set();

function handleUpgrade(req, socket) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname !== '/ws/cranes-lite/all') {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }
  const key = req.headers['sec-websocket-key'];
  if (typeof key !== 'string') {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return;
  }
  const accept = crypto
    .createHash('sha1')
    .update(key + WS_GUID)
    .digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  socket.setNoDelay(true);

  const client = {
    socket,
    cursor: 0,
    sent: 0,
    bytes: 0,
    skippedTicks: 0,
    openedAt: Date.now(),
  };
  clients.add(client);

  const read = createFrameReader((opcode, payload) => {
    if (opcode === 0x8) {
      try {
        socket.write(encodeCloseFrame());
      } catch {
        /* ignore */
      }
      socket.end();
    } else if (opcode === 0x9) {
      socket.write(encodePongFrame(payload));
    }
  });
  socket.on('data', read);
  const drop = () => {
    clients.delete(client);
    log(
      `client closed  sent=${client.sent} skippedTicks=${client.skippedTicks}`,
    );
  };
  socket.on('close', drop);
  socket.on('error', drop);
  log(
    `client opened  (${clients.size} total)  rate=${RATE}/s format=${FORMAT} tags=${TOTAL_TAGS}`,
  );
}

// --------------------------------------------------------------------------
// 전송 스케줄러
// --------------------------------------------------------------------------

const PER_TICK = Math.max(1, Math.round((RATE * TICK_MS) / 1000));
const startedAt = Date.now();
let carry = 0; // 아직 보내지 않은 분량(시간 기반 — 타이머가 늦게 와도 속도를 지킨다)
let lastTickAt = Date.now();

function buildMessage(entry, nowIso, tSec) {
  // RealtimeCraneLiteMessage — 필드 순서·이름은 프론트 타입 가드와 같다.
  return (
    '{"eventType":"snapshot.delta","craneId":"' +
    entry.craneId +
    '","tagCode":"' +
    entry.tagCode +
    '","value":' +
    valueFor(entry, tSec) +
    ',"timestamp":"' +
    nowIso +
    '","quality":192,"changed":true,"occurredAt":"' +
    nowIso +
    '"}'
  );
}

function tick() {
  if (clients.size === 0) return;
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const tSec = (now - startedAt) / 1000;

  // Windows 의 setInterval 은 15.6ms 단위로 늦게 오므로 tick 횟수가 아니라
  // 흐른 시간으로 보낼 양을 정한다. 한 tick 에 몰아 보내는 상한은 1초치.
  alarmTick(nowIso, now);

  carry = Math.min(RATE, carry + (RATE * (now - lastTickAt)) / 1000);
  lastTickAt = now;
  const count = Math.floor(carry);
  carry -= count;
  if (count === 0) return;

  for (const client of clients) {
    const { socket } = client;
    if (socket.destroyed) continue;
    if (socket.writableLength > BACKPRESSURE_BYTES) {
      client.skippedTicks += 1;
      // 읽지 않는 연결(닫히지 않은 탭·죽은 렌더러)은 끊는다 — 남겨 두면 통계의
      // backlog 를 영영 차지하고 "서버가 막혔다" 로 오해하게 한다.
      client.stalledSince ??= now;
      if (now - client.stalledSince > STALL_DROP_MS) {
        log(`client dropped (no read for ${STALL_DROP_MS / 1000}s)`);
        socket.destroy();
      }
      continue;
    }
    client.stalledSince = undefined;
    socket.cork();
    if (FORMAT === 'batch') {
      let body = '[';
      for (let i = 0; i < count; i += 1) {
        const entry = SCHEDULE[client.cursor];
        client.cursor = (client.cursor + 1) % TOTAL_TAGS;
        body += (i ? ',' : '') + buildMessage(entry, nowIso, tSec);
      }
      body += ']';
      const frame = encodeTextFrame(body);
      socket.write(frame);
      client.bytes += frame.length;
      client.sent += count;
    } else {
      // 프레임을 하나씩 write 하면 10만 건/초에서 서버가 먼저 막힌다 —
      // tick 분량을 한 Buffer 에 이어 붙여 한 번만 쓴다.
      const texts = new Array(count);
      let totalLen = 0;
      for (let i = 0; i < count; i += 1) {
        const entry = SCHEDULE[client.cursor];
        client.cursor = (client.cursor + 1) % TOTAL_TAGS;
        const text = buildMessage(entry, nowIso, tSec);
        texts[i] = text;
        totalLen += frameLength(Buffer.byteLength(text));
      }
      const out = Buffer.allocUnsafe(totalLen);
      let off = 0;
      for (let i = 0; i < count; i += 1)
        off = writeTextFrame(out, off, texts[i]);
      socket.write(out);
      client.bytes += totalLen;
      client.sent += count;
    }
    socket.uncork();
  }
}

// --------------------------------------------------------------------------
// 통계
// --------------------------------------------------------------------------

let lastSent = 0;
let lastBytes = 0;
let lastAlarms = 0;
function report() {
  if (QUIET || clients.size === 0) return;
  let sent = 0;
  let bytes = 0;
  let backlog = 0;
  let skipped = 0;
  for (const c of clients) {
    sent += c.sent;
    bytes += c.bytes;
    backlog += c.socket.writableLength;
    skipped += c.skippedTicks;
  }
  const dSent = sent - lastSent;
  const dBytes = bytes - lastBytes;
  const dAlarms = alarmsSent - lastAlarms;
  lastSent = sent;
  lastBytes = bytes;
  lastAlarms = alarmsSent;
  log(
    `clients=${clients.size} sent/s=${dSent.toLocaleString()} alarms/s=${dAlarms.toLocaleString()} MB/s=${(dBytes / 1_048_576).toFixed(1)} ` +
      `backlog=${(backlog / 1_048_576).toFixed(1)}MB skippedTicks=${skipped} total=${sent.toLocaleString()}`,
  );
}

function log(msg) {
  console.log(`[load-sim ${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

// --------------------------------------------------------------------------
// 기동
// --------------------------------------------------------------------------

const server = http.createServer(handleHttp);
server.on('upgrade', handleUpgrade);
server.listen(PORT, () => {
  log(
    `listening on http://127.0.0.1:${PORT}  ws://127.0.0.1:${PORT}/ws/cranes-lite/all\n` +
      `  cranes=${CRANES.length} sceneTags=${SCENE_TAGS.length} totalTags=${TOTAL_TAGS} ` +
      `rate=${RATE}/s format=${FORMAT} tick=${TICK_MS}ms (${PER_TICK}/tick) ` +
      `alarms=${ALARM_RATE}/s clearRatio=${ALARM_CLEAR_RATIO} alarmCranes=${ALARM_CRANES.length}`,
  );
});

const tickTimer = setInterval(tick, TICK_MS);
const reportTimer = setInterval(report, 1000);

function shutdown() {
  clearInterval(tickTimer);
  clearInterval(reportTimer);
  for (const c of clients) {
    try {
      c.socket.write(encodeCloseFrame());
      c.socket.end();
    } catch {
      /* ignore */
    }
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
if (DURATION_S > 0) setTimeout(shutdown, DURATION_S * 1000);

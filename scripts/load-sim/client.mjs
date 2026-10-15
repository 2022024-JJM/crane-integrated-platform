#!/usr/bin/env node
/**
 * 시뮬레이터 자체 검증용 Node 수신 클라이언트 — 브라우저 없이 서버가 설정한
 * 속도를 실제로 내보내는지 잰다. 서버 `sent/s` 와 여기 `recv/s` 가 같아야
 * 서버·소켓이 병목이 아니다.
 *
 *   node scripts/load-sim/client.mjs [ws://127.0.0.1:33500/ws/cranes-lite/all] [--parse]
 *
 * --parse 를 주면 JSON.parse 까지 해서 CPU 1코어 기준 파싱 상한을 같이 본다.
 */
const url =
  process.argv.find((a) => a.startsWith('ws://')) ??
  'ws://127.0.0.1:33500/ws/cranes-lite/all';
const parse = process.argv.includes('--parse');

const ws = new WebSocket(url);
let frames = 0;
let msgs = 0;
let bytes = 0;
let lastFrames = 0;
let lastMsgs = 0;
let lastBytes = 0;

ws.addEventListener('open', () =>
  console.log(`[client] open ${url} parse=${parse}`),
);
ws.addEventListener('close', () => {
  console.log('[client] closed');
  process.exit(0);
});
ws.addEventListener('error', (e) => {
  console.error('[client] error', e.message ?? e);
  process.exit(1);
});
ws.addEventListener('message', (ev) => {
  const data = typeof ev.data === 'string' ? ev.data : '';
  frames += 1;
  bytes += data.length;
  if (parse) {
    const v = JSON.parse(data);
    msgs += Array.isArray(v) ? v.length : 1;
  } else {
    msgs += data.charCodeAt(0) === 91 /* [ */ ? countBatch(data) : 1;
  }
});

function countBatch(s) {
  let n = 0;
  for (let i = 0; i < s.length; i += 1) if (s.charCodeAt(i) === 123) n += 1; // '{'
  return n;
}

setInterval(() => {
  const mem = process.memoryUsage().rss / 1_048_576;
  console.log(
    `[client] frames/s=${(frames - lastFrames).toLocaleString()} recv/s=${(msgs - lastMsgs).toLocaleString()} ` +
      `MB/s=${((bytes - lastBytes) / 1_048_576).toFixed(1)} rss=${mem.toFixed(0)}MB`,
  );
  lastFrames = frames;
  lastMsgs = msgs;
  lastBytes = bytes;
}, 1000);

#!/usr/bin/env bash
# smoke.sh <origin> <BASE_PATH> <INDOOR_PATH> [제한 초]
#   예) smoke.sh http://127.0.0.1:3362 /crane_rnd/dev/ /crane_rnd/indoor/dev/ 60
# healthz · crane · indoor 주소가 200 이고, indoor 가 돌려준 index.html 이 이 환경의
# 에셋 접두어(BASE_PATH/assets/)를 가리키면 통과. 3초 간격으로 제한 초까지 재시도.
set -u
O="$1"; B="$2"; I="${3:-}"; LIMIT="${4:-60}"
[ -n "$I" ] || I="$B"                  # crane · indoor 를 나누지 않는 빌드면 crane 주소만 본다
for _ in $(seq 1 $((LIMIT / 3))); do
  html="$(curl -fsS "$O$I" 2>/dev/null)" \
    && curl -fsS -o /dev/null "$O$B" \
    && curl -fsS -o /dev/null "$O/healthz" \
    && grep -q "src=\"${B}assets/" <<<"$html" \
    && exit 0
  sleep 3
done
echo "smoke 실패: $O $B $I"; exit 1

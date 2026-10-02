#!/usr/bin/env bash
# 호출: deploy/deploy.sh <dev|stage|prod> <이미지 태그>   예) deploy/deploy.sh dev dev-4e1d0a2
# 위치: $DEPLOY_DIR/deploy/deploy.sh (옆에 env/ · smoke.sh, 위에 docker-compose.yml · .env · images/)
# 워크플로 .github/workflows/deploy-199.yml 의 4단계가 ssh 로 이 셸을 부른다.
# 손으로 되돌릴 때도 같은 셸을 쓴다: 이미 로드된 태그면 tar 없이 된다.
set -euo pipefail
ENV="${1:?env}"; TAG="${2:?tag}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
set -a; . "$ROOT/deploy/env/$ENV.env"; set +a
NAME="crane-shell-$ENV"
TAR="$ROOT/images/crane-shell-$TAG.tar.gz"
# 프로젝트 이름은 compose 의 name: 이 위에서 올린 DEPLOY_ENV 로 정한다 ($NAME 과 같은 값)
compose() { docker compose -f "$ROOT/docker-compose.yml" "$@"; }

# 1. 이미지 로드 (tar 가 없으면 이미 로드된 이미지를 씀 — 롤백 · 로컬 실습)
if [ -f "$TAR" ]; then gunzip -c "$TAR" | docker load; fi
docker image inspect "crane-shell:$TAG" >/dev/null

# 2. 지금 떠 있는 태그 기억 (롤백용)
PREV="$(docker inspect -f '{{.Config.Image}}' "$NAME" 2>/dev/null | cut -d: -f2 || true)"

# 3. 내렸다가 다시 올림
compose down --remove-orphans || true
IMAGE_TAG="$TAG" compose up -d --no-build

# 4. 응답 확인. 60초 안에 안 되면 직전 태그로 다시 올리고 실패로 끝냄
if ! bash "$ROOT/deploy/smoke.sh" "http://127.0.0.1:$SHELL_PORT" "$BASE_PATH" "${INDOOR_PATH:-}" 60; then
  docker logs --tail 80 "$NAME" || true
  if [ -n "$PREV" ] && [ "$PREV" != "$TAG" ]; then
    echo "응답 없음 → $PREV 로 복귀"
    compose down || true
    IMAGE_TAG="$PREV" compose up -d --no-build
  fi
  exit 1
fi

# 5. 정리: 받은 tar 삭제, 환경별 이미지는 최근 3개만 (현재 + 롤백 후보 2)
rm -f "$TAR"
docker images crane-shell --format '{{.Tag}}' | grep "^$ENV-" | tail -n +4 \
  | xargs -r -I{} docker rmi "crane-shell:{}" || true
echo "배포 완료: $NAME ← crane-shell:$TAG"

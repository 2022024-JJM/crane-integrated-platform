# ============================================================
# Stage 1: builder
# ============================================================
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.11.0 --activate

WORKDIR /app

# --- Dependency install layer (cached until package.json / lockfile changes) ---
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

COPY apps/shell/package.json            ./apps/shell/package.json
COPY apps/hanwha-ocean/package.json     ./apps/hanwha-ocean/package.json
COPY apps/goliath-crane/package.json    ./apps/goliath-crane/package.json
COPY apps/philly-shipyard/package.json  ./apps/philly-shipyard/package.json
COPY apps/crane-hmi/package.json        ./apps/crane-hmi/package.json
COPY packages/core/package.json         ./packages/core/package.json
COPY packages/domain/package.json       ./packages/domain/package.json
COPY packages/features/package.json     ./packages/features/package.json
COPY packages/ui/package.json           ./packages/ui/package.json
COPY packages/widgets/package.json      ./packages/widgets/package.json

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# --- Source copy layer ---
COPY apps/      ./apps/
COPY packages/  ./packages/
COPY tsconfig.json tsconfig.base.json turbo.json ./

# 모든 백엔드/LiDAR IP·PORT 는 런타임 nginx envsubst 로 주입된다.
# (api/ws/lidar 호출은 프론트에서 동일 origin 의 /api, /ws, /lidar 로 나가고
#  nginx 가 .env 의 BACKEND_HOST/PORT, LIDAR_HOST/PORT 로 프록시한다.)
# 따라서 이미지 빌드 시점에는 IP 관련 ARG 가 필요 없다.
RUN pnpm turbo run build --filter=@crane/shell...

# ============================================================
# Stage 2: runner
# ============================================================
FROM nginx:1.27-alpine AS runner

RUN rm -rf /usr/share/nginx/html/*

# Vite 가 base='/crane_rnd/' 로 빌드하므로, 정적 파일도 동일 sub-path 아래에 배치한다.
COPY --from=builder /app/apps/shell/dist /usr/share/nginx/html/crane_rnd

# nginx 공식 이미지의 entrypoint 가 /etc/nginx/templates/*.template 을
# envsubst 로 치환해 /etc/nginx/conf.d/ 로 출력한다.
# 따라서 BACKEND_HOST/PORT, LIDAR_HOST/PORT 환경변수만 주입하면
# 이미지 재빌드 없이 IP 변경이 가능하다.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

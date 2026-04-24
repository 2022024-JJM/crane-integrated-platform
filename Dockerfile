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
COPY tsconfig.json turbo.json ./

# Build-time environment variables (embedded into JS bundle by Vite)
ARG VITE_API_BASE_URL=""
ARG VITE_WS_BASE_URL=""
ARG VITE_LIDAR_WS_URL=""

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_WS_BASE_URL=$VITE_WS_BASE_URL \
    VITE_LIDAR_WS_URL=$VITE_LIDAR_WS_URL

# Build shell app + all workspace dependencies in topological order
RUN pnpm turbo run build --filter=@crane/shell...

# ============================================================
# Stage 2: runner
# ============================================================
FROM nginx:1.27-alpine AS runner

RUN rm -rf /usr/share/nginx/html/*

# Vite 가 base='/crane_rnd/' 로 빌드하므로, 정적 파일도 동일 sub-path 아래에 배치한다.
COPY --from=builder /app/apps/shell/dist /usr/share/nginx/html/crane_rnd
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# syntax=docker/dockerfile:1
# One image: the compiled backend serves the built SPA and the API.
# Build context is the repository root (see docker-compose.yml). Target: Synology NAS (Intel x86_64).
# Adjust NODE_VERSION to a current Node 22 patch release when rebuilding.
ARG NODE_VERSION=22.23.4

FROM --platform=linux/amd64 node:${NODE_VERSION}-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@12.15.0 --activate
WORKDIR /app

FROM base AS frontend-build
ARG BUILD_ID=dev
WORKDIR /app/frontend
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY frontend/ ./
RUN BUILD_ID=${BUILD_ID} pnpm exec vite build

FROM base AS backend-build
WORKDIR /app/backend
COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY backend/ ./
RUN pnpm build

FROM base AS backend-deps
WORKDIR /app/backend
COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM --platform=linux/amd64 node:${NODE_VERSION}-bookworm-slim AS runtime
ARG BUILD_ID=dev
ENV NODE_ENV=production
ENV BUILD_ID=${BUILD_ID}
ENV STATIC_DIR=/app/static
ENV CONFIG_DIR=/config
ENV DATA_DIR=/data
ENV BACKUP_DIR=/backup
ENV PORT=8080
ENV HOST=0.0.0.0

WORKDIR /app/backend
COPY --from=backend-deps /app/backend/node_modules ./node_modules
COPY --from=backend-build /app/backend/dist ./dist
COPY backend/package.json ./
COPY --from=frontend-build /app/frontend/dist /app/static

# Numeric non-root user; docker-compose.yml overrides it with the NAS user and group.
USER 1000:1000
EXPOSE 8080
CMD ["node", "dist/main.js"]

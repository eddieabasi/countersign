# Countersign trust service.
# Build context: the REPOSITORY ROOT (pnpm workspace). On Railway, set the service variable
#   RAILWAY_DOCKERFILE_PATH=apps/trust-service/Dockerfile
# Local build: docker build -f apps/trust-service/Dockerfile .

FROM node:22-slim AS deps
ENV CI=true
RUN corepack enable
WORKDIR /app
# Every workspace manifest, so the frozen lockfile matches; only the trust service's
# production dependency tree is installed.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/trust-service/package.json apps/trust-service/
COPY apps/web/package.json apps/web/
COPY apps/seller-agent/package.json apps/seller-agent/
COPY packages/shared/package.json packages/shared/
COPY packages/widget/package.json packages/widget/
RUN pnpm install --frozen-lockfile --prod --filter "@countersign/trust-service..."

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app /app
COPY packages/shared/src packages/shared/src
COPY apps/trust-service/src apps/trust-service/src
COPY apps/trust-service/drizzle apps/trust-service/drizzle
WORKDIR /app/apps/trust-service
USER node
# Listens on $PORT (Railway) or TRUST_SERVICE_PORT; migrations run on startup.
CMD ["node", "--import", "tsx", "src/index.ts"]

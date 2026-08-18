# Runs on TensorFlow's WASM backend (@tensorflow/tfjs-backend-wasm), not
# tfjs-node — no compiled native TensorFlow binary, so this can use the same
# node:22-alpine base as the other FCP services. `sharp` (image decode) does
# ship a native binary, but has reliable prebuilt musl/Alpine support — same
# as it's already used in fcp-timesheet-app's Dockerfile.

FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
RUN pnpm install --no-frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-alpine

WORKDIR /app

RUN corepack enable
ENV NODE_ENV=production

COPY --from=builder /app ./

EXPOSE 4001

CMD ["pnpm", "start"]

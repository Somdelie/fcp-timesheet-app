FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma

RUN pnpm install --no-frozen-lockfile

COPY . .

ENV DATABASE_URL="postgresql://user:password@localhost:5432/dummy"
ENV DIRECT_URL="postgresql://user:password@localhost:5432/dummy"

RUN pnpm prisma generate
RUN pnpm build

FROM node:22-alpine

WORKDIR /app

RUN corepack enable

ENV NODE_ENV=production

COPY --from=builder /app ./

EXPOSE 3000

CMD ["pnpm", "start"]
# 1. 의존성 설치 단계 (deps)
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2. 프로젝트 빌드 단계 (builder)
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 카카오맵 API 키 등 환경변수가 빌드 타임에 필요하다면 여기서 주입해야 할 수도 있습니다.
RUN npm run build

# 3. 실행 단계 (runner) - 최종적으로 남는 뼈대
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV PORT 3000

# Next.js standalone 폴더와 정적 파일들만 가져오기
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

# 서버 실행 (standalone 모드에서는 server.js를 실행)
CMD ["node", "server.js"]
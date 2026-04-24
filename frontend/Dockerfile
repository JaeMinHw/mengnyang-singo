# 1. 빌드 단계 (Builder)
# --------------------
# 버전을 18 -> 20으로 변경
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# 프로덕션용으로 앱을 빌드합니다.
RUN npm run build


# 2. 프로덕션 단계 (Runner)
# --------------------
# 여기도 버전을 18 -> 20으로 변경
FROM node:20-alpine

WORKDIR /app

# .env 파일은 여기서 더 이상 필요 없습니다.
# 환경변수는 docker-compose에서 주입됩니다.

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["npm", "start"]
# 1. 빌드 단계 (Builder)
# --------------------
# Next.js 앱을 빌드하기 위한 환경
FROM node:18-alpine AS builder

WORKDIR /app

# package.json과 lock 파일을 먼저 복사하여 종속성을 설치합니다.
# 이렇게 하면 코드 변경 시 매번 npm install을 다시 하지 않아도 됩니다. (Docker 캐시 활용)
COPY package*.json ./
RUN npm install

# 나머지 소스 코드를 복사합니다.
COPY . .

# .env.local의 환경변수를 빌드 시에 주입합니다.
ARG NEXT_PUBLIC_KAKAO_MAP_API_KEY
ENV NEXT_PUBLIC_KAKAO_MAP_API_KEY=${NEXT_PUBLIC_KAKAO_MAP_API_KEY}

# 프로덕션용으로 앱을 빌드합니다.
RUN npm run build


# 2. 프로덕션 단계 (Runner)
# --------------------
# 실제 서비스를 실행하기 위한 가벼운 환경
FROM node:18-alpine

WORKDIR /app

# 빌드 단계에서 생성된 결과물만 복사합니다.
# 이렇게 하면 최종 이미지 크기가 매우 작아집니다. (멀티 스테이지 빌드)
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/public ./public

# 3000번 포트를 외부에 노출합니다.
EXPOSE 3000

# 컨테이너 실행 시 Next.js 서버를 시작합니다.
CMD ["npm", "start"]
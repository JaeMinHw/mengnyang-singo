# 1. 빌드 단계
FROM node:20-alpine AS builder

WORKDIR /workspace/frontend

COPY frontend/package*.json ./
RUN npm install

WORKDIR /workspace
COPY frontend/ ./frontend/
COPY shared/ ./shared/

WORKDIR /workspace/frontend

ARG NEXT_PUBLIC_KAKAO_MAP_API_KEY
ENV NEXT_PUBLIC_KAKAO_MAP_API_KEY=$NEXT_PUBLIC_KAKAO_MAP_API_KEY

RUN npm run build


# 2. 프로덕션 단계
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /workspace/frontend/.next ./.next
COPY --from=builder /workspace/frontend/node_modules ./node_modules
COPY --from=builder /workspace/frontend/package.json ./package.json
COPY --from=builder /workspace/frontend/public ./public

EXPOSE 3000

CMD ["npm", "start"]
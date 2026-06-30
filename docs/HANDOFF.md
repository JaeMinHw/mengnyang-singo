# 멍냥신고 프로젝트 인계 문서

> **마지막 갱신:** 2026-06-30  
> **갱신 규칙:** 기능이 완료·커밋될 때마다 이 문서를 수정한다. 새 채팅 시작 시 `docs/HANDOFF.md`를 읽고 이어서 작업한다.

---

## 한 줄 요약

로컬 Docker 환경에서 JWT 인증, 지도 기반 목격/실종 등록(다중 이미지 최대 5장), 키워드 검색·알림, 댓글, 유사 글 매칭 알림(2차 완료), shared 동의어 단일 원본 관리, dev 중 shared JSON 자동 watch까지 완료된 상태. 다음 후보는 **shared watch 커밋**, **마이페이지 고도화**, **채팅**.

---

## 갱신 이력 (최신순)

| 날짜 | 내용 |
|------|------|
| 2026-06-30 | 인계 문서 `docs/HANDOFF.md` 생성 |
| 2026-06-30 | 유사 글 매칭 2차 완료 (`similar_match_history`, 수정/되돌리기 재매칭, 동의어 정규화 통일) — 커밋 `b80a1c0` |
| 2026-06-30 | shared JSON dev watch 자동화 구현 — **미커밋** (`dev.mjs`, `copy-shared.mjs --watch`) |

---

## 프로젝트 개요

**프로젝트명:** 멍냥신고

**목적:**
- 길고양이 / 유기견 / 기타 동물의 목격 위치를 지도 기반으로 공유하는 웹 서비스
- Docker + Nginx + Blue-Green 방식으로 무중단 배포 실습
- 현재는 AWS 없이 로컬 환경 중심 개발

**장기 확장 계획:**
- 찾는 글(실종 동물 등록) ✅
- 유사 신고 매칭 (프론트 관련 글 추천 ✅ / 백엔드 유사 매칭 알림 ✅ 2차 완료)
- 알림 ✅ 1차 완료
- 채팅 — 미구현
- 사건(케이스) 단위 추적 — 미구현

**개발 PC 경로:** `C:\Users\Hivesystem\Desktop\mengnyang-singo`

---

## 기술 스택

### Frontend
- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- react-kakao-maps-sdk, axios, exifr (EXIF GPS)
- zustand, @tanstack/react-query (설치됨, 핵심 흐름은 axios 직접 호출)

### Backend
- Python 3.13, FastAPI, SQLAlchemy, Alembic, Pydantic / pydantic-settings

### Auth / Security
- passlib[bcrypt]==1.7.4, bcrypt==4.0.1
- python-jose[cryptography]==3.3.0, email-validator==2.2.0

### Infra
- Docker / Docker Compose, Nginx, MySQL 8.0

---

## 아키텍처

### 컨테이너 구성
| 서비스 | 역할 |
|--------|------|
| nginx | 리버스 프록시. `/api` → backend, 나머지 → frontend |
| app-blue | 기본 활성 backend 슬롯 |
| app-green | Blue-Green 배포 테스트용 (`profiles: green`) |
| app-migrate | Alembic 전용 (`profiles: migrate`) |
| app-frontend | Next.js 프론트엔드 |
| db | MySQL 8.0 |

### 중요 개념
- blue/green은 **배포 슬롯**이지 버전 개념이 아님
- 평소 기본 활성 슬롯은 **Blue**
- `deploy.ps1` → green 전환, `reset.ps1` → blue 복귀
- Docker build context = 루트 (`.`) → `shared/` 폴더를 프론트/백엔드 모두 사용

### app-migrate 특이사항
- bind mount (`./backend:/app`)가 `/app`를 덮어씌우므로
- `./shared:/app/shared:ro` 별도 마운트로 shared JSON 접근

---

## 핵심 파일 구조

```
mengnyang-singo/
├── docs/
│   └── HANDOFF.md              ← 이 문서 (기능 완료 시 갱신)
├── .env
├── docker-compose.yml
├── deploy.ps1 / reset.ps1
├── shared/
│   └── synonym-groups.json     ← 동의어 원본 (프론트/백엔드 공통)
├── nginx/nginx.conf
├── backend/
│   ├── Dockerfile
│   ├── alembic/
│   └── app/
│       ├── core/
│       │   ├── synonyms.py
│       │   ├── similar_sightings.py
│       │   └── notifications.py
│       ├── models/
│       │   ├── similar_match_history.py   ← 유사 매칭 이력
│       │   ├── sighting_image.py
│       │   └── ...
│       └── api/
└── frontend/
    ├── scripts/
    │   ├── copy-shared.mjs     ← shared JSON 복사 (+ --watch)
    │   └── dev.mjs             ← dev + watch 동시 실행
    ├── shared/                 ← 자동 복사본 (직접 수정 금지)
    ├── app/ / components/ / lib/
    └── package.json
```

---

## shared 동의어 구조

### 목적
동의어 데이터를 프론트/백엔드가 **단일 원본**에서 공유. `shared/synonym-groups.json` 한 곳만 수정.

### 파일 위치
| 용도 | 경로 |
|------|------|
| 원본 | `shared/synonym-groups.json` |
| 프론트 사용본 | `frontend/shared/synonym-groups.json` (자동 복사) |
| 백엔드 사용본 | `/app/shared/synonym-groups.json` (Docker 빌드 시 복사) |

### 자동 복사 방식
| 시점 | 동작 |
|------|------|
| `npm run dev` | `predev` 1회 복사 + `copy-shared --watch` 백그라운드 감시 |
| `npm run build` | `prebuild` 복사 |
| 수동 | `npm run copy:shared` |
| watch만 | `npm run watch:shared` |

### 주의사항
- **`frontend/shared/`는 직접 수정하지 말 것** — 항상 `shared/` 원본만 수정
- JSON은 정적 import라 dev 중 수정 후 **브라우저 새로고침** 필요할 수 있음
- 백엔드 변경 반영: `docker compose up -d --build app-blue`

### 백엔드 로더
- `backend/app/core/synonyms.py` — `load_synonym_groups()`, `normalize_search_text()`
- `lru_cache`로 파일 1회만 읽음

---

## 환경변수 / 설정

### 루트 `.env`
`NEXT_PUBLIC_KAKAO_MAP_API_KEY`, `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`

### `frontend/.env.local`
`NEXT_PUBLIC_KAKAO_MAP_API_KEY` (로컬 dev용)

### `next.config.ts`
- `output: "standalone"`
- `experimental.externalDir: true`
- `rewrites`: `/api/:path*` → `http://localhost/api/:path*`

---

## 운영 방식

### 프론트 개발 (기본)
```powershell
cd frontend
npm run dev
```
- 로컬 `localhost:3000`
- `/api`는 next.config rewrite로 Docker backend 프록시

### 백엔드 재빌드
```powershell
docker compose up -d --build app-blue
```

### Alembic
```powershell
docker compose --profile migrate run --rm app-migrate alembic current
docker compose --profile migrate run --rm app-migrate alembic upgrade head
```

### Docker 전체 기동
```powershell
docker compose up -d
```

---

## 백엔드 API 요약

### Auth
- `POST /signup`, `POST /login`, `GET /me`
- JWT access token + localStorage + Bearer 헤더

### Sighting
- CRUD + 상태 변경 + 다중 이미지 (`image_urls`)
- 키워드 매칭 알림, **유사 글 매칭 알림 (2차)**

### Comment / Notification / Keyword / Upload / Health
- 인계 문서 5차 기준과 동일 (댓글, 알림 4종, 키워드 최대 20개, 이미지 업로드 10MB)

---

## 알림 타입 (4종)

| 타입 | 설명 |
|------|------|
| NEW_COMMENT | 새 댓글 |
| STATUS_CHANGED | 참여 글 상태 변경 |
| KEYWORD_MATCH | 관심 키워드 매칭 |
| SIMILAR_MATCH | 유사 글 매칭 (양방향) |

---

## 유사 글 매칭 (2차 완료)

### 트리거
| 시점 | `trigger_action` |
|------|------------------|
| 새 글 등록 | `create` |
| 글 수정 (animal_type, description, latitude, longitude 변경) | `update` |
| FOUND → 활성 상태 되돌리기 | `reopen` |

### 매칭 조건
- 반대 `post_type`끼리만 (LOST ↔ SIGHTING)
- 동일 `animal_type`
- 3km 이내
- `is_deleted = False`, `status != "FOUND"`
- 자기 글 제외, 최대 3개 후보
- 정렬: 공통 특징 키워드 많은 순 → 가까운 순 → 최신 순

### 중복 방지 (`similar_match_history`)
- `(source_sighting_id, target_sighting_id, recipient_user_id)` 유니크
- 같은 글쌍 + 수신자 조합은 **한 번만** 알림
- 글 ID는 방향 없이 오름차순 정렬해 저장

### 동의어 정규화
- 백엔드 `normalize_search_text()` = 프론트 `normalizeSearchText()`와 동일
- 동의어 → 대표어 치환 후 특징 키워드 추출

### 관련 파일
- `backend/app/core/similar_sightings.py`
- `backend/app/core/synonyms.py`
- `backend/app/models/similar_match_history.py`
- `backend/app/api/sighting.py`
- migration: `b2ce8bce83e6_add_similar_match_history.py`

---

## DB 모델 (추가분)

### SimilarMatchHistory
- `id`, `source_sighting_id`, `target_sighting_id`, `recipient_user_id`, `created_at`
- 유니크: `uq_similar_match_history`

### SightingImage (다중 이미지)
- `sighting_image` 테이블, 최대 5장
- `Sighting.image_url`은 첫 번째 이미지 레거시 호환

### Alembic head
- `b2ce8bce83e6` — `similar_match_history` 테이블

---

## 서비스 정책

- 조회: 비회원 가능
- 등록/수정/삭제/댓글/알림/키워드: 회원 전용 (본인 글만 수정·삭제)
- FOUND 기본 숨김 + 30일 후 메인 목록 보관 (배치 미구현, 조회 시 필터만 적용)
- FOUND 되돌리기 시 사유 필수

### 상태
| post_type | 허용 상태 |
|-----------|-----------|
| SIGHTING | SPOTTED, PROTECTING, FOUND |
| LOST | LOST, PROTECTING, FOUND |

---

## 완료된 기능 ✅

- 검색, 신고 목록, 카카오맵 연동
- 실종 글 (LOST)
- 키워드 알림, 댓글, 상태 변경·보관 정책
- 다중 이미지 (등록/수정/상세)
- 유사 글 매칭 알림 1차 + **2차**
- shared 동의어 단일 원본 + 자동 복사
- **shared JSON dev watch** (구현 완료, 커밋 대기)

---

## 미구현 / 다음 후보

### 즉시
1. **shared watch 커밋** — `dev.mjs`, `copy-shared.mjs --watch` 변경분
2. **push** — 로컬이 origin보다 앞선 커밋 있으면 push

### 단기
- 마이페이지 고도화 (내 글 검색/필터, 보관 포함, 내 댓글)
- 찾음 30일 후 자동 배치

### 중기
- 채팅 기능
- 같은 동물 묶기 (case), 이동 경로 시각화

### 장기
- 이미지 기반 유사 검색, CI/CD, HTTPS, Push Notification

---

## 코드 변경 후 확인 절차 (체크리스트)

기능 수정 후 아래 순서로 확인한다.

```powershell
# 프로젝트 루트
docker compose ps                                    # Docker Up 확인

# DB migration (새 migration 있을 때만)
docker compose --profile migrate run --rm app-migrate alembic upgrade head

# 백엔드 변경 시
docker compose up -d --build app-blue

# 프론트 shared 변경 시 (dev 안 켜져 있을 때)
cd frontend
npm run copy:shared

# 프론트 dev
npm run dev
```

### 유사 매칭 수동 테스트
| 시나리오 | 기대 결과 |
|----------|-----------|
| 새 글 등록 → 유사 글 있음 | 양방향 SIMILAR_MATCH 1회 |
| 같은 글쌍 다시 매칭 | 이력 때문에 중복 없음 |
| 설명 수정 → 새 유사 글 | 새 쌍만 알림 |
| FOUND → 되돌리기 | reopen 알림 + 재매칭 |

---

## Git / 커밋 상태 (2026-06-30 기준)

### 최근 커밋
- `b80a1c0` feat: add similar match history and phase-2 re-matching
- `c7f0a92` feat: use shared synonym data in backend similar sighting matching
- (이하 shared 동의어, 다중 이미지 등)

### 미커밋 변경 (shared watch)
- `frontend/package.json`
- `frontend/scripts/copy-shared.mjs`
- `frontend/scripts/dev.mjs` (신규)

---

## 작업 원칙

1. 천천히, 한 단계씩
2. 추측하지 말고 파일/상태 먼저 확인
3. 코드 수정 시: 왜 / 무엇이 좋아지는지 / 대안 설명
4. 현재 구조 존중, 점진적 개선
5. **기능 완료 시 `docs/HANDOFF.md` 갱신**
6. 커밋/푸시는 의미 있는 작업 단위가 끝났을 때

---

## 새 채팅 시작 방법

```
docs/HANDOFF.md 읽고 멍냥신고 프로젝트 이어서 진행해줘.
```

또는 이 문서의 **한 줄 요약 + 다음 후보**만 붙여넣어도 된다.


멍냥신고 프로젝트 인계 문서 (5차)
[프로젝트 개요]
프로젝트명: 멍냥신고

목적:

길고양이 / 유기견 / 기타 동물의 목격 위치를 지도 기반으로 공유하는 웹 서비스
Docker + Nginx + Blue-Green 방식으로 무중단 배포를 실습
현재는 AWS 없이 로컬 환경 중심 개발
장기적으로는 "단순 목격 공유"를 넘어
찾는 글(실종 동물 등록) ✅ 완료
유사 신고 매칭 (프론트 관련 글 추천 ✅ 완료 / 백엔드 유사 매칭 알림 ✅ 1차 완료)
알림 ✅ 1차 완료
채팅
사건(케이스) 단위 추적
까지 확장할 계획
개발 PC 경로:
C:\Users\Hivesystem\Desktop\mengnyang-singo

==================================================
[기술 스택]
Frontend

Next.js 16 (App Router)
React 19
TypeScript
Tailwind CSS
react-kakao-maps-sdk
axios
exifr (EXIF GPS 추출용)
zustand (설치됨, 현재 핵심 상태관리에는 미사용)
@tanstack/react-query (설치됨, 현재 핵심 흐름은 axios 직접 호출)
Backend

Python 3.13
FastAPI
SQLAlchemy
Alembic
Pydantic / pydantic-settings
Auth / Security

passlib[bcrypt]==1.7.4
bcrypt==4.0.1
python-jose[cryptography]==3.3.0
email-validator==2.2.0
Infra

Docker / Docker Compose
Nginx
MySQL 8.0
==================================================
[아키텍처]
컨테이너 구성:

nginx: 리버스 프록시. /api → backend, 나머지 → frontend
app-blue: 기본 활성 backend 슬롯
app-green: Blue-Green 배포 테스트용 (profiles: green)
app-migrate: Alembic 전용 (profiles: migrate, ./backend:/app bind mount + ./shared:/app/shared:ro)
app-frontend: Next.js 프론트엔드
db: MySQL
중요 개념:

blue/green은 "배포 슬롯"이지 버전 개념이 아님
app-migrate는 migration 파일이 로컬에도 남게 하려고 둔 개발 편의용 컨테이너
평소 기본 활성 슬롯은 Blue
nginx.conf 기본 upstream도 app-blue
deploy.ps1로 green 전환 테스트
reset.ps1로 다시 blue 복귀
Docker build context 현황:

app-blue, app-green, app-migrate: context = . (루트), dockerfile = backend/Dockerfile
app-frontend: context = . (루트), dockerfile = frontend/Dockerfile
루트 context 기반이라 shared/ 폴더를 프론트/백엔드 모두 사용 가능
==================================================
[핵심 파일 구조]
mengnyang-singo/
├── .env
├── docker-compose.yml
├── deploy.ps1
├── reset.ps1
├── shared/
│ └── synonym-groups.json ← 동의어 원본 (프론트/백엔드 공통 사용)
├── nginx/
│ └── nginx.conf
├── backend/
│ ├── .env
│ ├── Dockerfile ← 루트 context 기준으로 변경됨
│ ├── requirements.txt
│ ├── alembic.ini
│ ├── alembic/
│ │ ├── env.py
│ │ └── versions/
│ └── app/
│ ├── main.py
│ ├── core/
│ │ ├── config.py
│ │ ├── database.py
│ │ ├── security.py
│ │ ├── dependencies.py
│ │ ├── notifications.py
│ │ ├── synonyms.py ← 새로 추가: shared JSON 로더
│ │ └── similar_sightings.py ← 새로 추가: 유사 글 매칭 helper
│ ├── models/
│ │ ├── sighting.py
│ │ ├── sighting_image.py ← 새로 추가: 다중 이미지 테이블
│ │ ├── user.py
│ │ ├── comment.py
│ │ ├── notification.py
│ │ └── keyword.py
│ ├── schemas/
│ │ ├── sighting.py
│ │ ├── user.py
│ │ ├── comment.py
│ │ ├── notification.py
│ │ └── keyword.py
│ └── api/
│ ├── health.py
│ ├── sighting.py
│ ├── auth.py
│ ├── upload.py
│ ├── comment.py
│ ├── notification.py
│ └── keyword.py
└── frontend/
├── Dockerfile ← 루트 context 기준으로 변경됨
├── package.json ← predev/prebuild 자동 복사 스크립트 추가
├── next.config.ts ← externalDir 실험적 옵션 추가
├── .env.local
├── scripts/
│ └── copy-shared.mjs ← 새로 추가: shared JSON 자동 복사 스크립트
├── shared/
│ └── synonym-groups.json ← shared/에서 자동 복사된 프론트 사용본
├── app/
│ ├── layout.tsx
│ ├── globals.css
│ ├── page.tsx ← useSearchParams Suspense 분리 적용됨
│ ├── login/
│ │ └── page.tsx
│ ├── signup/
│ │ └── page.tsx
│ ├── mypage/
│ │ └── page.tsx
│ ├── notifications/
│ │ └── page.tsx ← SIMILAR_MATCH 타입 추가됨
│ └── sightings/
│ ├── new/
│ │ └── page.tsx ← 다중 이미지 업로드 적용됨
│ └── [id]/
│ └── edit/
│ └── page.tsx ← 다중 이미지 편집 적용됨
├── components/
│ ├── Header.tsx
│ ├── QueryProvider.tsx
│ ├── MapWithLogic.tsx
│ ├── SightingDetailModal.tsx ← 다중 이미지 표시 + 풀스크린 버그 수정
│ ├── SightingList.tsx
│ └── SightingListPanel.tsx
├── lib/
│ ├── api.ts
│ ├── auth.ts
│ └── sightingUtils.ts ← synonymGroups를 shared JSON에서 읽도록 변경
├── types/
│ └── sighting.ts ← image_urls 필드 추가됨
└── public/
├── cat-marker.png
├── dog-marker.png
├── cat-marker-lost.png
├── dog-marker-lost.png
└── bell.png

==================================================
[shared 동의어 구조 현재 상태]
목적:

동의어 데이터를 프론트/백엔드가 단일 원본에서 공유
수정 시 shared/synonym-groups.json 한 곳만 고치면 됨
파일 구조:

원본: shared/synonym-groups.json (루트)
프론트 사용본: frontend/shared/synonym-groups.json (자동 복사)
백엔드 사용본: /app/shared/synonym-groups.json (Docker 빌드 시 복사)
자동 복사 방식:

frontend/scripts/copy-shared.mjs
shared/*.json → frontend/shared/ 복사
Node.js fs 기반으로 OS 무관하게 동작
package.json에 predev, prebuild 훅 등록
npm run dev 전에 자동 실행
npm run build 전에 자동 실행 (Docker 빌드 포함)
수동 실행: npm run copy:shared
주의사항:

dev 서버가 이미 켜진 상태에서 shared 수정 시
→ npm run copy:shared 또는 dev 재시작 필요
frontend/shared/는 직접 수정하지 말 것
→ 항상 shared/ 원본만 수정
백엔드 로더:

backend/app/core/synonyms.py
load_synonym_groups(): lru_cache로 파일 1회만 읽음
Docker build 시 backend/Dockerfile이 shared/를 /app/shared/로 복사
app-migrate 특이사항:

bind mount (./backend:/app)가 /app를 덮어씌우기 때문에
./shared:/app/shared:ro 를 별도로 마운트해서 해결
==================================================
[환경변수 / 설정]
루트 .env:

NEXT_PUBLIC_KAKAO_MAP_API_KEY
SECRET_KEY
ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES
frontend/.env.local:

NEXT_PUBLIC_KAKAO_MAP_API_KEY (로컬 dev용)
backend config.py:

APP_VERSION
DATABASE_URL
SECRET_KEY
ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES
next.config.ts:

output: "standalone"
experimental.externalDir: true (외부 디렉터리 import 허용, shared JSON 관련)
allowedDevOrigins: ["192.168.123.88"] (모바일 로컬 테스트용 예시)
rewrites: /api/:path* → http://localhost/api/:path* (로컬 dev → Docker backend 프록시)
==================================================
[운영 방식]
프론트 개발 방식:

평소 개발: 로컬 npm run dev (localhost:3000)
최종 확인: docker compose up -d --build app-frontend
로컬 dev에서 /api 요청은 next.config.ts의 rewrite로 localhost/api로 프록시
shared 수정 시:

shared/synonym-groups.json만 수정
dev 서버 재시작 또는 npm run copy:shared
모바일 로컬 테스트:

npm run dev -- --hostname 0.0.0.0 --port 3000
같은 네트워크 IP로 접속
next.config.ts의 allowedDevOrigins 설정 필요
단, geolocation은 HTTP 환경에서 제한될 수 있음
==================================================
[백엔드 현재 상태]
User / Auth

POST /signup: 회원가입
POST /login: JWT 로그인
GET /me: 현재 사용자 조회
get_current_user dependency: Bearer 토큰 검증
인증 방식: JWT access token + localStorage + Authorization Bearer 헤더
Sighting

POST /sightings: 회원 전용
post_type별 기본 상태 분기
키워드 매칭 알림 생성
유사 글 매칭 알림 생성 (양방향, SIMILAR_MATCH)
다중 이미지 저장 (image_urls 배열)
GET /sightings: 공개, is_deleted 필터, resolved_at 기준 30일 지난 FOUND 글 메인 숨김
GET /sightings/nearby/search: 공개, is_deleted 필터
GET /sightings/{id}: 공개, is_deleted 필터
GET /my-sightings: 회원 전용, 내 글만, is_deleted 필터
PATCH /sightings/{id}/status: 회원 전용, 작성자 본인만
post_type별 허용 상태 검증
FOUND→되돌리기 사유 필수
resolved_at 관리
댓글 참여자 알림 생성
PATCH /sightings/{id}: 회원 전용, 작성자 본인만
글 수정 (image_urls 배열 포함)
DELETE /sightings/{id}: 회원 전용, 작성자 본인만, 논리 삭제
Comment

POST /sightings/{id}/comments: 회원 전용, 댓글 작성, 글 작성자+댓글 참여자 알림 생성
GET /sightings/{id}/comments: 공개, 최신순
PATCH /comments/{id}: 작성자 전용, 댓글 수정
DELETE /comments/{id}: 작성자 전용, 논리 삭제
Notification

GET /notifications: 회원 전용, 내 알림 목록 (최신순, 최대 50개)
GET /notifications/unread-count: 회원 전용, 안읽은 알림 개수
PATCH /notifications/{id}/read: 회원 전용, 개별 읽음 처리
PATCH /notifications/read-all: 회원 전용, 전체 읽음 처리
Keyword

GET /keywords: 회원 전용, 내 키워드 목록 (활성만)
POST /keywords: 회원 전용, 키워드 등록 (중복 체크, 최대 20개)
DELETE /keywords/{id}: 회원 전용, 키워드 비활성화 (논리 삭제)
Upload

POST /upload/image: 회원 전용, UUID 파일명, 이미지만, 10MB 제한
Health

GET /health: 상태/버전 확인
Static Files

/uploads → FastAPI StaticFiles 서빙
uploads-data Docker named volume으로 blue/green 공유
==================================================
[백엔드 모델 상태]
User:

id, email, hashed_password, nickname, phone, is_active, created_at, updated_at
Sighting:

id, user_id(FK), animal_type, description
image_url (첫 번째 이미지 레거시 호환용, nullable)
latitude, longitude, address
status (default="SPOTTED")
post_type (default="SIGHTING", nullable=False)
is_deleted (default=False, nullable=False)
resolved_at (nullable=True)
reopen_reason (nullable=True)
reopen_detail (nullable=True)
created_at, updated_at
user relationship (lazy="joined")
images relationship → SightingImage (lazy="selectin", cascade="all, delete-orphan")
SightingImage: ← 새로 추가

id, sighting_id(FK), image_url, sort_order, created_at
sighting relationship
Comment:

id, sighting_id(FK), user_id(FK)
content (nullable=True), image_url (nullable=True)
is_deleted (default=False)
created_at, updated_at
user relationship (lazy="joined")
sighting relationship (lazy="joined")
Notification:

id, user_id(FK), type, sighting_id(FK nullable), comment_id(FK nullable)
actor_id(FK nullable), message, is_read (default=False)
created_at
user relationship (foreign_keys=[user_id])
actor relationship (foreign_keys=[actor_id])
KeywordSubscription:

id, user_id(FK), keyword, is_active (default=True), created_at
user relationship (lazy="joined")
==================================================
[백엔드 스키마 상태]
SightingCreate:

animal_type, description, latitude, longitude, address
image_url: Optional[str] (레거시 호환)
image_urls: Optional[List[str]] (신규, 우선 사용)
post_type: Literal["SIGHTING", "LOST"] = "SIGHTING"
SightingUpdate:

animal_type, description, latitude, longitude, address (모두 Optional)
image_url: Optional[str] (레거시 호환)
image_urls: Optional[List[str]] (신규, 우선 사용)
SightingResponse:

id, user_id, user_nickname, animal_type, description
image_url: Optional[str] (첫 번째 이미지, 레거시 호환)
image_urls: List[str] (전체 이미지 목록)
latitude, longitude, address, status, post_type
resolved_at, reopen_reason, reopen_detail
created_at, updated_at
==================================================
[다중 이미지 현재 상태]
구조:

sighting_image 테이블: id, sighting_id(FK), image_url, sort_order, created_at
Sighting.images → SightingImage 관계 (lazy="selectin")
Sighting.image_url → 첫 번째 이미지 (레거시 호환용 유지)
처리 흐름:

생성/수정 시: image_urls 우선, 없으면 image_url 폴백
조회 시: sighting_image 테이블 우선, 없으면 image_url 폴백
응답: image_url(첫 번째) + image_urls(전체) 둘 다 내려줌
프론트 현황:

등록 페이지: 최대 5장, 순차 업로드, EXIF는 첫 번째 파일 기준
수정 페이지: 기존 이미지 개별 제거 + 새 이미지 추가 (최대 5장)
상세 모달: 대표 이미지(큰 이미지) + 썸네일 가로 목록
2장 이상일 때만 썸네일 표시
썸네일 클릭 시 대표 이미지 교체
대표 이미지 클릭 시 풀스크린 (모달 유지)
목록 썸네일: image_url 기준 (서버가 첫 번째 이미지로 보장)
기존 데이터 호환:

Alembic migration에서 기존 image_url → sighting_image로 backfill 완료
==================================================
[유사 글 매칭 알림 현재 상태]
트리거:

POST /sightings (새 글 등록 시점만)
매칭 조건:

반대 post_type끼리만 (LOST ↔ SIGHTING)
동일 animal_type
3km 이내
is_deleted = False
status != "FOUND"
자기 자신(작성자) 제외
최대 3개 후보
정렬 기준:

공통 특징 키워드 많은 순
가까운 순
최신 순
양방향 알림:

새 글 작성자 → 기존 매칭 글 방향 알림
기존 글 작성자 → 새 글 방향 알림
같은 사용자에게 중복 알림 방지
알림 타입: SIMILAR_MATCH

알림 메시지 예시:

새 글 작성자: "등록한 목격 글과 유사한 실종 글이 약 500m 거리에서 확인되었습니다. (공통 특징: 치즈)"
기존 글 작성자: "내 실종 글과 유사한 새 목격 글이 약 500m 거리에서 등록되었습니다. (공통 특징: 치즈)"
특징 키워드 추출:

shared/synonym-groups.json의 각 그룹 대표어(첫 번째 단어)를 기준
텍스트(description)에 대표어 포함 여부로 매칭
현재 한계 (2차 예정):

새 글 등록 시점만 동작 (글 수정/상태변경 시 재매칭 없음)
프론트 동의어 정규화와 100% 동일하지는 않음 (대표어 포함 검색)
완전한 중복 이력 테이블 없음
관련 파일:

backend/app/core/synonyms.py: shared JSON 로더
backend/app/core/similar_sightings.py: 유사 글 매칭 helper
backend/app/api/sighting.py: create_sighting에서 호출
==================================================
[알림 시스템 현재 상태]
알림 타입 4종:

NEW_COMMENT (💬 새 댓글)

내 글에 다른 사람이 댓글 → 글 작성자에게
내가 참여한 글에 다른 사람이 댓글 → 댓글 참여자들에게
자기 자신 제외, 글 작성자/참여자 중복 시 1개만
STATUS_CHANGED (🔄 상태 변경)

참여한 글의 상태가 변경됨 → 댓글 참여자들에게
글 작성자(변경한 본인) 제외
KEYWORD_MATCH (🔍 키워드 매칭)

새 글 등록 시 address + description에서 키워드 포함 검색
매칭되면 해당 키워드 등록자에게
글 작성자 본인 제외, 같은 사용자 중복 방지
SIMILAR_MATCH (🧩 유사 글 매칭) ← 새로 추가

새 글 등록 시 반대 타입 유사 글 탐지
양방향 알림 (새 글 작성자 + 기존 글 작성자)
알림 유틸 (core/notifications.py):

get_comment_participants(): 댓글 참여자 목록
create_notification(): 1명에게 알림 생성 (사용자별 다른 sighting_id 지원)
create_notifications(): 여러 사용자에게 동일 알림 생성 (자기 자신 제외)
프론트 알림 UI:

헤더 🔔 아이콘 + 안읽은 개수 빨간 뱃지
30초 폴링 + 창 포커스 복귀 시 재조회
/notifications 알림 목록 페이지
안읽은 알림 파란 배경 강조
개별 읽음 / 전체 읽음 버튼
타입별 아이콘/라벨 (4종 모두 지원)
알림 클릭 → 읽음 처리 + 해당 글 모달 자동 열기
==================================================
[Alembic / DB 상태]
Alembic 실행 방식:
docker compose --profile migrate run --rm app-migrate alembic [command]

Migration history:

57c8470ec23f: create sighting table
c4dfdae3e79e: create user table
b701f74545db: add user_id to sighting (빈 migration)
b81127cb6c13: add user_id to sighting (실제 반영)
c13ac725aea0: add post_type to sighting
37410d06cfc9: add is_deleted to sighting
(comment table 생성)
(notification table 생성)
(resolved_at, reopen_reason, reopen_detail 추가)
(keyword_subscription table 생성)
(sighting_image table 생성 + 기존 데이터 backfill)
==================================================
[프론트 타입 현재 상태 (types/sighting.ts)]
Sighting:

id, user_id, user_nickname, animal_type, description
image_url: string | null (첫 번째 이미지, 레거시 호환)
image_urls: string[] ← 새로 추가
latitude, longitude, address, status, post_type
resolved_at, reopen_reason, reopen_detail
created_at, updated_at
ClusterInfo:

center, markers
CurrentUser:

id, email, nickname, phone, is_active, created_at, updated_at
Comment:

id, sighting_id, user_id, user_nickname, content, image_url, created_at, updated_at
Notification:

id, user_id, type, sighting_id, comment_id, actor_id, actor_nickname
message, is_read, created_at
KeywordSubscription:

id, user_id, keyword, is_active, created_at
==================================================
[주요 트러블슈팅 이력 (5차 추가분)]

Next.js 프로덕션 빌드에서 useSearchParams Suspense 에러
→ Home 컴포넌트를 HomeContent + Suspense wrapper로 분리
frontend 외부 JSON import 불가 (Turbopack)
→ shared/ 원본 + frontend/shared/ 복사본 구조로 해결
→ copy-shared.mjs + predev/prebuild 훅으로 자동화
app-migrate bind mount가 /app/shared를 가림
→ ./shared:/app/shared:ro 별도 마운트로 해결
백엔드 build context가 ./backend라 shared/를 못 봄
→ backend Dockerfile을 루트 context 기준으로 변경
이미지 클릭 시 상세 모달까지 같이 닫히는 버그
→ onImageClick에서 setDetailSighting(null) 제거
==================================================
[현재 서비스 정책]
조회: 비회원 가능
신고 등록: 회원만 (다중 이미지 최대 5장)
이미지 업로드: 회원만
상태 변경: 회원 전용, 작성자 본인만
글 수정: 회원 전용, 작성자 본인만 (다중 이미지 편집 포함)
글 삭제: 회원 전용, 작성자 본인만 (논리 삭제)
댓글 작성: 회원만
댓글 수정/삭제: 작성자 본인만
알림: 회원 전용
키워드: 회원 전용, 최대 20개

상태 정책:

SPOTTED: 목격 (기본값, 목격 글)
LOST: 실종 (기본값, 실종 글)
PROTECTING: 보호 중
FOUND: 찾음
FOUND 기본 숨김 + "찾음 포함 보기" 토글
FOUND 30일 후 메인 목록에서 보관
FOUND 되돌리기 시 사유 필수
==================================================
[현재 사용 중인 주요 명령]
백엔드 재빌드:
docker compose up -d --build app-blue

프론트 Docker 빌드:
docker compose up -d --build app-frontend

프론트 로컬 개발:
cd frontend
npm run dev

shared 수동 복사:
cd frontend
npm run copy:shared

Alembic:
docker compose --profile migrate run --rm app-migrate alembic current
docker compose --profile migrate run --rm app-migrate alembic upgrade head

백엔드 shared JSON 로더 테스트:
docker compose exec app-blue python -c "from app.core.synonyms import load_synonym_groups; data = load_synonym_groups(); print(len(data)); print(data[0][:3])"

Blue 기본 상태 복귀:
.\reset.ps1

==================================================
[사용자가 넣고 싶어 하는 기능들]
O 검색 기능 (완료)
O 오른쪽에 신고 목록 (완료)
O 주소 클릭 → 카카오맵 연동 (완료)
O 찾는 사람도 게시글을 올려서 찾을 수 있게 (실종 글 완료)
O 키워드 설정 시 알림 (완료)
O 게시글에 대한 댓글 (완료)
O 찾으면 기록으로 변경, 실시간 글 중심 (보관 정책 완료)
O 게시글 다중 이미지 (완료)
O 비슷한 글 매칭 알림 (1차 완료)
채팅 기능
비슷한 글 카테고리 묶기
묶인 글 위치 이동 흐름 보여주기
이미지 검색
찾음 30일 후 자동 배치 (정책 적용됨, 배치는 미구현)
유사 글 매칭 알림 2차 고도화
shared JSON watch 자동화

==================================================
[장기 목표 / 개발 로드맵]
다음 1순위 후보:

마이페이지 고도화

내 글 검색/필터
보관 포함 보기
내 댓글 보기
유사 글 매칭 알림 2차

글 수정/상태변경 시 재매칭
프론트 동의어 정규화와 완전 통일
중복 알림 이력 테이블
shared JSON watch 자동화

dev 서버 켜진 상태에서 shared 수정 시 자동 복사
chokidar-cli 또는 Node watch 스크립트
중기:

채팅 기능
같은 동물 묶기 (case)
이동 경로 시각화
장기:

이미지 기반 유사 검색
CI/CD 고도화
HTTPS 적용
브라우저 Push Notification (HTTPS 이후)
현재 위치 지도 표시 (HTTPS 이후)
==================================================
[중요한 작업 원칙]

천천히, 한 단계씩 진행할 것
추측하지 말 것
정보가 부족하면 먼저 파일/상태를 물어볼 것
코드 수정 시: 왜 바꾸는지 / 무엇이 좋아지는지 / 대안은 무엇인지 설명
에러가 나면: 에러 의미 / 원인 / 보편적 해결법 설명
한 번에 너무 많은 변경을 제안하지 말 것
자연스럽고 친절한 "자비스" 같은 톤으로 대화
현재 프로젝트는 로컬 Docker 중심이며 AWS는 사용하지 않음
현재 구조를 존중하면서 점진적으로 개선할 것
대화가 길어지면 상세 인계 문서를 정리해줄 것
커밋/푸시는 의미 있는 작업 단위가 끝났을 때 추천
커밋/푸시 타이밍도 같이 알려줄 것
==================================================
[새 채팅에서 먼저 해줬으면 하는 진행 방식]

먼저 현재 작업 상태를 짧게 확인
마지막 커밋/푸시 상태
미커밋 변경사항이 남아 있는지
추측하지 말고 실제 파일 상태를 먼저 확인
한 번에 너무 많이 하지 말고 한 단계씩
프론트 개발은 로컬 npm run dev 기준으로 진행
대화가 다시 길어지면 상세 인계 문서를 다시 정리해줄 것
==================================================
[짧은 한 줄 요약]
현재 멍냥신고 프로젝트는 로컬 Docker 환경에서 JWT 인증, 회원가입/로그인, 지도 기반 목격/실종 등록(현재 위치 자동 감지, 역지오코딩, EXIF GPS 추출, 다중 이미지 업로드 최대 5장), 반응형 메인 화면(PC 좌우분할 + 모바일 바텀시트), 동물 종류/상태 필터, FOUND 기본 숨김 + 30일 보관 정책 + 되돌리기 사유, 동의어 정규화 포함 키워드 검색 + 하이라이트, 상태 변경(작성자 전용, post_type별 허용 상태, FOUND 되돌리기 사유 필수), 글 수정(작성자 전용, 다중 이미지 편집 포함), 논리 삭제, 댓글(작성/조회/수정/삭제/이미지, 최신순), 알림 시스템(댓글 알림 + 상태 변경 알림 + 키워드 매칭 알림 + 유사 글 매칭 알림 양방향, 헤더 뱃지, 알림 페이지, 읽음 처리, 알림 클릭→모달 자동 열기), 관심 키워드 등록/관리, 상세 모달(미니 지도 + 다중 이미지 썸네일 + 관련 글 추천 + 댓글 + 기록 정보 + 수정/삭제), 마이페이지(내 글 목록 + 상세 모달 + 키워드 관리), shared/synonym-groups.json 단일 원본 기반 동의어 관리(프론트 자동 복사 + 백엔드 Docker 복사), UTC→한국 시간 보정, 수정됨 표시, 보관 예정 안내까지 완료된 상태이며, 다음으로는 마이페이지 고도화 또는 유사 글 매칭 2차 또는 채팅 기능을 단계적으로 시작하는 것이 가장 자연스럽다.

==================================================
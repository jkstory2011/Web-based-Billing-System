# admin-web (관리자용 청구 시스템 프론트엔드) 설계

## 배경 및 범위

`docs/superpowers/specs/2026-07-09-customer-contract-invoice-mvp-design.md`에서 정의한 백엔드 API(`apps/api`)가 완료되어 실제 DB 기준으로 검증됐다. 이 문서는 그 위에 올라갈 두 개의 React SPA 중 관리자용(`admin-web`)의 설계를 다룬다. 고객용(`portal-web`)은 별도 후속 설계로 다룬다.

**포함 (MVP)**
- 관리자 로그인
- 고객 목록/상세/생성/수정, 고객 포털 계정 발급
- 계약 목록/상세/생성, 정액항목(recurring item) 추가, 건별청구(adhoc charge) 추가
- 청구서 기간별 미리보기 → 일괄 생성
- 청구서 목록/상세 조회, PDF 다운로드, 발행(PDF 생성+메일 발송)

**제외 (비목표)**
- 사용자·권한 관리 화면 — `AdminUser`는 현재 seed 스크립트로만 생성되고 CRUD API가 없다. 이 화면을 만들려면 백엔드 API 신설이 선행되어야 하므로 별도 후속 과제로 미룬다.
- 결제(PG) 연동, 미수금/연체 관리, 매출 대시보드 — 상위 스펙에서 이미 비목표로 명시됨.
- `portal-web` (고객 포털 프론트) — 별도 설계.
- e2e 테스트(Playwright) — 후속 과제.

## 아키텍처

모노레포에 `apps/admin-web` 워크스페이스를 추가한다.

```
apps/
├── api/          (기존)
└── admin-web/
    ├── src/
    │   ├── app/          # 라우터, 앱 셸, 레이아웃, ProtectedRoute
    │   ├── features/
    │   │   ├── auth/      # 로그인 폼, AuthContext
    │   │   ├── customers/
    │   │   ├── contracts/
    │   │   └── invoices/
    │   ├── components/    # shadcn/ui 기반 공용 컴포넌트
    │   └── lib/            # api client(fetch/axios wrapper), 타입
    └── vite.config.ts
```

**기술 스택**
- 빌드: Vite + React + TypeScript
- UI: shadcn/ui + Tailwind CSS
- 서버 상태: TanStack Query (목록/상세 캐싱·리페치)
- 라우팅: React Router, 로그인 가드용 `ProtectedRoute`
- 폼: react-hook-form + zod (클라이언트 검증; 서버 DTO 검증과는 별도로 프론트에도 스키마 정의)
- 테스트: Vitest + React Testing Library, MSW로 API 목킹

기능(feature) 폴더 구조가 백엔드 도메인(`auth`, `customers`, `contracts`, `invoices`)과 1:1 대응하도록 구성한다.

## 인증 및 데이터 흐름

백엔드의 실제 구현(`apps/api/src/auth/admin-auth.service.ts`)은 상위 스펙에 있던 "refresh token + httpOnly 쿠키" 방식이 아니라 **8시간 만료 access token을 응답 바디로 반환**하는 단순한 방식이다. 프론트는 이 실제 구현에 맞춘다.

- 로그인 성공 시 `accessToken`을 `localStorage`에 저장하고, 디코딩한 `role`을 `AuthContext`에 보관한다.
- API 클라이언트가 모든 요청에 `Authorization: Bearer <token>` 헤더를 자동 첨부한다.
- 401 응답을 받으면 토큰을 삭제하고 `/login`으로 리다이렉트한다. 백엔드가 refresh token을 지원하지 않으므로 자동 재발급 로직은 없다 — 8시간 후에는 재로그인이 필요하다.
- `ProtectedRoute`가 `/login`을 제외한 모든 라우트를 감싸 토큰 없으면 리다이렉트한다.
- TanStack Query로 리소스별 fetch를 관리하고, 쿼리 레벨에서 401을 감지해 로그아웃을 트리거한다.

## 백엔드 추가 작업

현재 `admin/invoices` 컨트롤러(`apps/api/src/invoices/invoices.controller.ts`)에는 `preview`/`generate`/`issue`만 있고, 발행된 청구서를 다시 조회하는 API가 없다 (고객 포털용 `portal/invoices`에는 `GET`/`GET :id/pdf`가 이미 있다 — 동일 패턴을 관리자용에도 적용한다).

이번 계획에서 다음 엔드포인트를 신설한다:
- `GET /admin/invoices` — 목록 (상태/기간 필터; 페이지네이션은 이번 범위에서 제외하고 단순 리스트로 시작)
- `GET /admin/invoices/:id` — 상세 (라인아이템 포함)
- `GET /admin/invoices/:id/pdf` — PDF 다운로드

Roles는 기존 `admin/invoices` 컨트롤러와 동일하게 `ACCOUNTING`, `ADMIN`만 허용한다.

## 권한(Role) 기반 UI

백엔드 권한 매트릭스(상위 스펙 참조, 각 컨트롤러의 `@Roles(...)` 데코레이터로 이미 강제됨)를 프론트 UI 레벨에서도 반영해 숨김/비활성화 처리한다. 백엔드 가드가 최종 방어선이고, 프론트 처리는 UX 목적이다.

| 화면/액션 | SALES | ACCOUNTING | ADMIN |
|---|---|---|---|
| 고객/계약 등록·수정 버튼 | 표시 | 숨김(조회만) | 표시 |
| 건별청구 입력 | 표시 | 표시 | 표시 |
| 청구서 생성/발행 메뉴 | 숨김 | 표시 | 표시 |

로그인한 `role`을 `AuthContext`에서 읽어 각 페이지/버튼에서 조건부 렌더링한다.

## 에러 처리

- API 에러(4xx/5xx)는 공용 `ApiError` 타입으로 파싱한다.
- 서버 검증 실패(400, 예: 정액항목/건별청구 등록)는 필드 단위로 폼 에러에 매핑한다.
- 그 외 에러(401 제외, 401은 위 인증 흐름에서 별도 처리)는 전역 토스트로 표시한다.

## 테스트 전략

- Vitest + React Testing Library로 컴포넌트/훅 단위 테스트.
- MSW로 `apps/api` 응답을 목킹해 네트워크 의존 없이 테스트.
- 이번 계획에서는 핵심 플로우 위주로 커버: 로그인, 고객/계약 등록, 청구서 생성→발행.
- e2e(Playwright)는 범위 밖 — 후속 과제.

## 기술 스택 요약

- Frontend: React + TypeScript, Vite, shadcn/ui + Tailwind, TanStack Query, React Router, react-hook-form + zod
- Backend 추가: NestJS `admin/invoices` 컨트롤러에 `GET` 3종 추가 (기존 서비스 재사용, 신규 서비스 로직 최소화)

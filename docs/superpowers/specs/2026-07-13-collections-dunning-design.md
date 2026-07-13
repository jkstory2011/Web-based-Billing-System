# 채권추심(연체 관리) 고도화 설계

## 배경 및 범위

`docs/superpowers/specs/2026-07-09-customer-contract-invoice-mvp-design.md`의 비목표 항목 중 "미수금/연체 관리"는 1차로 `feat(admin-web): add overdue invoice (미수금) management page`(연체 목록 조회)와 `feat: add manual overdue-reminder emails`(1회성 수동 알림)로 최소 구현됐다. 이 문서는 그 위에 정식 채권추심 플로우를 얹는 두 번째 단계를 다룬다.

PG(결제) 연동은 이 설계의 범위 밖이다 — `Invoice.status`는 여전히 `DRAFT`/`SENT`만 실제로 도달 가능하고, "연체"는 `SENT` + `dueDate` 경과로 판단하는 기존 방식을 그대로 쓴다.

**포함**
- 연체일수 기준 단계별 독촉(1차/2차/최종통보), 관리자가 수동으로 발송 트리거
- 독촉 발송 이력의 영구 저장 및 조회
- 고객 단위 담당자(collection owner) 지정
- 고객 단위 + 청구서 단위 자유 텍스트 메모(추심 상태는 고정 값 없이 메모로 기록)
- 연체 자산 에징(aging) 리포트: 고객별 30/60/90/90+일 구간 집계, 그리고 기존 연체 목록에 연체일수 컬럼/필터 추가

**제외 (비목표)**
- PG 결제 연동, 자동 결제 확인에 따른 `PAID` 전이 — 별도 후속 설계
- 독촉 이메일의 자동/예약 발송(cron) — 기존 철학(관리자 트리거 방식)을 유지, 전부 수동 버튼 클릭
- 고정된 추심 상태 값(워크플로 상태 머신) — 자유 텍스트 메모로 대체
- 법무/외부 추심업체 이관 등 실제 법적 조치 프로세스 — 메모에 기록하는 것 이상은 범위 밖

## 데이터 모델

`apps/api/prisma/schema.prisma`에 다음을 추가한다.

```prisma
enum ReminderStage {
  FIRST
  SECOND
  FINAL
}

model Customer {
  // ...기존 필드...
  collectionOwnerId String?
  collectionOwner   AdminUser? @relation("CollectionOwner", fields: [collectionOwnerId], references: [id])
  collectionNotes   CollectionNote[]
}

model CollectionNote {
  id                    String     @id @default(uuid())
  customerId            String
  customer              Customer   @relation(fields: [customerId], references: [id])
  invoiceId             String?
  invoice               Invoice?   @relation(fields: [invoiceId], references: [id])
  authorAdminUserId     String
  authorAdminUser       AdminUser  @relation(fields: [authorAdminUserId], references: [id])
  body                  String
  createdAt             DateTime   @default(now())

  @@index([customerId])
  @@index([invoiceId])
}

model CollectionReminder {
  id                String        @id @default(uuid())
  invoiceId         String
  invoice           Invoice       @relation(fields: [invoiceId], references: [id])
  stage             ReminderStage
  sentAt            DateTime      @default(now())
  sentByAdminUserId String
  sentByAdminUser   AdminUser     @relation(fields: [sentByAdminUserId], references: [id])

  @@index([invoiceId])
}
```

`AdminUser`, `Invoice`에 역방향 관계(`collectionNotes`, `collectionReminders` 등)를 추가한다. `CollectionNote.invoiceId`는 nullable — 고객 전체에 대한 메모면 비우고, 특정 청구서 건에 대한 메모면 채운다.

**권장 단계 판정 로직** (`invoice-reminder.service.ts` 내 순수 함수로 구현, 별도 스펙/테스트 대상):
- 연체일수 < 7일: 권장 단계 없음(독촉 불가 — 기존 "아직 납부기한이 지나지 않았습니다" 규칙 유지)
- 7~29일: 1차(FIRST)
- 30~59일: 2차(SECOND)
- 60일 이상: 최종통보(FINAL)

관리자는 권장 단계 외의 단계도 수동으로 선택해 보낼 수 있다(예: 이미 2차를 보냈지만 다시 1차 문구로 보내고 싶은 경우) — 서버는 순서를 강제하지 않는다.

## 백엔드 API

기존 패턴(`apps/api/src/invoices`, `apps/api/src/customers`)을 따르고, Roles는 기존 재무 관련 엔드포인트와 동일하게 `ACCOUNTING`, `ADMIN`만 허용한다.

- `POST /admin/invoices/:id/remind` (기존 엔드포인트 확장)
  - Body: `{ stage: 'FIRST' | 'SECOND' | 'FINAL' }` (필수로 변경)
  - 기존 검증(청구서 존재, `SENT` 상태, 기한 경과) 유지
  - 발송 성공 시 `CollectionReminder` 레코드 생성. `InvoiceMailer.sendOverdueReminder()`에 `stage` 전달해 단계별 문구 분기 (인터페이스 확장)
  - 응답: 204 (기존과 동일)
- `GET /admin/invoices/:id/reminders` (신규)
  - 해당 청구서의 `CollectionReminder` 이력을 최신순으로 반환 (`stage`, `sentAt`, 보낸 관리자 이메일)
- `PATCH /admin/customers/:id/collection-owner` (신규)
  - Body: `{ adminUserId: string | null }` (null이면 배정 해제)
  - 대상 `adminUserId`가 존재하는 `AdminUser`인지 검증, 없으면 404
- `GET /admin/customers/:id/collection-notes` (신규)
  - 해당 고객의 메모 전체를 최신순으로 반환 (연결된 `invoiceId`가 있으면 포함)
- `POST /admin/customers/:id/collection-notes` (신규)
  - Body: `{ body: string, invoiceId?: string }`. `invoiceId`가 주어지면 해당 청구서가 이 고객 소속인지 검증(다른 고객 청구서를 잘못 태깅하는 것 방지), 아니면 400
- `GET /admin/collections/aging` (신규)
  - `SENT` 상태이고 `dueDate`가 지난 모든 청구서를 고객별로 그룹핑, 오늘 기준 연체일수로 4개 구간(0-30/31-60/61-90/90+)에 합산해 반환
  - 응답 형태: `[{ customerId, customerName, buckets: { d0to30, d31to60, d61to90, d90plus }, totalOverdue, invoiceCount }]`

기존 `GET /admin/invoices` 응답에는 이미 `dueDate`가 포함되어 있으므로, 연체일수 컬럼/필터/정렬은 프론트에서 `dueDate` 기반으로 클라이언트 계산한다 (백엔드 변경 불필요 — 기존 "필터는 클라이언트에서" 관례를 유지).

## 프론트엔드 (admin-web)

- **연체 관리 페이지** (`features/invoices/overdue-invoices-page.tsx`)
  - "연체일수" 컬럼 추가 (정렬 가능), 구간(30/60/90/90+) 필터 추가
  - 각 행: 권장 단계 배지(예: "2차 안내 필요" / 배지 없음이면 아직 독촉 불가) + 단계 선택 후 발송하는 버튼(기존 단일 버튼을 단계 선택 가능한 형태로 교체)
  - 행 확장 또는 상세 링크로 `GET /admin/invoices/:id/reminders` 조회 결과(독촉 이력 타임라인) 표시
- **고객 상세 페이지** (`features/customers/customer-detail-page.tsx`)
  - "담당자" 섹션: 현재 담당 관리자 표시 + 변경 드롭다운 (관리자 목록은 기존에 없다면 간단한 `GET /admin/admin-users` 목록이 필요 — 없으면 이 화면에서 필요한 최소 범위로 추가)
  - "메모" 섹션: 메모 타임라인(작성자, 시각, 연결된 청구서가 있으면 링크) + 새 메모 작성 폼 (전체 메모 vs 특정 청구서 메모 선택 가능)
- **신규 페이지** `/collections/aging` (`features/collections/aging-report-page.tsx`)
  - 고객 × 구간 집계 테이블, 구간별 합계 헤더 행 포함
  - 고객명 클릭 시 해당 고객 상세 페이지로 이동
  - 내비게이션에 "채권 현황" 메뉴 추가 (ACCOUNTING/ADMIN만 노출)

## 관리자 목록 조회 필요성

담당자 지정 드롭다운을 채우려면 `AdminUser` 목록 조회가 필요하다. 현재 `AdminUser`는 CRUD API가 없다(2026-07-11 admin-web 설계 문서의 비목표 항목). 이 설계에서는 전체 CRUD가 아니라 `GET /admin/admin-users` (id, email, role만 반환하는 읽기 전용 목록) 하나만 최소로 추가한다 — `ADMIN` role만 호출 가능.

## 테스트 전략

기존 저장소 컨벤션(실패하는 테스트 먼저 작성 → 구현)을 그대로 따른다.
- 백엔드: 각 서비스(`collection-reminder` 로직 확장, `collection-notes.service`, `customers.service`의 담당자 배정, `collections-aging.service`)에 대한 Jest 단위 테스트 + 컨트롤러 e2e 유사 테스트(기존 `*.service.spec.ts` 패턴)
- 프론트: Vitest + Testing Library + MSW로 각 신규/변경 페이지의 실패 케이스(에러 응답)와 성공 케이스를 모두 커버
- 전체 스위트(`npm test` at repo root 또는 각 workspace)와 두 프론트 빌드가 통과해야 커밋

## 마이그레이션

Prisma 마이그레이션 1개로 `ReminderStage` enum, `CollectionNote`, `CollectionReminder` 테이블, `Customer.collectionOwnerId` 컬럼을 추가한다. 기존 데이터에 영향 없는 추가적(additive) 변경이므로 다운타임 없이 적용 가능하다.

# admin-web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `apps/admin-web`, a React SPA that lets SALES/ACCOUNTING/ADMIN staff log in and drive the existing NestJS API end-to-end: manage customers and contracts, and preview/generate/issue invoices.

**Architecture:** Vite + React 19 + TypeScript SPA added as a new `apps/*` npm workspace, talking to the existing `apps/api` NestJS service over `fetch`. Feature folders (`auth`, `customers`, `contracts`, `invoices`) mirror the backend's domain modules, each with TanStack Query hooks for server state and `*.spec.tsx` tests colocated with the code they cover (matching `apps/api`'s `*.spec.ts` convention).

**Tech Stack:** React 19, TypeScript (strict), Vite 8, Tailwind CSS 4 (`@tailwindcss/vite`), TanStack Query 5, React Router 7, react-hook-form + zod, Vitest + React Testing Library + MSW.

## Global Constraints

- Package manager: npm workspaces. `apps/admin-web` slots into the existing root `workspaces: ["apps/*"]` — no root `package.json` change needed.
- UI components are hand-authored Tailwind components under `src/components/ui/` in the shadcn/ui file/naming style (no shadcn CLI dependency — shadcn/ui is source-you-own by design, so this matches its actual philosophy).
- Tailwind CSS v4's CSS-first config: `@import "tailwindcss";` in `src/index.css` plus the `@tailwindcss/vite` plugin — no `tailwind.config.js`.
- Admin JWT access token is stored in `localStorage` under key `admin_access_token` and attached as `Authorization: Bearer <token>`. The backend (`apps/api/src/auth/admin-auth.service.ts`) has no refresh-token flow — tokens expire after 8h and the user must log in again. Do not build refresh-token logic.
- `apiRequest` does not clear the token itself on a 401. Logout-on-401 is centralized in the TanStack Query `QueryCache.onError` handler (Task 5) so `AuthContext` stays the single source of truth for auth state.
- API base URL comes from `VITE_API_URL` (Vite convention — **not** `NEXT_PUBLIC_*`, this project uses Vite, not Next.js).
- Backend validation errors come back as `{ message: string | string[] }` (Nest's default `ValidationPipe`, no field-keyed errors). The frontend joins array messages into one string and displays them near the form, not per-field.
- Role UI matrix (mirrors the backend's `@Roles(...)` guards — the backend is the real enforcement boundary; hiding controls in the frontend is UX only, not security):

  | 화면/액션 | SALES | ACCOUNTING | ADMIN |
  |---|---|---|---|
  | 고객/계약 등록·수정 버튼 | 표시 | 숨김(조회만) | 표시 |
  | 건별청구 입력 | 표시 | 표시 | 표시 |
  | 청구서 생성/발행 메뉴 | 숨김 | 표시 | 표시 |

- The backend has no CORS configuration today — Task 1 adds it. Nothing in later tasks will work against a locally running API until Task 1 lands.
- Money fields (`Prisma.Decimal`) serialize to JSON as strings — frontend types model `amount`/`totalAmount`/`unitPrice` as `string`, not `number`.

---

### Task 1: Backend — admin invoice list/detail/PDF endpoints + CORS

**Files:**
- Create: `apps/api/src/invoices/invoices-query.service.ts`
- Create: `apps/api/src/invoices/invoices-query.service.spec.ts`
- Modify: `apps/api/src/invoices/invoices.controller.ts`
- Modify: `apps/api/src/invoices/invoices.module.ts`
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/.env.example`

**Interfaces:**
- Produces: `InvoicesQueryService.findAll(): Promise<Invoice[]>` — newest first, each with `contract.customer` included.
- Produces: `InvoicesQueryService.findOne(id: string): Promise<Invoice>` — includes `lineItems` + `contract.customer`; throws `NotFoundException` if missing.
- Produces: `InvoicesQueryService.getLatestPdfPath(invoiceId: string): Promise<string>`; throws `NotFoundException` if the invoice or its PDF doesn't exist.
- Produces: `GET /admin/invoices`, `GET /admin/invoices/:id`, `GET /admin/invoices/:id/pdf` routes, guarded like the rest of `InvoicesController` (`ACCOUNTING`, `ADMIN` only).
- Produces: CORS enabled on the Nest app for the origin in `CORS_ORIGIN` (defaults to `http://localhost:5173`, the Vite dev server).

- [ ] **Step 1: Write the failing test file**

```typescript
// apps/api/src/invoices/invoices-query.service.spec.ts
import { NotFoundException } from '@nestjs/common';
import { InvoicesQueryService } from './invoices-query.service';

describe('InvoicesQueryService', () => {
  function buildService(overrides: any = {}) {
    const prisma = {
      invoice: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      ...overrides,
    } as any;
    return { service: new InvoicesQueryService(prisma), prisma };
  }

  it('lists invoices with contract and customer included, newest first', async () => {
    const { service, prisma } = buildService();

    await service.findAll();

    expect(prisma.invoice.findMany).toHaveBeenCalledWith({
      include: { contract: { include: { customer: true } } },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('throws NotFoundException when the invoice does not exist', async () => {
    const { service } = buildService();

    await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
  });

  it('returns the invoice with line items and customer when found', async () => {
    const invoice = { id: 'invoice-1', lineItems: [], contract: { customer: { name: '고객사' } } };
    const { service, prisma } = buildService({
      invoice: { findUnique: jest.fn().mockResolvedValue(invoice) },
    });

    const result = await service.findOne('invoice-1');

    expect(result).toBe(invoice);
    expect(prisma.invoice.findUnique).toHaveBeenCalledWith({
      where: { id: 'invoice-1' },
      include: { lineItems: true, contract: { include: { customer: true } } },
    });
  });

  it('throws NotFoundException when no PDF has been generated yet', async () => {
    const { service, prisma } = buildService({
      invoice: { findUnique: jest.fn().mockResolvedValue({ id: 'invoice-1', pdfs: [] }) },
    });

    await expect(service.getLatestPdfPath('invoice-1')).rejects.toThrow(NotFoundException);
    expect(prisma.invoice.findUnique).toHaveBeenCalledWith({
      where: { id: 'invoice-1' },
      include: { pdfs: { orderBy: { version: 'desc' }, take: 1 } },
    });
  });

  it('returns the highest-version PDF file path', async () => {
    const { service } = buildService({
      invoice: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'invoice-1',
          pdfs: [{ filePath: '/storage/invoice-1/v2.pdf', version: 2 }],
        }),
      },
    });

    const path = await service.getLatestPdfPath('invoice-1');

    expect(path).toBe('/storage/invoice-1/v2.pdf');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test --workspace=api -- invoices-query.service.spec.ts`
Expected: FAIL — `Cannot find module './invoices-query.service'`

- [ ] **Step 3: Implement `InvoicesQueryService`**

```typescript
// apps/api/src/invoices/invoices-query.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { Invoice } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvoicesQueryService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<Invoice[]> {
    return this.prisma.invoice.findMany({
      include: { contract: { include: { customer: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { lineItems: true, contract: { include: { customer: true } } },
    });
    if (!invoice) {
      throw new NotFoundException('청구서를 찾을 수 없습니다.');
    }
    return invoice;
  }

  async getLatestPdfPath(invoiceId: string): Promise<string> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { pdfs: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!invoice || invoice.pdfs.length === 0) {
      throw new NotFoundException('청구서 PDF를 찾을 수 없습니다.');
    }
    return invoice.pdfs[0].filePath;
  }
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test --workspace=api -- invoices-query.service.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Wire the new routes into the controller**

```typescript
// apps/api/src/invoices/invoices.controller.ts
import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import { JwtAdminAuthGuard } from '../auth/jwt-admin-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminRole } from '../auth/admin-role.enum';
import { InvoiceGenerationService } from './invoice-generation.service';
import { InvoiceIssueService } from './invoice-issue.service';
import { InvoicesQueryService } from './invoices-query.service';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';

@Controller('admin/invoices')
@UseGuards(JwtAdminAuthGuard, RolesGuard)
@Roles(AdminRole.ACCOUNTING, AdminRole.ADMIN)
export class InvoicesController {
  constructor(
    private readonly invoiceGenerationService: InvoiceGenerationService,
    private readonly invoiceIssueService: InvoiceIssueService,
    private readonly invoicesQueryService: InvoicesQueryService,
  ) {}

  @Get()
  findAll() {
    return this.invoicesQueryService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoicesQueryService.findOne(id);
  }

  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const filePath = await this.invoicesQueryService.getLatestPdfPath(id);
    res.sendFile(path.resolve(filePath));
  }

  @Post('preview')
  preview(@Body() dto: GenerateInvoicesDto) {
    return this.invoiceGenerationService.previewGeneration(new Date(dto.periodStart), new Date(dto.periodEnd));
  }

  @Post('generate')
  generate(@Body() dto: GenerateInvoicesDto) {
    return this.invoiceGenerationService.generateInvoices(new Date(dto.periodStart), new Date(dto.periodEnd));
  }

  @Post(':id/issue')
  issue(@Param('id') id: string) {
    return this.invoiceIssueService.issueInvoice(id);
  }
}
```

```typescript
// apps/api/src/invoices/invoices.module.ts
import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoiceGenerationService } from './invoice-generation.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicePdfStorageService } from './invoice-pdf-storage.service';
import { InvoiceIssueService } from './invoice-issue.service';
import { InvoicesQueryService } from './invoices-query.service';
import { INVOICE_MAILER } from './mailer/invoice-mailer.interface';
import { NodemailerInvoiceMailer } from './mailer/nodemailer-invoice-mailer';
import { PortalInvoicesController } from './portal-invoices.controller';
import { PortalInvoicesService } from './portal-invoices.service';

@Module({
  controllers: [InvoicesController, PortalInvoicesController],
  providers: [
    InvoiceGenerationService,
    InvoicePdfService,
    InvoicePdfStorageService,
    InvoiceIssueService,
    InvoicesQueryService,
    PortalInvoicesService,
    { provide: INVOICE_MAILER, useClass: NodemailerInvoiceMailer },
  ],
  exports: [InvoiceGenerationService],
})
export class InvoicesModule {}
```

- [ ] **Step 6: Enable CORS in `main.ts`**

```typescript
// apps/api/src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

- [ ] **Step 7: Document the new env var**

Add to `apps/api/.env.example`:

```env
CORS_ORIGIN="http://localhost:5173"
```

Also add the same line to your local `apps/api/.env` (it's gitignored, so this file must be edited directly — `.env.example` alone won't affect your running server).

- [ ] **Step 8: Run the full backend test suite**

Run: `npm test --workspace=api`
Expected: PASS (11 suites, 42 tests)

- [ ] **Step 9: Confirm the production build still compiles**

Run: `npx nest build --prefix apps/api` — if `--prefix` errors on your `nest` version, run `cd apps/api && npx nest build` instead.
Expected: exits 0, `apps/api/dist/main.js` present

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/invoices apps/api/src/main.ts apps/api/.env.example
git commit -m "feat(api): add admin invoice list/detail/PDF endpoints and enable CORS"
```

---

### Task 2: admin-web workspace scaffold

**Files:**
- Create: `apps/admin-web/package.json`
- Create: `apps/admin-web/tsconfig.json`
- Create: `apps/admin-web/tsconfig.node.json`
- Create: `apps/admin-web/vite.config.ts`
- Create: `apps/admin-web/index.html`
- Create: `apps/admin-web/.env.example`
- Create: `apps/admin-web/src/index.css`
- Create: `apps/admin-web/src/lib/utils.ts`
- Create: `apps/admin-web/src/test/setup.ts`
- Create: `apps/admin-web/src/test/mock-server.ts`
- Create: `apps/admin-web/src/App.tsx`
- Create: `apps/admin-web/src/main.tsx`
- Test: `apps/admin-web/src/App.spec.tsx`

**Interfaces:**
- Produces: `apps/admin-web` npm workspace (auto-included by root `apps/*` glob) that every later task's files live under.
- Produces: `cn(...)` helper in `src/lib/utils.ts`, used by every hand-authored UI component from Task 4 onward.
- Produces: MSW `server` export from `src/test/mock-server.ts`, reused by every feature test from Task 3 onward.

- [ ] **Step 1: Create the workspace config and scaffolding files**

```json
// apps/admin-web/package.json
{
  "name": "admin-web",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "react-router-dom": "^7.18.1",
    "@tanstack/react-query": "^5.101.2",
    "react-hook-form": "^7.81.0",
    "@hookform/resolvers": "^5.4.0",
    "zod": "^4.4.3",
    "jwt-decode": "^4.0.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^6.0.3",
    "@tailwindcss/vite": "^4.3.2",
    "tailwindcss": "^4.3.2",
    "typescript": "^5.9.3",
    "vite": "^8.1.4",
    "vitest": "^4.1.10",
    "jsdom": "^29.1.1",
    "@testing-library/react": "^16.3.2",
    "@testing-library/jest-dom": "^6.9.1",
    "msw": "^2.15.0",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3"
  }
}
```

```json
// apps/admin-web/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] },
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

```json
// apps/admin-web/tsconfig.node.json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

```typescript
// apps/admin-web/vite.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
});
```

```html
<!-- apps/admin-web/index.html -->
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>청구 시스템 관리자</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

```env
# apps/admin-web/.env.example
VITE_API_URL="http://localhost:3000"
```

```css
/* apps/admin-web/src/index.css */
@import "tailwindcss";
```

```typescript
// apps/admin-web/src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

```typescript
// apps/admin-web/src/test/mock-server.ts
import { setupServer } from 'msw/node';

export const server = setupServer();
```

```typescript
// apps/admin-web/src/test/setup.ts
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './mock-server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

- [ ] **Step 2: Install dependencies and create the local env file**

```bash
npm install
cp apps/admin-web/.env.example apps/admin-web/.env
```

- [ ] **Step 3: Write the failing smoke test**

```typescript
// apps/admin-web/src/App.spec.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the admin app title', () => {
    render(<App />);
    expect(screen.getByText('청구 시스템 관리자')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run the test and confirm it fails**

Run: `npm test --workspace=admin-web`
Expected: FAIL — `Cannot find module './App'`

- [ ] **Step 5: Implement `App` and the entry point**

```tsx
// apps/admin-web/src/App.tsx
export function App() {
  return <div className="p-4 text-xl font-semibold">청구 시스템 관리자</div>;
}
```

```tsx
// apps/admin-web/src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 6: Run the test and confirm it passes**

Run: `npm test --workspace=admin-web`
Expected: PASS (1 test)

- [ ] **Step 7: Confirm the production build works**

Run: `npm run build --workspace=admin-web`
Expected: exits 0, `apps/admin-web/dist/index.html` present

- [ ] **Step 8: Commit**

```bash
git add apps/admin-web package-lock.json
git commit -m "feat(admin-web): scaffold Vite + React + Tailwind + Vitest workspace"
```

---

### Task 3: API client and shared domain types

**Files:**
- Create: `apps/admin-web/src/lib/auth-token.ts`
- Create: `apps/admin-web/src/lib/api-client.ts`
- Create: `apps/admin-web/src/lib/api-client.spec.ts`
- Create: `apps/admin-web/src/types/domain.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks beyond the workspace scaffold.
- Produces: `getToken/setToken/clearToken` in `auth-token.ts` — the single place that reads/writes `localStorage`.
- Produces: `apiRequest<T>(path, options?): Promise<T>` and `class ApiError extends Error { status: number }` in `api-client.ts`, used by every feature's API hooks from Task 6 onward.
- Produces: `Customer`, `Contract`, `ContractRecurringItem`, `AdhocCharge`, `Invoice`, `InvoiceLineItem` types in `types/domain.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/admin-web/src/lib/api-client.spec.ts
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { server } from '../test/mock-server';
import { apiRequest, ApiError } from './api-client';
import { clearToken, setToken } from './auth-token';

const API_URL = import.meta.env.VITE_API_URL as string;

describe('apiRequest', () => {
  beforeEach(() => {
    clearToken();
  });

  it('attaches the bearer token when one is stored', async () => {
    setToken('token-123');
    let receivedAuth: string | null = null;
    server.use(
      http.get(`${API_URL}/admin/customers`, ({ request }) => {
        receivedAuth = request.headers.get('authorization');
        return HttpResponse.json([]);
      }),
    );

    await apiRequest('/admin/customers');

    expect(receivedAuth).toBe('Bearer token-123');
  });

  it('makes no authorization header when no token is stored', async () => {
    let receivedAuth: string | null = 'not-checked-yet';
    server.use(
      http.get(`${API_URL}/admin/customers`, ({ request }) => {
        receivedAuth = request.headers.get('authorization');
        return HttpResponse.json([]);
      }),
    );

    await apiRequest('/admin/customers');

    expect(receivedAuth).toBeNull();
  });

  it('throws an ApiError with the joined message on a 400 response', async () => {
    server.use(
      http.post(`${API_URL}/admin/customers`, () =>
        HttpResponse.json(
          { statusCode: 400, message: ['email must be an email', 'name should not be empty'], error: 'Bad Request' },
          { status: 400 },
        ),
      ),
    );

    const error = await apiRequest('/admin/customers', { method: 'POST', body: {} }).catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).message).toBe('email must be an email, name should not be empty');
  });

  it('throws an ApiError with status 401 on an unauthorized response', async () => {
    server.use(
      http.get(`${API_URL}/admin/customers`, () =>
        HttpResponse.json({ statusCode: 401, message: 'Unauthorized' }, { status: 401 }),
      ),
    );

    const error = await apiRequest('/admin/customers').catch((e) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test --workspace=admin-web`
Expected: FAIL — `Cannot find module './api-client'`

- [ ] **Step 3: Implement `auth-token.ts` and `api-client.ts`**

```typescript
// apps/admin-web/src/lib/auth-token.ts
const TOKEN_KEY = 'admin_access_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}
```

```typescript
// apps/admin-web/src/lib/api-client.ts
import { getToken } from './auth-token';

const API_URL = import.meta.env.VITE_API_URL as string;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const rawMessage = payload?.message;
    const message = Array.isArray(rawMessage) ? rawMessage.join(', ') : (rawMessage ?? '요청 처리 중 오류가 발생했습니다.');
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test --workspace=admin-web`
Expected: PASS (5 tests)

- [ ] **Step 5: Add the shared domain types (no test — plain type declarations)**

```typescript
// apps/admin-web/src/types/domain.ts
export type CustomerType = 'INDIVIDUAL' | 'COMPANY';
export type ContractStatus = 'ACTIVE' | 'TERMINATED';
export type RecurringPeriod = 'MONTHLY' | 'QUARTERLY';
export type InvoiceStatus = 'DRAFT' | 'SENT';
export type LineItemSource = 'RECURRING' | 'ADHOC';
export type AdminRole = 'SALES' | 'ACCOUNTING' | 'ADMIN';

export interface Customer {
  id: string;
  type: CustomerType;
  name: string;
  businessRegNo: string | null;
  email: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractRecurringItem {
  id: string;
  contractId: string;
  description: string;
  period: RecurringPeriod;
  amount: string;
  startDate: string;
  endDate: string | null;
}

export interface AdhocCharge {
  id: string;
  contractId: string;
  description: string;
  amount: string;
  occurredOn: string;
  createdByAdminUserId: string;
}

export interface Contract {
  id: string;
  customerId: string;
  startDate: string;
  endDate: string | null;
  status: ContractStatus;
  recurringItems: ContractRecurringItem[];
  adhocCharges: AdhocCharge[];
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: string;
  amount: string;
  source: LineItemSource;
}

export interface Invoice {
  id: string;
  contractId: string;
  periodStart: string;
  periodEnd: string;
  issueDate: string | null;
  dueDate: string;
  status: InvoiceStatus;
  totalAmount: string;
  lineItems?: InvoiceLineItem[];
  contract?: { customer: Customer };
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/admin-web/src/lib apps/admin-web/src/types
git commit -m "feat(admin-web): add API client and shared domain types"
```

---

### Task 4: Auth feature — AuthContext, login page, ProtectedRoute

**Files:**
- Create: `apps/admin-web/src/components/ui/button.tsx`
- Create: `apps/admin-web/src/components/ui/input.tsx`
- Create: `apps/admin-web/src/components/ui/label.tsx`
- Create: `apps/admin-web/src/features/auth/auth-context.tsx`
- Create: `apps/admin-web/src/features/auth/auth-context.spec.tsx`
- Create: `apps/admin-web/src/features/auth/login-page.tsx`
- Create: `apps/admin-web/src/features/auth/login-page.spec.tsx`
- Create: `apps/admin-web/src/features/auth/protected-route.tsx`

**Interfaces:**
- Consumes: `apiRequest`, `ApiError` from `lib/api-client.ts`; `getToken/setToken/clearToken` from `lib/auth-token.ts`; `AdminRole` from `types/domain.ts`; `cn` from `lib/utils.ts`.
- Produces: `AuthProvider`, `useAuth(): { role, isAuthenticated, login(token), logout() }` — used by every later feature and by `app-layout.tsx` (Task 5).
- Produces: `<ProtectedRoute />` (React Router layout route) — used by `router.tsx` (Task 5).
- Produces: `buttonClassName` string export from `button.tsx` — used anywhere a `<Link>` needs to look like a button (Tasks 6, 7).

- [ ] **Step 1: Write the failing test for `AuthContext`**

```tsx
// apps/admin-web/src/features/auth/auth-context.spec.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearToken } from '../../lib/auth-token';
import { AuthProvider, useAuth } from './auth-context';

// header {"alg":"none"}, payload {"sub":"admin-1","role":"ADMIN"}, no signature
const ADMIN_TOKEN = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbi0xIiwicm9sZSI6IkFETUlOIn0.';

function TestConsumer() {
  const { role, isAuthenticated, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="role">{role ?? 'none'}</span>
      <span data-testid="authed">{String(isAuthenticated)}</span>
      <button onClick={() => login(ADMIN_TOKEN)}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => clearToken());

  it('starts unauthenticated when no token is stored', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    expect(screen.getByTestId('authed')).toHaveTextContent('false');
  });

  it('decodes the role from the token on login', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByText('login'));

    expect(screen.getByTestId('role')).toHaveTextContent('ADMIN');
    expect(screen.getByTestId('authed')).toHaveTextContent('true');
  });

  it('clears the role on logout', () => {
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByText('login'));
    fireEvent.click(screen.getByText('logout'));

    expect(screen.getByTestId('role')).toHaveTextContent('none');
    expect(screen.getByTestId('authed')).toHaveTextContent('false');
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test --workspace=admin-web`
Expected: FAIL — `Cannot find module './auth-context'`

- [ ] **Step 3: Add `jwt-decode` dependency check and implement `AuthContext`**

`jwt-decode` was already added to `package.json` in Task 2 — no install needed here.

```tsx
// apps/admin-web/src/features/auth/auth-context.tsx
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { clearToken, getToken, setToken as persistToken } from '../../lib/auth-token';
import type { AdminRole } from '../../types/domain';

interface AdminJwtPayload {
  sub: string;
  role: AdminRole;
}

interface AuthContextValue {
  role: AdminRole | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeRole(token: string): AdminRole | null {
  try {
    return jwtDecode<AdminJwtPayload>(token).role;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<AdminRole | null>(() => {
    const token = getToken();
    return token ? decodeRole(token) : null;
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      role,
      isAuthenticated: role !== null,
      login: (token: string) => {
        persistToken(token);
        setRole(decodeRole(token));
      },
      logout: () => {
        clearToken();
        setRole(null);
      },
    }),
    [role],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test --workspace=admin-web`
Expected: PASS (8 tests total)

- [ ] **Step 5: Write the failing test for `LoginPage`**

```tsx
// apps/admin-web/src/features/auth/login-page.spec.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { AuthProvider, useAuth } from './auth-context';
import { LoginPage } from './login-page';

const API_URL = import.meta.env.VITE_API_URL as string;
const ADMIN_TOKEN = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbi0xIiwicm9sZSI6IkFETUlOIn0.';

function RoleDisplay() {
  const { role } = useAuth();
  return <span data-testid="role">{role ?? 'none'}</span>;
}

describe('LoginPage', () => {
  it('logs in and updates auth state on success', async () => {
    server.use(http.post(`${API_URL}/admin/auth/login`, () => HttpResponse.json({ accessToken: ADMIN_TOKEN })));

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
          <RoleDisplay />
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'change-me-please' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('ADMIN'));
  });

  it('shows the server error message on invalid credentials', async () => {
    server.use(
      http.post(`${API_URL}/admin/auth/login`, () =>
        HttpResponse.json({ statusCode: 401, message: '이메일 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 }),
      ),
    );

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'admin@example.com' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'wrong-password' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));

    await waitFor(() => expect(screen.getByText('이메일 또는 비밀번호가 올바르지 않습니다.')).toBeInTheDocument());
  });
});
```

- [ ] **Step 6: Run the test and confirm it fails**

Run: `npm test --workspace=admin-web`
Expected: FAIL — `Cannot find module './login-page'`

- [ ] **Step 7: Implement the UI primitives and `LoginPage`**

```tsx
// apps/admin-web/src/components/ui/button.tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export const buttonClassName =
  'inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:pointer-events-none disabled:opacity-50';

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => <button ref={ref} className={cn(buttonClassName, className)} {...props} />,
);
Button.displayName = 'Button';
```

```tsx
// apps/admin-web/src/components/ui/input.tsx
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
```

```tsx
// apps/admin-web/src/components/ui/label.tsx
import { type LabelHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium text-slate-700', className)} {...props} />;
}
```

```tsx
// apps/admin-web/src/features/auth/login-page.tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { apiRequest, ApiError } from '../../lib/api-client';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuth } from './auth-context';

const loginSchema = z.object({
  email: z.string().email('올바른 이메일 형식이 아닙니다.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginFormValues) {
    setServerError(null);
    try {
      const { accessToken } = await apiRequest<{ accessToken: string }>('/admin/auth/login', {
        method: 'POST',
        body: values,
      });
      login(accessToken);
      navigate('/', { replace: true });
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : '로그인에 실패했습니다.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto mt-24 w-full max-w-sm space-y-4">
      <h1 className="text-2xl font-semibold">관리자 로그인</h1>
      <div className="space-y-1">
        <Label htmlFor="email">이메일</Label>
        <Input id="email" type="email" {...register('email')} />
        {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="password">비밀번호</Label>
        <Input id="password" type="password" {...register('password')} />
        {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
      </div>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? '로그인 중...' : '로그인'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 8: Run the test and confirm it passes**

Run: `npm test --workspace=admin-web`
Expected: PASS (10 tests total)

- [ ] **Step 9: Implement `ProtectedRoute` (no dedicated test — its redirect behavior is covered end-to-end by Task 5's `App.spec.tsx`)**

```tsx
// apps/admin-web/src/features/auth/protected-route.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './auth-context';

export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
```

- [ ] **Step 10: Commit**

```bash
git add apps/admin-web/src/components apps/admin-web/src/features/auth
git commit -m "feat(admin-web): add AuthContext, login page, and ProtectedRoute"
```

---

### Task 5: App shell, router, and 401-triggered logout

**Files:**
- Create: `apps/admin-web/src/app/query-client.ts`
- Create: `apps/admin-web/src/app/query-client.spec.ts`
- Create: `apps/admin-web/src/app/dashboard-page.tsx`
- Create: `apps/admin-web/src/app/dashboard-page.spec.tsx`
- Create: `apps/admin-web/src/app/app-layout.tsx`
- Create: `apps/admin-web/src/app/app-layout.spec.tsx`
- Create: `apps/admin-web/src/app/router.tsx`
- Create: `apps/admin-web/src/test/render-with-providers.tsx`
- Modify: `apps/admin-web/src/App.tsx`
- Modify: `apps/admin-web/src/App.spec.tsx`

**Interfaces:**
- Consumes: `useAuth`, `AuthProvider`, `ProtectedRoute`, `LoginPage` from Task 4; `ApiError` from Task 3; `Button` from Task 4.
- Produces: `createAppQueryClient(onUnauthorized): QueryClient` — used only in `App.tsx`.
- Produces: `<AppLayout />` with a `<nav>` that later tasks add `<Link>` children into, and a role-aware `<span>{role}</span>` + logout button.
- Produces: `<AppRouter />` — the route tree every later task modifies to add its own routes.
- Produces: `renderWithProviders(ui, { token?, route? })` and role-token constants `SALES_TOKEN`/`ACCOUNTING_TOKEN`/`ADMIN_TOKEN` in `test/render-with-providers.tsx` — used by every feature test from Task 6 onward.

- [ ] **Step 1: Write the failing test for the 401-logout query client**

```typescript
// apps/admin-web/src/app/query-client.spec.ts
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api-client';
import { createAppQueryClient } from './query-client';

describe('createAppQueryClient', () => {
  it('calls onUnauthorized when a query fails with a 401 ApiError', async () => {
    const onUnauthorized = vi.fn();
    const queryClient = createAppQueryClient(onUnauthorized);

    await queryClient
      .fetchQuery({
        queryKey: ['test'],
        queryFn: () => {
          throw new ApiError(401, '인증이 만료되었습니다.');
        },
      })
      .catch(() => undefined);

    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('does not call onUnauthorized for non-401 errors', async () => {
    const onUnauthorized = vi.fn();
    const queryClient = createAppQueryClient(onUnauthorized);

    await queryClient
      .fetchQuery({
        queryKey: ['test-2'],
        queryFn: () => {
          throw new ApiError(500, '서버 오류');
        },
      })
      .catch(() => undefined);

    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test --workspace=admin-web`
Expected: FAIL — `Cannot find module './query-client'`

- [ ] **Step 3: Implement `createAppQueryClient`**

```typescript
// apps/admin-web/src/app/query-client.ts
import { QueryCache, QueryClient } from '@tanstack/react-query';
import { ApiError } from '../lib/api-client';

export function createAppQueryClient(onUnauthorized: () => void): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (error instanceof ApiError && error.status === 401) {
          onUnauthorized();
        }
      },
    }),
    defaultOptions: {
      queries: { retry: false },
    },
  });
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test --workspace=admin-web`
Expected: PASS (12 tests total)

- [ ] **Step 5: Write the failing test for `DashboardPage`**

```tsx
// apps/admin-web/src/app/dashboard-page.spec.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardPage } from './dashboard-page';

describe('DashboardPage', () => {
  it('renders the dashboard heading', () => {
    render(<DashboardPage />);
    expect(screen.getByRole('heading', { name: '청구 시스템 관리자 대시보드' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the test, confirm it fails, then implement `DashboardPage`**

Run: `npm test --workspace=admin-web` — expect FAIL (`Cannot find module './dashboard-page'`)

```tsx
// apps/admin-web/src/app/dashboard-page.tsx
export function DashboardPage() {
  return <h1 className="text-xl font-semibold">청구 시스템 관리자 대시보드</h1>;
}
```

Run: `npm test --workspace=admin-web` — expect PASS (13 tests total)

- [ ] **Step 7: Add the shared test helper**

```tsx
// apps/admin-web/src/test/render-with-providers.tsx
import { type ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../features/auth/auth-context';
import { setToken } from '../lib/auth-token';

export function renderWithProviders(ui: ReactElement, options: { token?: string; route?: string } = {}) {
  if (options.token) {
    setToken(options.token);
  }
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[options.route ?? '/']}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{ui}</AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

// header {"alg":"none"}, payload {"sub":"admin-1","role":"<ROLE>"}, no signature
export const SALES_TOKEN = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbi0xIiwicm9sZSI6IlNBTEVTIn0.';
export const ACCOUNTING_TOKEN = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbi0xIiwicm9sZSI6IkFDQ09VTlRJTkcifQ.';
export const ADMIN_TOKEN = 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbi0xIiwicm9sZSI6IkFETUlOIn0.';
```

- [ ] **Step 8: Write the failing test for `AppLayout`**

```tsx
// apps/admin-web/src/app/app-layout.spec.tsx
import { screen, fireEvent } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, beforeEach } from 'vitest';
import { clearToken } from '../lib/auth-token';
import { renderWithProviders, ADMIN_TOKEN } from '../test/render-with-providers';
import { AppLayout } from './app-layout';

describe('AppLayout', () => {
  beforeEach(() => clearToken());

  it('shows the current role and clears the token on logout', () => {
    renderWithProviders(
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<div>content</div>} />
        </Route>
      </Routes>,
      { token: ADMIN_TOKEN },
    );

    expect(screen.getByText('ADMIN')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '로그아웃' }));

    expect(localStorage.getItem('admin_access_token')).toBeNull();
  });
});
```

- [ ] **Step 9: Run the test, confirm it fails, then implement `AppLayout`**

Run: `npm test --workspace=admin-web` — expect FAIL (`Cannot find module './app-layout'`)

```tsx
// apps/admin-web/src/app/app-layout.tsx
import { Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { Button } from '../components/ui/button';

export function AppLayout() {
  const { logout, role } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <nav className="flex items-center gap-4 text-sm font-medium text-slate-700" />
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>{role}</span>
          <Button onClick={logout} className="bg-slate-200 text-slate-900 hover:bg-slate-300">
            로그아웃
          </Button>
        </div>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
```

Run: `npm test --workspace=admin-web` — expect PASS (14 tests total)

- [ ] **Step 10: Add the router and wire it into `App` (no new dedicated test — covered by the updated `App.spec.tsx` below)**

```tsx
// apps/admin-web/src/app/router.tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/login-page';
import { ProtectedRoute } from '../features/auth/protected-route';
import { AppLayout } from './app-layout';
import { DashboardPage } from './dashboard-page';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

```tsx
// apps/admin-web/src/App.tsx
import { useMemo, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppRouter } from './app/router';
import { createAppQueryClient } from './app/query-client';
import { AuthProvider, useAuth } from './features/auth/auth-context';

function QueryProvider({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const queryClient = useMemo(() => createAppQueryClient(logout), [logout]);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

export function App() {
  return (
    <AuthProvider>
      <QueryProvider>
        <AppRouter />
      </QueryProvider>
    </AuthProvider>
  );
}
```

```tsx
// apps/admin-web/src/App.spec.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('redirects unauthenticated users to the login page', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: '관리자 로그인' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 11: Run the full test suite**

Run: `npm test --workspace=admin-web`
Expected: PASS (14 tests total)

- [ ] **Step 12: Confirm the production build works**

Run: `npm run build --workspace=admin-web`
Expected: exits 0

- [ ] **Step 13: Commit**

```bash
git add apps/admin-web/src/app apps/admin-web/src/test apps/admin-web/src/App.tsx apps/admin-web/src/App.spec.tsx
git commit -m "feat(admin-web): add app shell, router, and 401-triggered logout"
```

---

### Task 6: Customers feature

**Files:**
- Create: `apps/admin-web/src/components/ui/table.tsx`
- Create: `apps/admin-web/src/features/customers/customers-api.ts`
- Create: `apps/admin-web/src/features/customers/customers-list-page.tsx`
- Create: `apps/admin-web/src/features/customers/customers-list-page.spec.tsx`
- Create: `apps/admin-web/src/features/customers/customer-form.tsx`
- Create: `apps/admin-web/src/features/customers/customer-form.spec.tsx`
- Create: `apps/admin-web/src/features/customers/customer-detail-page.tsx`
- Create: `apps/admin-web/src/features/customers/customer-detail-page.spec.tsx`
- Create: `apps/admin-web/src/features/customers/customer-create-page.tsx`
- Create: `apps/admin-web/src/features/customers/customer-edit-page.tsx`
- Modify: `apps/admin-web/src/app/router.tsx`
- Modify: `apps/admin-web/src/app/app-layout.tsx`

**Interfaces:**
- Consumes: `apiRequest`, `ApiError` (Task 3); `Customer`, `CustomerType` (Task 3); `useAuth` (Task 4); `Button`, `buttonClassName`, `Input`, `Label` (Task 4); `renderWithProviders`, `SALES_TOKEN`, `ACCOUNTING_TOKEN` (Task 5).
- Produces: `useCustomers()`, `useCustomer(id)`, `useCreateCustomer()`, `useUpdateCustomer(id)`, `useCreatePortalAccount(id)`, `type CustomerInput` — reused by `contracts-api.ts` in Task 7 (for the customer picker).

- [ ] **Step 1: Write the failing test for the customers list page**

```tsx
// apps/admin-web/src/features/customers/customers-list-page.spec.tsx
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, SALES_TOKEN, ACCOUNTING_TOKEN } from '../../test/render-with-providers';
import { CustomersListPage } from './customers-list-page';

const API_URL = import.meta.env.VITE_API_URL as string;

const customers = [
  {
    id: 'c1',
    type: 'INDIVIDUAL',
    name: '홍길동',
    email: 'hong@example.com',
    phone: '010-1111-2222',
    businessRegNo: null,
    createdAt: '',
    updatedAt: '',
  },
];

describe('CustomersListPage', () => {
  it('renders customers and shows the create link for SALES', async () => {
    server.use(http.get(`${API_URL}/admin/customers`, () => HttpResponse.json(customers)));

    renderWithProviders(<CustomersListPage />, { token: SALES_TOKEN });

    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: '새 고객 등록' })).toBeInTheDocument();
  });

  it('hides the create link for ACCOUNTING (view-only)', async () => {
    server.use(http.get(`${API_URL}/admin/customers`, () => HttpResponse.json(customers)));

    renderWithProviders(<CustomersListPage />, { token: ACCOUNTING_TOKEN });

    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: '새 고객 등록' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test --workspace=admin-web`
Expected: FAIL — `Cannot find module './customers-list-page'`

- [ ] **Step 3: Implement the table primitive, the API hooks, and the list page**

```tsx
// apps/admin-web/src/components/ui/table.tsx
import { type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto rounded-md border border-slate-200">
      <table className={cn('w-full text-left text-sm', className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-slate-50', className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-slate-100', className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('hover:bg-slate-50', className)} {...props} />;
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={cn('px-4 py-2 font-medium text-slate-600', className)} {...props} />;
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-2', className)} {...props} />;
}
```

```typescript
// apps/admin-web/src/features/customers/customers-api.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api-client';
import type { Customer, CustomerType } from '../../types/domain';

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: () => apiRequest<Customer[]>('/admin/customers'),
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: () => apiRequest<Customer>(`/admin/customers/${id}`),
  });
}

export interface CustomerInput {
  type: CustomerType;
  name: string;
  businessRegNo?: string;
  email: string;
  phone?: string;
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CustomerInput) => apiRequest<Customer>('/admin/customers', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
  });
}

export function useUpdateCustomer(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CustomerInput>) =>
      apiRequest<Customer>(`/admin/customers/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers', id] });
    },
  });
}

export function useCreatePortalAccount(customerId: string) {
  return useMutation({
    mutationFn: () =>
      apiRequest<{ email: string; temporaryPassword: string }>(`/admin/customers/${customerId}/portal-account`, {
        method: 'POST',
      }),
  });
}
```

```tsx
// apps/admin-web/src/features/customers/customers-list-page.tsx
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { buttonClassName } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useCustomers } from './customers-api';

const CUSTOMER_TYPE_LABEL: Record<string, string> = { INDIVIDUAL: '개인', COMPANY: '기업' };

export function CustomersListPage() {
  const { role } = useAuth();
  const { data: customers, isLoading, error } = useCustomers();
  const canEdit = role === 'SALES' || role === 'ADMIN';

  if (isLoading) return <p>불러오는 중...</p>;
  if (error) return <p className="text-red-600">고객 목록을 불러오지 못했습니다.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">고객 목록</h1>
        {canEdit && (
          <Link to="/customers/new" className={buttonClassName}>
            새 고객 등록
          </Link>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>이름</TableHead>
            <TableHead>구분</TableHead>
            <TableHead>이메일</TableHead>
            <TableHead>연락처</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers?.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell>
                <Link to={`/customers/${customer.id}`} className="text-slate-900 underline">
                  {customer.name}
                </Link>
              </TableCell>
              <TableCell>{CUSTOMER_TYPE_LABEL[customer.type]}</TableCell>
              <TableCell>{customer.email}</TableCell>
              <TableCell>{customer.phone ?? '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test --workspace=admin-web`
Expected: PASS (16 tests total)

- [ ] **Step 5: Write the failing test for the shared customer form**

```tsx
// apps/admin-web/src/features/customers/customer-form.spec.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CustomerForm } from './customer-form';

describe('CustomerForm', () => {
  it('validates required fields before calling onSubmit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CustomerForm onSubmit={onSubmit} submitLabel="등록" />);

    fireEvent.click(screen.getByRole('button', { name: '등록' }));

    await waitFor(() => expect(screen.getByText('이름을 입력해주세요.')).toBeInTheDocument());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits the entered values', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CustomerForm onSubmit={onSubmit} submitLabel="등록" />);

    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '홍길동' } });
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'hong@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: '등록' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ name: '홍길동', email: 'hong@example.com', type: 'INDIVIDUAL' }),
      ),
    );
  });
});
```

- [ ] **Step 6: Run the test, confirm it fails, then implement `CustomerForm`**

Run: `npm test --workspace=admin-web` — expect FAIL (`Cannot find module './customer-form'`)

```tsx
// apps/admin-web/src/features/customers/customer-form.tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import type { Customer } from '../../types/domain';
import type { CustomerInput } from './customers-api';

const customerSchema = z.object({
  type: z.enum(['INDIVIDUAL', 'COMPANY']),
  name: z.string().min(1, '이름을 입력해주세요.'),
  businessRegNo: z.string().optional(),
  email: z.string().email('올바른 이메일 형식이 아닙니다.'),
  phone: z.string().optional(),
});

interface CustomerFormProps {
  defaultValues?: Partial<Customer>;
  onSubmit: (values: CustomerInput) => Promise<void>;
  submitLabel: string;
  serverError?: string | null;
}

export function CustomerForm({ defaultValues, onSubmit, submitLabel, serverError }: CustomerFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CustomerInput>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      type: defaultValues?.type ?? 'INDIVIDUAL',
      name: defaultValues?.name ?? '',
      businessRegNo: defaultValues?.businessRegNo ?? '',
      email: defaultValues?.email ?? '',
      phone: defaultValues?.phone ?? '',
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-md space-y-4">
      <div className="space-y-1">
        <Label htmlFor="type">구분</Label>
        <select id="type" {...register('type')} className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm">
          <option value="INDIVIDUAL">개인</option>
          <option value="COMPANY">기업</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="name">이름</Label>
        <Input id="name" {...register('name')} />
        {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="businessRegNo">사업자번호</Label>
        <Input id="businessRegNo" {...register('businessRegNo')} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="email">이메일</Label>
        <Input id="email" type="email" {...register('email')} />
        {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="phone">연락처</Label>
        <Input id="phone" {...register('phone')} />
      </div>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? '저장 중...' : submitLabel}
      </Button>
    </form>
  );
}
```

- [ ] **Step 7: Run the test and confirm it passes**

Run: `npm test --workspace=admin-web`
Expected: PASS (18 tests total)

- [ ] **Step 8: Write the failing test for the customer detail page**

```tsx
// apps/admin-web/src/features/customers/customer-detail-page.spec.tsx
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, SALES_TOKEN } from '../../test/render-with-providers';
import { CustomerDetailPage } from './customer-detail-page';

const API_URL = import.meta.env.VITE_API_URL as string;

const customer = {
  id: 'c1',
  type: 'INDIVIDUAL',
  name: '홍길동',
  email: 'hong@example.com',
  phone: null,
  businessRegNo: null,
  createdAt: '',
  updatedAt: '',
};

describe('CustomerDetailPage', () => {
  it('issues a portal account and shows the temporary credentials', async () => {
    server.use(
      http.get(`${API_URL}/admin/customers/c1`, () => HttpResponse.json(customer)),
      http.post(`${API_URL}/admin/customers/c1/portal-account`, () =>
        HttpResponse.json({ email: 'hong@example.com', temporaryPassword: 'temp-pass-123' }),
      ),
    );

    renderWithProviders(
      <Routes>
        <Route path="/customers/:id" element={<CustomerDetailPage />} />
      </Routes>,
      { token: SALES_TOKEN, route: '/customers/c1' },
    );

    await waitFor(() => expect(screen.getByRole('heading', { name: '홍길동' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '포털 계정 발급' }));

    await waitFor(() => expect(screen.getByText(/temp-pass-123/)).toBeInTheDocument());
  });
});
```

- [ ] **Step 9: Run the test, confirm it fails, then implement `CustomerDetailPage`, `CustomerCreatePage`, `CustomerEditPage`**

Run: `npm test --workspace=admin-web` — expect FAIL (`Cannot find module './customer-detail-page'`)

```tsx
// apps/admin-web/src/features/customers/customer-detail-page.tsx
import { Link, useParams } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../auth/auth-context';
import { Button, buttonClassName } from '../../components/ui/button';
import { useCreatePortalAccount, useCustomer } from './customers-api';

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { role } = useAuth();
  const { data: customer, isLoading, error } = useCustomer(id!);
  const createPortalAccount = useCreatePortalAccount(id!);
  const [portalResult, setPortalResult] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const canEdit = role === 'SALES' || role === 'ADMIN';

  if (isLoading) return <p>불러오는 중...</p>;
  if (error || !customer) return <p className="text-red-600">고객 정보를 불러오지 못했습니다.</p>;

  return (
    <div className="max-w-md space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{customer.name}</h1>
        {canEdit && (
          <Link to={`/customers/${id}/edit`} className={buttonClassName}>
            정보 수정
          </Link>
        )}
      </div>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">이메일</dt>
          <dd>{customer.email}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">연락처</dt>
          <dd>{customer.phone ?? '-'}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">사업자번호</dt>
          <dd>{customer.businessRegNo ?? '-'}</dd>
        </div>
      </dl>
      {canEdit && (
        <Button
          onClick={() => createPortalAccount.mutate(undefined, { onSuccess: (result) => setPortalResult(result) })}
          disabled={createPortalAccount.isPending}
        >
          {createPortalAccount.isPending ? '발급 중...' : '포털 계정 발급'}
        </Button>
      )}
      {portalResult && (
        <p className="rounded-md bg-slate-100 p-3 text-sm">
          포털 이메일: {portalResult.email} / 임시 비밀번호: {portalResult.temporaryPassword}
        </p>
      )}
    </div>
  );
}
```

```tsx
// apps/admin-web/src/features/customers/customer-create-page.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../lib/api-client';
import { CustomerForm } from './customer-form';
import { useCreateCustomer } from './customers-api';

export function CustomerCreatePage() {
  const navigate = useNavigate();
  const createCustomer = useCreateCustomer();
  const [serverError, setServerError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">새 고객 등록</h1>
      <CustomerForm
        submitLabel="등록"
        serverError={serverError}
        onSubmit={async (values) => {
          setServerError(null);
          try {
            const customer = await createCustomer.mutateAsync(values);
            navigate(`/customers/${customer.id}`);
          } catch (error) {
            setServerError(error instanceof ApiError ? error.message : '등록에 실패했습니다.');
          }
        }}
      />
    </div>
  );
}
```

```tsx
// apps/admin-web/src/features/customers/customer-edit-page.tsx
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../lib/api-client';
import { CustomerForm } from './customer-form';
import { useCustomer, useUpdateCustomer } from './customers-api';

export function CustomerEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: customer, isLoading } = useCustomer(id!);
  const updateCustomer = useUpdateCustomer(id!);
  const [serverError, setServerError] = useState<string | null>(null);

  if (isLoading || !customer) return <p>불러오는 중...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">고객 정보 수정</h1>
      <CustomerForm
        defaultValues={customer}
        submitLabel="저장"
        serverError={serverError}
        onSubmit={async (values) => {
          setServerError(null);
          try {
            await updateCustomer.mutateAsync(values);
            navigate(`/customers/${id}`);
          } catch (error) {
            setServerError(error instanceof ApiError ? error.message : '수정에 실패했습니다.');
          }
        }}
      />
    </div>
  );
}
```

- [ ] **Step 10: Run the test and confirm it passes**

Run: `npm test --workspace=admin-web`
Expected: PASS (19 tests total)

- [ ] **Step 11: Wire the new routes and nav link**

```tsx
// apps/admin-web/src/app/router.tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/login-page';
import { ProtectedRoute } from '../features/auth/protected-route';
import { CustomerCreatePage } from '../features/customers/customer-create-page';
import { CustomerDetailPage } from '../features/customers/customer-detail-page';
import { CustomerEditPage } from '../features/customers/customer-edit-page';
import { CustomersListPage } from '../features/customers/customers-list-page';
import { AppLayout } from './app-layout';
import { DashboardPage } from './dashboard-page';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/customers" element={<CustomersListPage />} />
            <Route path="/customers/new" element={<CustomerCreatePage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/customers/:id/edit" element={<CustomerEditPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

```tsx
// apps/admin-web/src/app/app-layout.tsx
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { Button } from '../components/ui/button';

export function AppLayout() {
  const { logout, role } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <nav className="flex items-center gap-4 text-sm font-medium text-slate-700">
          <Link to="/customers">고객</Link>
        </nav>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>{role}</span>
          <Button onClick={logout} className="bg-slate-200 text-slate-900 hover:bg-slate-300">
            로그아웃
          </Button>
        </div>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 12: Run the full test suite and confirm the build works**

Run: `npm test --workspace=admin-web` — expect PASS (19 tests total)
Run: `npm run build --workspace=admin-web` — expect exit 0

- [ ] **Step 13: Commit**

```bash
git add apps/admin-web/src/components/ui/table.tsx apps/admin-web/src/features/customers apps/admin-web/src/app/router.tsx apps/admin-web/src/app/app-layout.tsx
git commit -m "feat(admin-web): add customers list, detail, create, and edit pages"
```

---

### Task 7: Contracts feature

**Files:**
- Create: `apps/admin-web/src/features/contracts/contracts-api.ts`
- Create: `apps/admin-web/src/features/contracts/contracts-list-page.tsx`
- Create: `apps/admin-web/src/features/contracts/contracts-list-page.spec.tsx`
- Create: `apps/admin-web/src/features/contracts/contract-create-page.tsx`
- Create: `apps/admin-web/src/features/contracts/contract-create-page.spec.tsx`
- Create: `apps/admin-web/src/features/contracts/contract-detail-page.tsx`
- Create: `apps/admin-web/src/features/contracts/contract-detail-page.spec.tsx`
- Create: `apps/admin-web/src/features/contracts/recurring-item-form.tsx`
- Create: `apps/admin-web/src/features/contracts/adhoc-charge-form.tsx`
- Modify: `apps/admin-web/src/app/router.tsx`
- Modify: `apps/admin-web/src/app/app-layout.tsx`

**Interfaces:**
- Consumes: `useCustomers` (Task 6, for the customer picker in contract creation); `apiRequest`, `ApiError` (Task 3); `Contract`, `ContractRecurringItem`, `AdhocCharge`, `RecurringPeriod` (Task 3); `Button`, `buttonClassName`, `Input`, `Label` (Task 4); `Table*` (Task 6); `renderWithProviders` + role tokens (Task 5).
- Produces: `useContracts()`, `useContract(id)`, `useCreateContract()`, `useAddRecurringItem(contractId)`, `useAddAdhocCharge(contractId)` — not consumed elsewhere in this plan, but follow the same shape `invoices-api.ts` (Task 8) will use.

- [ ] **Step 1: Write the failing test for the contracts list page**

```tsx
// apps/admin-web/src/features/contracts/contracts-list-page.spec.tsx
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, SALES_TOKEN, ACCOUNTING_TOKEN } from '../../test/render-with-providers';
import { ContractsListPage } from './contracts-list-page';

const API_URL = import.meta.env.VITE_API_URL as string;

const contracts = [
  {
    id: 'contract-12345678',
    customerId: 'c1',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: null,
    status: 'ACTIVE',
    recurringItems: [],
    adhocCharges: [],
  },
];

describe('ContractsListPage', () => {
  it('renders contracts and shows the create link for SALES', async () => {
    server.use(http.get(`${API_URL}/admin/contracts`, () => HttpResponse.json(contracts)));

    renderWithProviders(<ContractsListPage />, { token: SALES_TOKEN });

    await waitFor(() => expect(screen.getByText('활성')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: '새 계약 등록' })).toBeInTheDocument();
  });

  it('hides the create link for ACCOUNTING', async () => {
    server.use(http.get(`${API_URL}/admin/contracts`, () => HttpResponse.json(contracts)));

    renderWithProviders(<ContractsListPage />, { token: ACCOUNTING_TOKEN });

    await waitFor(() => expect(screen.getByText('활성')).toBeInTheDocument());
    expect(screen.queryByRole('link', { name: '새 계약 등록' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails, then implement the API hooks and list page**

Run: `npm test --workspace=admin-web` — expect FAIL (`Cannot find module './contracts-list-page'`)

```typescript
// apps/admin-web/src/features/contracts/contracts-api.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api-client';
import type { AdhocCharge, Contract, ContractRecurringItem, RecurringPeriod } from '../../types/domain';

export function useContracts() {
  return useQuery({
    queryKey: ['contracts'],
    queryFn: () => apiRequest<Contract[]>('/admin/contracts'),
  });
}

export function useContract(id: string) {
  return useQuery({
    queryKey: ['contracts', id],
    queryFn: () => apiRequest<Contract>(`/admin/contracts/${id}`),
  });
}

export interface CreateContractInput {
  customerId: string;
  startDate: string;
  endDate?: string;
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateContractInput) =>
      apiRequest<Contract>('/admin/contracts', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts'] }),
  });
}

export interface RecurringItemInput {
  description: string;
  period: RecurringPeriod;
  amount: number;
  startDate: string;
  endDate?: string;
}

export function useAddRecurringItem(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RecurringItemInput) =>
      apiRequest<ContractRecurringItem>(`/admin/contracts/${contractId}/recurring-items`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts', contractId] }),
  });
}

export interface AdhocChargeInput {
  description: string;
  amount: number;
  occurredOn: string;
}

export function useAddAdhocCharge(contractId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdhocChargeInput) =>
      apiRequest<AdhocCharge>(`/admin/contracts/${contractId}/adhoc-charges`, { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts', contractId] }),
  });
}
```

```tsx
// apps/admin-web/src/features/contracts/contracts-list-page.tsx
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { buttonClassName } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useContracts } from './contracts-api';

const STATUS_LABEL: Record<string, string> = { ACTIVE: '활성', TERMINATED: '해지' };

export function ContractsListPage() {
  const { role } = useAuth();
  const { data: contracts, isLoading, error } = useContracts();
  const canCreate = role === 'SALES' || role === 'ADMIN';

  if (isLoading) return <p>불러오는 중...</p>;
  if (error) return <p className="text-red-600">계약 목록을 불러오지 못했습니다.</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">계약 목록</h1>
        {canCreate && (
          <Link to="/contracts/new" className={buttonClassName}>
            새 계약 등록
          </Link>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>계약 ID</TableHead>
            <TableHead>시작일</TableHead>
            <TableHead>종료일</TableHead>
            <TableHead>상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts?.map((contract) => (
            <TableRow key={contract.id}>
              <TableCell>
                <Link to={`/contracts/${contract.id}`} className="text-slate-900 underline">
                  {contract.id.slice(0, 8)}
                </Link>
              </TableCell>
              <TableCell>{contract.startDate.slice(0, 10)}</TableCell>
              <TableCell>{contract.endDate?.slice(0, 10) ?? '-'}</TableCell>
              <TableCell>{STATUS_LABEL[contract.status]}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 3: Run the test and confirm it passes**

Run: `npm test --workspace=admin-web`
Expected: PASS (21 tests total)

- [ ] **Step 4: Write the failing test for contract creation**

```tsx
// apps/admin-web/src/features/contracts/contract-create-page.spec.tsx
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, SALES_TOKEN } from '../../test/render-with-providers';
import { ContractCreatePage } from './contract-create-page';

const API_URL = import.meta.env.VITE_API_URL as string;

describe('ContractCreatePage', () => {
  it('creates a contract for the selected customer and navigates to its detail page', async () => {
    server.use(
      http.get(`${API_URL}/admin/customers`, () =>
        HttpResponse.json([
          { id: 'c1', type: 'INDIVIDUAL', name: '홍길동', email: 'hong@example.com', phone: null, businessRegNo: null, createdAt: '', updatedAt: '' },
        ]),
      ),
      http.post(`${API_URL}/admin/contracts`, () =>
        HttpResponse.json({ id: 'contract-1', customerId: 'c1', startDate: '2026-07-01', endDate: null, status: 'ACTIVE', recurringItems: [], adhocCharges: [] }),
      ),
    );

    renderWithProviders(
      <Routes>
        <Route path="/contracts/new" element={<ContractCreatePage />} />
        <Route path="/contracts/:id" element={<div>계약 상세</div>} />
      </Routes>,
      { token: SALES_TOKEN, route: '/contracts/new' },
    );

    await waitFor(() => expect(screen.getByRole('option', { name: '홍길동' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('고객'), { target: { value: 'c1' } });
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-07-01' } });
    fireEvent.click(screen.getByRole('button', { name: '등록' }));

    await waitFor(() => expect(screen.getByText('계약 상세')).toBeInTheDocument());
  });
});
```

- [ ] **Step 5: Run the test, confirm it fails, then implement `ContractCreatePage`**

Run: `npm test --workspace=admin-web` — expect FAIL (`Cannot find module './contract-create-page'`)

```tsx
// apps/admin-web/src/features/contracts/contract-create-page.tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { ApiError } from '../../lib/api-client';
import { useCustomers } from '../customers/customers-api';
import { useCreateContract, type CreateContractInput } from './contracts-api';

const contractSchema = z.object({
  customerId: z.string().min(1, '고객을 선택해주세요.'),
  startDate: z.string().min(1, '시작일을 입력해주세요.'),
  endDate: z.string().optional(),
});

export function ContractCreatePage() {
  const navigate = useNavigate();
  const { data: customers } = useCustomers();
  const createContract = useCreateContract();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateContractInput>({ resolver: zodResolver(contractSchema) });

  async function onSubmit(values: CreateContractInput) {
    setServerError(null);
    try {
      const contract = await createContract.mutateAsync(values);
      navigate(`/contracts/${contract.id}`);
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : '등록에 실패했습니다.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-md space-y-4">
      <h1 className="text-xl font-semibold">새 계약 등록</h1>
      <div className="space-y-1">
        <Label htmlFor="customerId">고객</Label>
        <select
          id="customerId"
          {...register('customerId')}
          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
        >
          <option value="">선택해주세요</option>
          {customers?.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.name}
            </option>
          ))}
        </select>
        {errors.customerId && <p className="text-sm text-red-600">{errors.customerId.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="startDate">시작일</Label>
        <Input id="startDate" type="date" {...register('startDate')} />
        {errors.startDate && <p className="text-sm text-red-600">{errors.startDate.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="endDate">종료일 (선택)</Label>
        <Input id="endDate" type="date" {...register('endDate')} />
      </div>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? '등록 중...' : '등록'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 6: Run the test and confirm it passes**

Run: `npm test --workspace=admin-web`
Expected: PASS (22 tests total)

- [ ] **Step 7: Write the failing test for the contract detail page**

```tsx
// apps/admin-web/src/features/contracts/contract-detail-page.spec.tsx
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, SALES_TOKEN } from '../../test/render-with-providers';
import { ContractDetailPage } from './contract-detail-page';

const API_URL = import.meta.env.VITE_API_URL as string;

const contract = {
  id: 'contract-1',
  customerId: 'c1',
  startDate: '2026-01-01T00:00:00.000Z',
  endDate: null,
  status: 'ACTIVE',
  recurringItems: [],
  adhocCharges: [],
};

describe('ContractDetailPage', () => {
  it('adds a recurring item and shows it in the list', async () => {
    server.use(
      http.get(`${API_URL}/admin/contracts/contract-1`, () => HttpResponse.json(contract)),
      http.post(`${API_URL}/admin/contracts/contract-1/recurring-items`, () =>
        HttpResponse.json({
          id: 'item-1',
          contractId: 'contract-1',
          description: '월 이용료',
          period: 'MONTHLY',
          amount: '100000',
          startDate: '2026-07-01',
          endDate: null,
        }),
      ),
    );

    renderWithProviders(
      <Routes>
        <Route path="/contracts/:id" element={<ContractDetailPage />} />
      </Routes>,
      { token: SALES_TOKEN, route: '/contracts/contract-1' },
    );

    await waitFor(() => expect(screen.getByText('등록된 정액항목이 없습니다.')).toBeInTheDocument());

    // Both the recurring-item and adhoc-charge forms render a "설명"/"금액"/"추가"
    // label — the recurring form is first in the DOM, so index 0 targets it.
    fireEvent.change(screen.getAllByLabelText('설명')[0], { target: { value: '월 이용료' } });
    fireEvent.change(screen.getAllByLabelText('금액')[0], { target: { value: '100000' } });
    fireEvent.change(screen.getByLabelText('시작일'), { target: { value: '2026-07-01' } });
    fireEvent.click(screen.getAllByRole('button', { name: '추가' })[0]);

    await waitFor(() => expect(screen.getByText(/월 이용료/)).toBeInTheDocument());
  });
});
```

- [ ] **Step 8: Run the test, confirm it fails, then implement the forms and detail page**

Run: `npm test --workspace=admin-web` — expect FAIL (`Cannot find module './contract-detail-page'`)

```tsx
// apps/admin-web/src/features/contracts/recurring-item-form.tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { ApiError } from '../../lib/api-client';
import { useAddRecurringItem, type RecurringItemInput } from './contracts-api';

const recurringItemSchema = z.object({
  description: z.string().min(1, '설명을 입력해주세요.'),
  period: z.enum(['MONTHLY', 'QUARTERLY']),
  amount: z.coerce.number().min(0, '금액은 0 이상이어야 합니다.'),
  startDate: z.string().min(1, '시작일을 입력해주세요.'),
  endDate: z.string().optional(),
});

export function RecurringItemForm({ contractId }: { contractId: string }) {
  const addRecurringItem = useAddRecurringItem(contractId);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RecurringItemInput>({ resolver: zodResolver(recurringItemSchema), defaultValues: { period: 'MONTHLY' } });

  async function onSubmit(values: RecurringItemInput) {
    setServerError(null);
    try {
      await addRecurringItem.mutateAsync(values);
      reset();
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : '추가에 실패했습니다.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 rounded-md border border-slate-200 p-4">
      <h2 className="font-medium">정액항목 추가</h2>
      <div className="space-y-1">
        <Label htmlFor="recurring-description">설명</Label>
        <Input id="recurring-description" {...register('description')} />
        {errors.description && <p className="text-sm text-red-600">{errors.description.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="recurring-period">주기</Label>
        <select
          id="recurring-period"
          {...register('period')}
          className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
        >
          <option value="MONTHLY">월간</option>
          <option value="QUARTERLY">분기</option>
        </select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="recurring-amount">금액</Label>
        <Input id="recurring-amount" type="number" step="0.01" {...register('amount')} />
        {errors.amount && <p className="text-sm text-red-600">{errors.amount.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="recurring-startDate">시작일</Label>
        <Input id="recurring-startDate" type="date" {...register('startDate')} />
        {errors.startDate && <p className="text-sm text-red-600">{errors.startDate.message}</p>}
      </div>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? '추가 중...' : '추가'}
      </Button>
    </form>
  );
}
```

```tsx
// apps/admin-web/src/features/contracts/adhoc-charge-form.tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { z } from 'zod';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { ApiError } from '../../lib/api-client';
import { useAddAdhocCharge, type AdhocChargeInput } from './contracts-api';

const adhocChargeSchema = z.object({
  description: z.string().min(1, '설명을 입력해주세요.'),
  amount: z.coerce.number().min(0, '금액은 0 이상이어야 합니다.'),
  occurredOn: z.string().min(1, '발생일을 입력해주세요.'),
});

export function AdhocChargeForm({ contractId }: { contractId: string }) {
  const addAdhocCharge = useAddAdhocCharge(contractId);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AdhocChargeInput>({ resolver: zodResolver(adhocChargeSchema) });

  async function onSubmit(values: AdhocChargeInput) {
    setServerError(null);
    try {
      await addAdhocCharge.mutateAsync(values);
      reset();
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : '추가에 실패했습니다.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 rounded-md border border-slate-200 p-4">
      <h2 className="font-medium">건별청구 추가</h2>
      <div className="space-y-1">
        <Label htmlFor="adhoc-description">설명</Label>
        <Input id="adhoc-description" {...register('description')} />
        {errors.description && <p className="text-sm text-red-600">{errors.description.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="adhoc-amount">금액</Label>
        <Input id="adhoc-amount" type="number" step="0.01" {...register('amount')} />
        {errors.amount && <p className="text-sm text-red-600">{errors.amount.message}</p>}
      </div>
      <div className="space-y-1">
        <Label htmlFor="adhoc-occurredOn">발생일</Label>
        <Input id="adhoc-occurredOn" type="date" {...register('occurredOn')} />
        {errors.occurredOn && <p className="text-sm text-red-600">{errors.occurredOn.message}</p>}
      </div>
      {serverError && <p className="text-sm text-red-600">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? '추가 중...' : '추가'}
      </Button>
    </form>
  );
}
```

```tsx
// apps/admin-web/src/features/contracts/contract-detail-page.tsx
import { useParams } from 'react-router-dom';
import { useContract } from './contracts-api';
import { RecurringItemForm } from './recurring-item-form';
import { AdhocChargeForm } from './adhoc-charge-form';

const PERIOD_LABEL: Record<string, string> = { MONTHLY: '월간', QUARTERLY: '분기' };

export function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: contract, isLoading, error } = useContract(id!);

  if (isLoading) return <p>불러오는 중...</p>;
  if (error || !contract) return <p className="text-red-600">계약 정보를 불러오지 못했습니다.</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">계약 {contract.id.slice(0, 8)}</h1>
      <section className="space-y-2">
        <h2 className="font-medium">정액항목</h2>
        <ul className="space-y-1 text-sm">
          {contract.recurringItems.length === 0 && <li className="text-slate-500">등록된 정액항목이 없습니다.</li>}
          {contract.recurringItems.map((item) => (
            <li key={item.id} className="flex justify-between rounded-md border border-slate-200 p-2">
              <span>
                {item.description} ({PERIOD_LABEL[item.period]})
              </span>
              <span>{item.amount}원</span>
            </li>
          ))}
        </ul>
        <RecurringItemForm contractId={contract.id} />
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">건별청구</h2>
        <ul className="space-y-1 text-sm">
          {contract.adhocCharges.length === 0 && <li className="text-slate-500">등록된 건별청구가 없습니다.</li>}
          {contract.adhocCharges.map((charge) => (
            <li key={charge.id} className="flex justify-between rounded-md border border-slate-200 p-2">
              <span>{charge.description}</span>
              <span>{charge.amount}원</span>
            </li>
          ))}
        </ul>
        <AdhocChargeForm contractId={contract.id} />
      </section>
    </div>
  );
}
```

- [ ] **Step 9: Run the test and confirm it passes**

Run: `npm test --workspace=admin-web`
Expected: PASS (23 tests total)

- [ ] **Step 10: Wire the new routes and nav link**

```tsx
// apps/admin-web/src/app/router.tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/login-page';
import { ProtectedRoute } from '../features/auth/protected-route';
import { ContractCreatePage } from '../features/contracts/contract-create-page';
import { ContractDetailPage } from '../features/contracts/contract-detail-page';
import { ContractsListPage } from '../features/contracts/contracts-list-page';
import { CustomerCreatePage } from '../features/customers/customer-create-page';
import { CustomerDetailPage } from '../features/customers/customer-detail-page';
import { CustomerEditPage } from '../features/customers/customer-edit-page';
import { CustomersListPage } from '../features/customers/customers-list-page';
import { AppLayout } from './app-layout';
import { DashboardPage } from './dashboard-page';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/customers" element={<CustomersListPage />} />
            <Route path="/customers/new" element={<CustomerCreatePage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/customers/:id/edit" element={<CustomerEditPage />} />
            <Route path="/contracts" element={<ContractsListPage />} />
            <Route path="/contracts/new" element={<ContractCreatePage />} />
            <Route path="/contracts/:id" element={<ContractDetailPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

```tsx
// apps/admin-web/src/app/app-layout.tsx
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { Button } from '../components/ui/button';

export function AppLayout() {
  const { logout, role } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <nav className="flex items-center gap-4 text-sm font-medium text-slate-700">
          <Link to="/customers">고객</Link>
          <Link to="/contracts">계약</Link>
        </nav>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>{role}</span>
          <Button onClick={logout} className="bg-slate-200 text-slate-900 hover:bg-slate-300">
            로그아웃
          </Button>
        </div>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 11: Run the full test suite and confirm the build works**

Run: `npm test --workspace=admin-web` — expect PASS (23 tests total)
Run: `npm run build --workspace=admin-web` — expect exit 0

- [ ] **Step 12: Commit**

```bash
git add apps/admin-web/src/features/contracts apps/admin-web/src/app/router.tsx apps/admin-web/src/app/app-layout.tsx
git commit -m "feat(admin-web): add contracts list, detail, and creation with recurring items and adhoc charges"
```

---

### Task 8: Invoice generation feature (period preview + batch generate)

**Files:**
- Modify: `apps/admin-web/src/types/domain.ts`
- Create: `apps/admin-web/src/features/invoices/invoices-api.ts`
- Create: `apps/admin-web/src/features/invoices/invoice-generate-page.tsx`
- Create: `apps/admin-web/src/features/invoices/invoice-generate-page.spec.tsx`
- Modify: `apps/admin-web/src/app/router.tsx`
- Modify: `apps/admin-web/src/app/app-layout.tsx`

**Interfaces:**
- Consumes: `apiRequest`, `ApiError` (Task 3); `Button`, `Input`, `Label` (Task 4); `renderWithProviders`, `ACCOUNTING_TOKEN` (Task 5).
- Produces: `usePreviewInvoices()`, `useGenerateInvoices()`, `type GeneratePeriodInput` in `invoices-api.ts` — Task 9 adds more hooks to this same file.
- Produces: `ContractInvoicePreview` type in `types/domain.ts`.

- [ ] **Step 1: Add the preview type**

```typescript
// apps/admin-web/src/types/domain.ts
// Add this interface to the end of the existing file:
export interface ContractInvoicePreview {
  contractId: string;
  recurringItems: ContractRecurringItem[];
  adhocCharges: AdhocCharge[];
}
```

- [ ] **Step 2: Write the failing test**

```tsx
// apps/admin-web/src/features/invoices/invoice-generate-page.spec.tsx
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, ACCOUNTING_TOKEN } from '../../test/render-with-providers';
import { InvoiceGeneratePage } from './invoice-generate-page';

const API_URL = import.meta.env.VITE_API_URL as string;

describe('InvoiceGeneratePage', () => {
  it('previews then generates invoices for the selected period', async () => {
    let generateCalled = false;
    server.use(
      http.post(`${API_URL}/admin/invoices/preview`, () =>
        HttpResponse.json([{ contractId: 'contract-1', recurringItems: [{ id: 'r1' }], adhocCharges: [] }]),
      ),
      http.post(`${API_URL}/admin/invoices/generate`, () => {
        generateCalled = true;
        return HttpResponse.json([{ id: 'invoice-1' }]);
      }),
    );

    renderWithProviders(<InvoiceGeneratePage />, { token: ACCOUNTING_TOKEN });

    fireEvent.change(screen.getByLabelText('청구 기간 시작'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('청구 기간 종료'), { target: { value: '2026-07-31' } });
    fireEvent.click(screen.getByRole('button', { name: '미리보기' }));

    await waitFor(() => expect(screen.getByText(/대상 계약 1건/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '일괄 생성' }));

    await waitFor(() => expect(generateCalled).toBe(true));
  });
});
```

- [ ] **Step 3: Run the test, confirm it fails, then implement the API hooks and page**

Run: `npm test --workspace=admin-web` — expect FAIL (`Cannot find module './invoice-generate-page'`)

```typescript
// apps/admin-web/src/features/invoices/invoices-api.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api-client';
import type { ContractInvoicePreview, Invoice } from '../../types/domain';

export interface GeneratePeriodInput {
  periodStart: string;
  periodEnd: string;
}

export function usePreviewInvoices() {
  return useMutation({
    mutationFn: (input: GeneratePeriodInput) =>
      apiRequest<ContractInvoicePreview[]>('/admin/invoices/preview', { method: 'POST', body: input }),
  });
}

export function useGenerateInvoices() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GeneratePeriodInput) =>
      apiRequest<Invoice[]>('/admin/invoices/generate', { method: 'POST', body: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices'] }),
  });
}
```

```tsx
// apps/admin-web/src/features/invoices/invoice-generate-page.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { ApiError } from '../../lib/api-client';
import { useGenerateInvoices, usePreviewInvoices, type GeneratePeriodInput } from './invoices-api';

export function InvoiceGeneratePage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<GeneratePeriodInput>({ periodStart: '', periodEnd: '' });
  const [error, setError] = useState<string | null>(null);
  const preview = usePreviewInvoices();
  const generate = useGenerateInvoices();

  async function handlePreview() {
    setError(null);
    try {
      await preview.mutateAsync(period);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '미리보기에 실패했습니다.');
    }
  }

  async function handleGenerate() {
    setError(null);
    try {
      await generate.mutateAsync(period);
      navigate('/invoices');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '생성에 실패했습니다.');
    }
  }

  const previews = preview.data ?? [];
  const totalLineCount = previews.reduce((sum, p) => sum + p.recurringItems.length + p.adhocCharges.length, 0);

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">청구서 생성</h1>
      <div className="flex items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor="periodStart">청구 기간 시작</Label>
          <Input
            id="periodStart"
            type="date"
            value={period.periodStart}
            onChange={(e) => setPeriod((p) => ({ ...p, periodStart: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="periodEnd">청구 기간 종료</Label>
          <Input
            id="periodEnd"
            type="date"
            value={period.periodEnd}
            onChange={(e) => setPeriod((p) => ({ ...p, periodEnd: e.target.value }))}
          />
        </div>
        <Button onClick={handlePreview} disabled={!period.periodStart || !period.periodEnd || preview.isPending}>
          {preview.isPending ? '조회 중...' : '미리보기'}
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {preview.isSuccess && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            대상 계약 {previews.length}건, 청구 항목 {totalLineCount}건
          </p>
          <ul className="space-y-2 text-sm">
            {previews.map((p) => (
              <li key={p.contractId} className="rounded-md border border-slate-200 p-2">
                계약 {p.contractId.slice(0, 8)} — 정액항목 {p.recurringItems.length}건, 건별청구 {p.adhocCharges.length}건
              </li>
            ))}
          </ul>
          <Button onClick={handleGenerate} disabled={previews.length === 0 || generate.isPending}>
            {generate.isPending ? '생성 중...' : '일괄 생성'}
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test --workspace=admin-web`
Expected: PASS (24 tests total)

- [ ] **Step 5: Wire the route and a role-gated nav link**

```tsx
// apps/admin-web/src/app/router.tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/login-page';
import { ProtectedRoute } from '../features/auth/protected-route';
import { ContractCreatePage } from '../features/contracts/contract-create-page';
import { ContractDetailPage } from '../features/contracts/contract-detail-page';
import { ContractsListPage } from '../features/contracts/contracts-list-page';
import { CustomerCreatePage } from '../features/customers/customer-create-page';
import { CustomerDetailPage } from '../features/customers/customer-detail-page';
import { CustomerEditPage } from '../features/customers/customer-edit-page';
import { CustomersListPage } from '../features/customers/customers-list-page';
import { InvoiceGeneratePage } from '../features/invoices/invoice-generate-page';
import { AppLayout } from './app-layout';
import { DashboardPage } from './dashboard-page';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/customers" element={<CustomersListPage />} />
            <Route path="/customers/new" element={<CustomerCreatePage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/customers/:id/edit" element={<CustomerEditPage />} />
            <Route path="/contracts" element={<ContractsListPage />} />
            <Route path="/contracts/new" element={<ContractCreatePage />} />
            <Route path="/contracts/:id" element={<ContractDetailPage />} />
            <Route path="/invoices/generate" element={<InvoiceGeneratePage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

```tsx
// apps/admin-web/src/app/app-layout.tsx
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { Button } from '../components/ui/button';

export function AppLayout() {
  const { logout, role } = useAuth();
  const canAccessInvoices = role === 'ACCOUNTING' || role === 'ADMIN';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <nav className="flex items-center gap-4 text-sm font-medium text-slate-700">
          <Link to="/customers">고객</Link>
          <Link to="/contracts">계약</Link>
          {canAccessInvoices && <Link to="/invoices/generate">청구서 생성</Link>}
        </nav>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>{role}</span>
          <Button onClick={logout} className="bg-slate-200 text-slate-900 hover:bg-slate-300">
            로그아웃
          </Button>
        </div>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
```

(Apply the router.tsx change as a full-file edit, inserting the import alongside the others and the route inside the existing `<Route element={<AppLayout />}>` block, right after `/contracts/:id`.)

- [ ] **Step 6: Run the full test suite and confirm the build works**

Run: `npm test --workspace=admin-web` — expect PASS (24 tests total)
Run: `npm run build --workspace=admin-web` — expect exit 0

- [ ] **Step 7: Commit**

```bash
git add apps/admin-web/src/types/domain.ts apps/admin-web/src/features/invoices apps/admin-web/src/app/router.tsx apps/admin-web/src/app/app-layout.tsx
git commit -m "feat(admin-web): add invoice period preview and batch generation"
```

---

### Task 9: Invoice list, detail, issue, and PDF download

**Files:**
- Modify: `apps/admin-web/src/lib/api-client.ts`
- Modify: `apps/admin-web/src/lib/api-client.spec.ts`
- Modify: `apps/admin-web/src/features/invoices/invoices-api.ts`
- Create: `apps/admin-web/src/components/ui/badge.tsx`
- Create: `apps/admin-web/src/features/invoices/invoices-list-page.tsx`
- Create: `apps/admin-web/src/features/invoices/invoices-list-page.spec.tsx`
- Create: `apps/admin-web/src/features/invoices/invoice-detail-page.tsx`
- Create: `apps/admin-web/src/features/invoices/invoice-detail-page.spec.tsx`
- Modify: `apps/admin-web/src/app/router.tsx`
- Modify: `apps/admin-web/src/app/app-layout.tsx`

**Interfaces:**
- Consumes: `getToken` (Task 3); `ApiError` (Task 3); `Invoice`, `InvoiceLineItem` (Task 3); `Button`, `Table*` (Tasks 4, 6); `usePreviewInvoices`/`useGenerateInvoices` file from Task 8 (extended here).
- Produces: `apiRequestBlob(path): Promise<Blob>` in `api-client.ts`. Produces: `useInvoices()`, `useInvoice(id)`, `useIssueInvoice(id)`, `useDownloadInvoicePdf()`.

This task directly implements the "청구서 발행 상태(성공/진행중/실패)" requirement: `useIssueInvoice`'s mutation state (`isPending`/`isSuccess`) plus a caught `ApiError` drive the three UI states on the detail page.

- [ ] **Step 1: Write the failing test for `apiRequestBlob`**

```typescript
// apps/admin-web/src/lib/api-client.spec.ts
// Add this import alongside the existing one:
import { apiRequest, apiRequestBlob, ApiError } from './api-client';

// Add this test inside the existing `describe('apiRequest', ...)` block:
it('apiRequestBlob returns the response body as a Blob', async () => {
  server.use(
    http.get(`${API_URL}/admin/invoices/inv-1/pdf`, () =>
      new HttpResponse(new Blob(['pdf-bytes']), { headers: { 'Content-Type': 'application/pdf' } }),
    ),
  );

  const blob = await apiRequestBlob('/admin/invoices/inv-1/pdf');

  expect(blob.type).toBe('application/pdf');
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test --workspace=admin-web`
Expected: FAIL — `apiRequestBlob is not exported`

- [ ] **Step 3: Implement `apiRequestBlob`**

```typescript
// apps/admin-web/src/lib/api-client.ts
// Add this function at the end of the file:
export async function apiRequestBlob(path: string): Promise<Blob> {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new ApiError(response.status, 'PDF를 불러오지 못했습니다.');
  }

  return response.blob();
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm test --workspace=admin-web`
Expected: PASS (25 tests total)

- [ ] **Step 5: Write the failing test for the invoices list page**

```tsx
// apps/admin-web/src/features/invoices/invoices-list-page.spec.tsx
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, ACCOUNTING_TOKEN } from '../../test/render-with-providers';
import { InvoicesListPage } from './invoices-list-page';

const API_URL = import.meta.env.VITE_API_URL as string;

describe('InvoicesListPage', () => {
  it('renders invoices with their status', async () => {
    server.use(
      http.get(`${API_URL}/admin/invoices`, () =>
        HttpResponse.json([
          {
            id: 'invoice-1',
            contractId: 'contract-1',
            periodStart: '2026-07-01T00:00:00.000Z',
            periodEnd: '2026-07-31T00:00:00.000Z',
            dueDate: '2026-08-14T00:00:00.000Z',
            issueDate: null,
            status: 'DRAFT',
            totalAmount: '150000',
            contract: { customer: { name: '홍길동' } },
          },
        ]),
      ),
    );

    renderWithProviders(<InvoicesListPage />, { token: ACCOUNTING_TOKEN });

    await waitFor(() => expect(screen.getByText('홍길동')).toBeInTheDocument());
    expect(screen.getByText('초안')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the test, confirm it fails, then implement the badge, remaining hooks, and list page**

Run: `npm test --workspace=admin-web` — expect FAIL (`Cannot find module './invoices-list-page'`)

```tsx
// apps/admin-web/src/components/ui/badge.tsx
import { type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-amber-100 text-amber-800',
  SENT: 'bg-emerald-100 text-emerald-800',
};

const STATUS_LABEL: Record<string, string> = { DRAFT: '초안', SENT: '발송완료' };

export function StatusBadge({ status, className, ...props }: { status: string } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
        STATUS_STYLES[status] ?? 'bg-slate-100 text-slate-700',
        className,
      )}
      {...props}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
```

```typescript
// apps/admin-web/src/features/invoices/invoices-api.ts
// Replace the top import line with:
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest, apiRequestBlob } from '../../lib/api-client';
import type { ContractInvoicePreview, Invoice } from '../../types/domain';

// (keep GeneratePeriodInput, usePreviewInvoices, useGenerateInvoices as they are, and append:)

export function useInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: () => apiRequest<Invoice[]>('/admin/invoices'),
  });
}

export function useInvoice(id: string) {
  return useQuery({
    queryKey: ['invoices', id],
    queryFn: () => apiRequest<Invoice>(`/admin/invoices/${id}`),
  });
}

export function useIssueInvoice(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<Invoice>(`/admin/invoices/${id}/issue`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoices', id] });
    },
  });
}

export function useDownloadInvoicePdf() {
  return useMutation({
    mutationFn: async (id: string) => {
      const blob = await apiRequestBlob(`/admin/invoices/${id}/pdf`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${id}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    },
  });
}
```

```tsx
// apps/admin-web/src/features/invoices/invoices-list-page.tsx
import { Link } from 'react-router-dom';
import { StatusBadge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useInvoices } from './invoices-api';

export function InvoicesListPage() {
  const { data: invoices, isLoading, error } = useInvoices();

  if (isLoading) return <p>불러오는 중...</p>;
  if (error) return <p className="text-red-600">청구서 목록을 불러오지 못했습니다.</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">청구서 목록</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>고객</TableHead>
            <TableHead>청구 기간</TableHead>
            <TableHead>금액</TableHead>
            <TableHead>상태</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices?.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell>
                <Link to={`/invoices/${invoice.id}`} className="text-slate-900 underline">
                  {invoice.contract?.customer.name ?? invoice.contractId.slice(0, 8)}
                </Link>
              </TableCell>
              <TableCell>
                {invoice.periodStart.slice(0, 10)} ~ {invoice.periodEnd.slice(0, 10)}
              </TableCell>
              <TableCell>{invoice.totalAmount}원</TableCell>
              <TableCell>
                <StatusBadge status={invoice.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 7: Run the test and confirm it passes**

Run: `npm test --workspace=admin-web`
Expected: PASS (26 tests total)

- [ ] **Step 8: Write the failing test for the invoice detail page (issue success + failure)**

```tsx
// apps/admin-web/src/features/invoices/invoice-detail-page.spec.tsx
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { server } from '../../test/mock-server';
import { renderWithProviders, ACCOUNTING_TOKEN } from '../../test/render-with-providers';
import { InvoiceDetailPage } from './invoice-detail-page';

const API_URL = import.meta.env.VITE_API_URL as string;

const draftInvoice = {
  id: 'invoice-1',
  contractId: 'contract-1',
  periodStart: '2026-07-01T00:00:00.000Z',
  periodEnd: '2026-07-31T00:00:00.000Z',
  dueDate: '2026-08-14T00:00:00.000Z',
  issueDate: null,
  status: 'DRAFT',
  totalAmount: '150000',
  lineItems: [
    { id: 'line-1', invoiceId: 'invoice-1', description: '월 이용료', quantity: 1, unitPrice: '150000', amount: '150000', source: 'RECURRING' },
  ],
};

function renderDetailPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
    </Routes>,
    { token: ACCOUNTING_TOKEN, route: '/invoices/invoice-1' },
  );
}

describe('InvoiceDetailPage', () => {
  it('issues the invoice and shows the success message', async () => {
    server.use(
      http.get(`${API_URL}/admin/invoices/invoice-1`, () => HttpResponse.json(draftInvoice)),
      http.post(`${API_URL}/admin/invoices/invoice-1/issue`, () =>
        HttpResponse.json({ ...draftInvoice, status: 'SENT', issueDate: '2026-07-11T00:00:00.000Z' }),
      ),
    );

    renderDetailPage();

    await waitFor(() => expect(screen.getByText('월 이용료')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /발행/ }));

    await waitFor(() => expect(screen.getByText('발행이 완료되어 이메일로 발송되었습니다.')).toBeInTheDocument());
  });

  it('shows an error message when issuing fails', async () => {
    server.use(
      http.get(`${API_URL}/admin/invoices/invoice-1`, () => HttpResponse.json(draftInvoice)),
      http.post(`${API_URL}/admin/invoices/invoice-1/issue`, () =>
        HttpResponse.json({ statusCode: 500, message: '메일 발송에 실패했습니다.' }, { status: 500 }),
      ),
    );

    renderDetailPage();

    await waitFor(() => expect(screen.getByText('월 이용료')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /발행/ }));

    await waitFor(() => expect(screen.getByText('메일 발송에 실패했습니다.')).toBeInTheDocument());
  });
});
```

- [ ] **Step 9: Run the test, confirm it fails, then implement `InvoiceDetailPage`**

Run: `npm test --workspace=admin-web` — expect FAIL (`Cannot find module './invoice-detail-page'`)

```tsx
// apps/admin-web/src/features/invoices/invoice-detail-page.tsx
import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { StatusBadge } from '../../components/ui/badge';
import { ApiError } from '../../lib/api-client';
import { useDownloadInvoicePdf, useInvoice, useIssueInvoice } from './invoices-api';

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: invoice, isLoading, error } = useInvoice(id!);
  const issueInvoice = useIssueInvoice(id!);
  const downloadPdf = useDownloadInvoicePdf();
  const [issueError, setIssueError] = useState<string | null>(null);

  if (isLoading) return <p>불러오는 중...</p>;
  if (error || !invoice) return <p className="text-red-600">청구서 정보를 불러오지 못했습니다.</p>;

  async function handleIssue() {
    setIssueError(null);
    try {
      await issueInvoice.mutateAsync();
    } catch (err) {
      setIssueError(err instanceof ApiError ? err.message : '발행에 실패했습니다.');
    }
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">청구서 {invoice.id.slice(0, 8)}</h1>
        <StatusBadge status={invoice.status} />
      </div>
      <p className="text-sm text-slate-600">
        청구 기간: {invoice.periodStart.slice(0, 10)} ~ {invoice.periodEnd.slice(0, 10)} / 납부기한:{' '}
        {invoice.dueDate.slice(0, 10)}
      </p>
      <ul className="space-y-1 text-sm">
        {invoice.lineItems?.map((line) => (
          <li key={line.id} className="flex justify-between rounded-md border border-slate-200 p-2">
            <span>{line.description}</span>
            <span>{line.amount}원</span>
          </li>
        ))}
      </ul>
      <p className="font-medium">합계: {invoice.totalAmount}원</p>
      <div className="flex gap-3">
        {invoice.status === 'DRAFT' && (
          <Button onClick={handleIssue} disabled={issueInvoice.isPending}>
            {issueInvoice.isPending ? '발행 중...' : '발행 (PDF 생성 + 메일 발송)'}
          </Button>
        )}
        {invoice.status === 'SENT' && (
          <Button onClick={() => downloadPdf.mutate(invoice.id)} disabled={downloadPdf.isPending}>
            {downloadPdf.isPending ? '다운로드 중...' : 'PDF 다운로드'}
          </Button>
        )}
      </div>
      {issueError && <p className="text-sm text-red-600">{issueError}</p>}
      {issueInvoice.isSuccess && <p className="text-sm text-emerald-700">발행이 완료되어 이메일로 발송되었습니다.</p>}
    </div>
  );
}
```

- [ ] **Step 10: Run the test and confirm it passes**

Run: `npm test --workspace=admin-web`
Expected: PASS (28 tests total)

- [ ] **Step 11: Wire the routes and the final nav link**

```tsx
// apps/admin-web/src/app/router.tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/login-page';
import { ProtectedRoute } from '../features/auth/protected-route';
import { ContractCreatePage } from '../features/contracts/contract-create-page';
import { ContractDetailPage } from '../features/contracts/contract-detail-page';
import { ContractsListPage } from '../features/contracts/contracts-list-page';
import { CustomerCreatePage } from '../features/customers/customer-create-page';
import { CustomerDetailPage } from '../features/customers/customer-detail-page';
import { CustomerEditPage } from '../features/customers/customer-edit-page';
import { CustomersListPage } from '../features/customers/customers-list-page';
import { InvoiceDetailPage } from '../features/invoices/invoice-detail-page';
import { InvoiceGeneratePage } from '../features/invoices/invoice-generate-page';
import { InvoicesListPage } from '../features/invoices/invoices-list-page';
import { AppLayout } from './app-layout';
import { DashboardPage } from './dashboard-page';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/customers" element={<CustomersListPage />} />
            <Route path="/customers/new" element={<CustomerCreatePage />} />
            <Route path="/customers/:id" element={<CustomerDetailPage />} />
            <Route path="/customers/:id/edit" element={<CustomerEditPage />} />
            <Route path="/contracts" element={<ContractsListPage />} />
            <Route path="/contracts/new" element={<ContractCreatePage />} />
            <Route path="/contracts/:id" element={<ContractDetailPage />} />
            <Route path="/invoices/generate" element={<InvoiceGeneratePage />} />
            <Route path="/invoices" element={<InvoicesListPage />} />
            <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
```

```tsx
// apps/admin-web/src/app/app-layout.tsx
import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { Button } from '../components/ui/button';

export function AppLayout() {
  const { logout, role } = useAuth();
  const canAccessInvoices = role === 'ACCOUNTING' || role === 'ADMIN';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <nav className="flex items-center gap-4 text-sm font-medium text-slate-700">
          <Link to="/customers">고객</Link>
          <Link to="/contracts">계약</Link>
          {canAccessInvoices && <Link to="/invoices/generate">청구서 생성</Link>}
          {canAccessInvoices && <Link to="/invoices">청구서</Link>}
        </nav>
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>{role}</span>
          <Button onClick={logout} className="bg-slate-200 text-slate-900 hover:bg-slate-300">
            로그아웃
          </Button>
        </div>
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 12: Run the full test suite and confirm the build works**

Run: `npm test --workspace=admin-web` — expect PASS (28 tests total)
Run: `npm run build --workspace=admin-web` — expect exit 0

- [ ] **Step 13: Run the whole monorepo's checks one last time**

```bash
npm test --workspace=api
npm test --workspace=admin-web
npx nest build --prefix apps/api || (cd apps/api && npx nest build)
npm run build --workspace=admin-web
```

Expected: all four commands exit 0.

- [ ] **Step 14: Commit**

```bash
git add apps/admin-web/src/lib apps/admin-web/src/components/ui/badge.tsx apps/admin-web/src/features/invoices apps/admin-web/src/app/router.tsx apps/admin-web/src/app/app-layout.tsx
git commit -m "feat(admin-web): add invoice list, detail, issue, and PDF download"
```

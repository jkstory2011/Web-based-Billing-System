# 청구 시스템 백엔드 API (고객·계약·청구서) MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the NestJS + PostgreSQL backend API covering admin authentication/authorization, customer & contract management, invoice generation (recurring + adhoc charges, dedup'd), and invoice issuance (PDF + email) with a portal API for customers to view their invoices.

**Architecture:** Single NestJS service (`apps/api`) in an npm-workspaces monorepo, backed by PostgreSQL via Prisma. Two JWT strategies (`jwt-admin`, `jwt-portal`) protect two route namespaces (`/admin/*`, `/portal/*`) in the same process. Business logic lives in per-domain Nest modules (`customers`, `contracts`, `invoices`, `auth`), each with a Prisma-backed service and unit tests that mock `PrismaService`.

**Tech Stack:** NestJS 10, TypeScript (strict), Prisma 5 + PostgreSQL, Jest, class-validator/class-transformer, passport-jwt, bcryptjs, pdfkit, nodemailer.

## Global Constraints

- Package manager: npm (workspaces), not yarn/pnpm.
- Money fields stored as Prisma `Decimal(12,2)`; never use JS `number` for stored totals — always `Prisma.Decimal` for accumulation logic.
- All admin routes are prefixed `/admin/*`, all customer-portal routes `/portal/*`. Never mix them under one guard.
- Roles are exactly `SALES`, `ACCOUNTING`, `ADMIN` (see permission matrix below). Every new admin endpoint must declare `@Roles(...)` explicitly — no endpoint is unguarded by default beyond the two auth guards.
- Permission matrix (from `docs/superpowers/specs/2026-07-09-customer-contract-invoice-mvp-design.md`):

  | 기능 | SALES | ACCOUNTING | ADMIN |
  |---|---|---|---|
  | 고객/계약 등록·수정 | O | 조회만 | O |
  | 건별청구(Adhoc) 입력 | O | O | O |
  | 청구서 생성/발행/발송 | X | O | O |
  | 사용자·권한 관리 | X | X | O |

- Use `bcryptjs` (pure JS), not `bcrypt` — avoids native build tooling on Windows dev machines.
- Every service that touches the DB is unit-tested against a **mocked** `PrismaService` (`jest.fn()` per method used) — no test in this plan requires a live PostgreSQL connection.
- Frontend apps (`admin-web`, `portal-web`) are explicitly out of scope for this plan — separate follow-up plans, per `docs/superpowers/specs/2026-07-09-customer-contract-invoice-mvp-design.md`.

---

### Task 1: Monorepo scaffold + NestJS API bootstrap with health check

**Files:**
- Create: `package.json` (root)
- Create: `.gitignore`
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/nest-cli.json`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`
- Create: `apps/api/src/app.controller.ts`
- Test: `apps/api/src/app.controller.spec.ts`

**Interfaces:**
- Produces: `AppController.health(): { status: 'ok' }` — used by nothing else, just proves the bootstrap works.
- Produces: root `apps/api` npm workspace that every later task's `package.json` dependencies get added to.

- [ ] **Step 1: Create root workspace `package.json`**

```json
{
  "name": "billing-system",
  "private": true,
  "workspaces": [
    "apps/*"
  ]
}
```

- [ ] **Step 2: Create root `.gitignore`**

```
node_modules/
dist/
coverage/
.env
storage/
```

- [ ] **Step 3: Create `apps/api/package.json`**

```json
{
  "name": "api",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "test": "jest",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "ts-node prisma/seed.ts"
  },
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  },
  "dependencies": {
    "@nestjs/common": "^10.4.0",
    "@nestjs/config": "^3.2.0",
    "@nestjs/core": "^10.4.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/mapped-types": "^2.0.5",
    "@nestjs/passport": "^10.0.3",
    "@nestjs/platform-express": "^10.4.0",
    "@prisma/client": "^5.19.0",
    "bcryptjs": "^2.4.3",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "nodemailer": "^6.9.14",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "pdfkit": "^0.15.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.5",
    "@nestjs/schematics": "^10.1.4",
    "@nestjs/testing": "^10.4.0",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.12",
    "@types/node": "^20.14.0",
    "@types/nodemailer": "^6.4.15",
    "@types/passport-jwt": "^4.0.1",
    "@types/pdfkit": "^0.13.4",
    "jest": "^29.7.0",
    "prisma": "^5.19.0",
    "source-map-support": "^0.5.21",
    "ts-jest": "^29.2.4",
    "ts-node": "^10.9.2",
    "typescript": "^5.5.4"
  },
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 4: Create `apps/api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": false,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "strictNullChecks": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitAny": true,
    "esModuleInterop": true
  }
}
```

- [ ] **Step 5: Create `apps/api/nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src"
}
```

- [ ] **Step 6: Create `apps/api/src/app.controller.ts`**

```typescript
import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
```

- [ ] **Step 7: Write the failing test — `apps/api/src/app.controller.spec.ts`**

```typescript
import { Test } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    controller = moduleRef.get(AppController);
  });

  it('returns ok status from /health', () => {
    expect(controller.health()).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 8: Create `apps/api/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController],
})
export class AppModule {}
```

- [ ] **Step 9: Create `apps/api/src/main.ts`**

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

- [ ] **Step 10: Install dependencies**

Run: `npm install` (from repo root)
Expected: installs into root `node_modules` with `apps/api` linked as a workspace, no errors.

- [ ] **Step 11: Run the test to verify it passes**

Run: `npm test --workspace=api -- app.controller.spec.ts`
Expected: PASS — `AppController > returns ok status from /health`

- [ ] **Step 12: Commit**

```bash
git add package.json .gitignore apps/api
git commit -m "feat: bootstrap NestJS API workspace with health check"
```

---

### Task 2: Prisma schema, PrismaService, and admin seed script

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/seed.ts`
- Create: `apps/api/src/prisma/prisma.service.ts`
- Create: `apps/api/src/prisma/prisma.module.ts`
- Test: `apps/api/src/prisma/prisma.module.spec.ts`
- Create: `apps/api/.env.example`
- Create: `docker-compose.yml` (root, local PostgreSQL for development)
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: nothing (first task to touch the database layer).
- Produces: `PrismaService` (injectable, extends `PrismaClient`), `PrismaModule` (exports `PrismaService`) — every later module imports `PrismaModule` and injects `PrismaService` in its constructor.
- Produces: Prisma models `Customer`, `Contract`, `ContractRecurringItem`, `AdhocCharge`, `Invoice`, `InvoiceLineItem`, `InvoicePdf`, `AdminUser`, `PortalUser` and enums `CustomerType`, `ContractStatus`, `RecurringPeriod`, `InvoiceStatus`, `LineItemSource`, `AdminRole` — every later task's Prisma calls use these exact model/enum names.

- [ ] **Step 1: Create root `docker-compose.yml` for local Postgres**

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: billing
      POSTGRES_PASSWORD: billing
      POSTGRES_DB: billing
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

- [ ] **Step 2: Create `apps/api/.env.example`**

```
DATABASE_URL="postgresql://billing:billing@localhost:5432/billing?schema=public"
JWT_ADMIN_SECRET="change-me-admin-secret"
JWT_PORTAL_SECRET="change-me-portal-secret"
SEED_ADMIN_EMAIL="admin@example.com"
SEED_ADMIN_PASSWORD="change-me-please"
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_USER=""
SMTP_PASS=""
MAIL_FROM="billing@example.com"
INVOICE_STORAGE_DIR="./storage/invoices"
```

Copy it to a real `.env` for local development: `cp apps/api/.env.example apps/api/.env`

- [ ] **Step 3: Create `apps/api/prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum CustomerType {
  INDIVIDUAL
  COMPANY
}

enum ContractStatus {
  ACTIVE
  TERMINATED
}

enum RecurringPeriod {
  MONTHLY
  QUARTERLY
}

enum InvoiceStatus {
  DRAFT
  SENT
}

enum LineItemSource {
  RECURRING
  ADHOC
}

enum AdminRole {
  SALES
  ACCOUNTING
  ADMIN
}

model Customer {
  id             String      @id @default(uuid())
  type           CustomerType
  name           String
  businessRegNo  String?
  email          String      @unique
  phone          String?
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
  contracts      Contract[]
  portalUser     PortalUser?
}

model Contract {
  id             String                   @id @default(uuid())
  customerId     String
  customer       Customer                 @relation(fields: [customerId], references: [id])
  startDate      DateTime
  endDate        DateTime?
  status         ContractStatus           @default(ACTIVE)
  createdAt      DateTime                 @default(now())
  updatedAt      DateTime                 @updatedAt
  recurringItems ContractRecurringItem[]
  adhocCharges   AdhocCharge[]
  invoices       Invoice[]
}

model ContractRecurringItem {
  id          String            @id @default(uuid())
  contractId  String
  contract    Contract          @relation(fields: [contractId], references: [id])
  description String
  period      RecurringPeriod
  amount      Decimal           @db.Decimal(12, 2)
  startDate   DateTime
  endDate     DateTime?
  createdAt   DateTime          @default(now())
  lineItems   InvoiceLineItem[]
}

model AdhocCharge {
  id                   String            @id @default(uuid())
  contractId           String
  contract             Contract          @relation(fields: [contractId], references: [id])
  description          String
  amount               Decimal           @db.Decimal(12, 2)
  occurredOn           DateTime
  createdByAdminUserId String
  createdByAdminUser   AdminUser         @relation(fields: [createdByAdminUserId], references: [id])
  createdAt            DateTime          @default(now())
  lineItems            InvoiceLineItem[]
}

model Invoice {
  id          String            @id @default(uuid())
  contractId  String
  contract    Contract          @relation(fields: [contractId], references: [id])
  periodStart DateTime
  periodEnd   DateTime
  issueDate   DateTime?
  dueDate     DateTime
  status      InvoiceStatus     @default(DRAFT)
  totalAmount Decimal           @db.Decimal(12, 2) @default(0)
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  lineItems   InvoiceLineItem[]
  pdfs        InvoicePdf[]
}

model InvoiceLineItem {
  id              String                  @id @default(uuid())
  invoiceId       String
  invoice         Invoice                 @relation(fields: [invoiceId], references: [id])
  description     String
  quantity        Int                     @default(1)
  unitPrice       Decimal                 @db.Decimal(12, 2)
  amount          Decimal                 @db.Decimal(12, 2)
  source          LineItemSource
  recurringItemId String?
  recurringItem   ContractRecurringItem?  @relation(fields: [recurringItemId], references: [id])
  adhocChargeId   String?
  adhocCharge     AdhocCharge?            @relation(fields: [adhocChargeId], references: [id])
}

model InvoicePdf {
  id        String   @id @default(uuid())
  invoiceId String
  invoice   Invoice  @relation(fields: [invoiceId], references: [id])
  version   Int
  filePath  String
  createdAt DateTime @default(now())

  @@unique([invoiceId, version])
}

model AdminUser {
  id           String        @id @default(uuid())
  email        String        @unique
  passwordHash String
  role         AdminRole
  createdAt    DateTime      @default(now())
  adhocCharges AdhocCharge[]
}

model PortalUser {
  id           String   @id @default(uuid())
  customerId   String   @unique
  customer     Customer @relation(fields: [customerId], references: [id])
  passwordHash String
  createdAt    DateTime @default(now())
}
```

- [ ] **Step 4: Create `apps/api/src/prisma/prisma.service.ts`**

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

- [ ] **Step 5: Create `apps/api/src/prisma/prisma.module.ts`**

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

`@Global()` means every later module can inject `PrismaService` just by having `PrismaModule` imported once in `AppModule` — no need to re-import it in `customers`, `contracts`, or `invoices` modules.

- [ ] **Step 6: Write the test — `apps/api/src/prisma/prisma.module.spec.ts`**

This test compiles the module without calling `app.init()`, so `onModuleInit` (and the real DB `$connect()`) never runs — no live database needed.

```typescript
import { Test } from '@nestjs/testing';
import { PrismaModule } from './prisma.module';
import { PrismaService } from './prisma.service';

describe('PrismaModule', () => {
  it('provides an injectable PrismaService', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();

    const service = moduleRef.get(PrismaService);
    expect(service).toBeInstanceOf(PrismaService);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npm test --workspace=api -- prisma.module.spec.ts`
Expected: FAIL — cannot find module `./prisma.module` (files not compilable yet without `@prisma/client` generated). Continue to next step to fix.

- [ ] **Step 8: Generate the Prisma client**

Run: `npm run prisma:generate --workspace=api`
Expected: `Generated Prisma Client` message, no errors.

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test --workspace=api -- prisma.module.spec.ts`
Expected: PASS — `PrismaModule > provides an injectable PrismaService`

- [ ] **Step 10: Create the migration (requires local Postgres running)**

Run: `docker compose up -d` (from repo root, starts local Postgres from Step 1)
Run: `npm run prisma:migrate --workspace=api -- --name init`
Expected: migration files created under `apps/api/prisma/migrations/`, applied successfully to the local `billing` database.

- [ ] **Step 11: Create `apps/api/prisma/seed.ts`**

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'change-me-please';

  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin user ${email} already exists, skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.adminUser.create({
    data: { email, passwordHash, role: 'ADMIN' },
  });
  console.log(`Created seed admin user: ${email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 12: Run the seed script**

Run: `npm run prisma:seed --workspace=api`
Expected: `Created seed admin user: admin@example.com` (or whatever `.env` sets).

- [ ] **Step 13: Wire `PrismaModule` into `AppModule`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  controllers: [AppController],
})
export class AppModule {}
```

- [ ] **Step 14: Run the full test suite to confirm nothing broke**

Run: `npm test --workspace=api`
Expected: PASS — both `app.controller.spec.ts` and `prisma.module.spec.ts` green.

- [ ] **Step 15: Commit**

```bash
git add apps/api/prisma apps/api/src/prisma apps/api/src/app.module.ts apps/api/.env.example docker-compose.yml
git commit -m "feat: add Prisma schema, PrismaService, and admin seed script"
```

---

### Task 3: Admin authentication (JWT) + role-based access guard

**Files:**
- Create: `apps/api/src/auth/admin-role.enum.ts`
- Create: `apps/api/src/auth/roles.decorator.ts`
- Create: `apps/api/src/auth/roles.guard.ts`
- Create: `apps/api/src/auth/jwt-admin.strategy.ts`
- Create: `apps/api/src/auth/jwt-admin-auth.guard.ts`
- Create: `apps/api/src/auth/dto/admin-login.dto.ts`
- Create: `apps/api/src/auth/admin-auth.service.ts`
- Create: `apps/api/src/auth/admin-auth.controller.ts`
- Create: `apps/api/src/auth/auth.module.ts`
- Test: `apps/api/src/auth/admin-auth.service.spec.ts`
- Test: `apps/api/src/auth/roles.guard.spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService` (from Task 2, injected via constructor).
- Produces: `AdminAuthService.validateAndLogin(email: string, password: string): Promise<{ accessToken: string }>` — throws `UnauthorizedException` on bad credentials.
- Produces: `@Roles(...roles: AdminRole[])` decorator and `RolesGuard` — every later admin controller uses `@UseGuards(JwtAdminAuthGuard, RolesGuard)` at the controller level and `@Roles(...)` per-handler.
- Produces: request-attached `req.user = { userId: string; role: AdminRole }` after `JwtAdminAuthGuard` runs — later tasks read `req.user.userId` (e.g. for `createdByAdminUserId`).
- Produces: `POST /admin/auth/login` endpoint.

- [ ] **Step 1: Create `apps/api/src/auth/admin-role.enum.ts`**

```typescript
export { AdminRole } from '@prisma/client';
```

- [ ] **Step 2: Create `apps/api/src/auth/roles.decorator.ts`**

```typescript
import { SetMetadata } from '@nestjs/common';
import { AdminRole } from './admin-role.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 3: Create `apps/api/src/auth/roles.guard.ts`**

```typescript
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { AdminRole } from './admin-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<AdminRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as { role?: AdminRole } | undefined;
    if (!user || !user.role || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('이 작업을 수행할 권한이 없습니다.');
    }
    return true;
  }
}
```

- [ ] **Step 4: Write the failing test — `apps/api/src/auth/roles.guard.spec.ts`**

```typescript
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function buildContext(user: { role?: string } | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('allows access when no roles are required', () => {
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(buildContext({ role: 'SALES' }))).toBe(true);
  });

  it('allows access when the user role is in the required list', () => {
    const reflector = { getAllAndOverride: () => ['ACCOUNTING', 'ADMIN'] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(guard.canActivate(buildContext({ role: 'ACCOUNTING' }))).toBe(true);
  });

  it('denies access when the user role is not in the required list', () => {
    const reflector = { getAllAndOverride: () => ['ACCOUNTING', 'ADMIN'] } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    expect(() => guard.canActivate(buildContext({ role: 'SALES' }))).toThrow('이 작업을 수행할 권한이 없습니다.');
  });
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test --workspace=api -- roles.guard.spec.ts`
Expected: PASS — all 3 cases green.

- [ ] **Step 6: Create `apps/api/src/auth/dto/admin-login.dto.ts`**

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class AdminLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

- [ ] **Step 7: Create `apps/api/src/auth/admin-auth.service.ts`**

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateAndLogin(email: string, password: string): Promise<{ accessToken: string }> {
    const adminUser = await this.prisma.adminUser.findUnique({ where: { email } });
    if (!adminUser) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const passwordMatches = await bcrypt.compare(password, adminUser.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const accessToken = await this.jwtService.signAsync(
      { sub: adminUser.id, role: adminUser.role },
      { secret: this.config.get<string>('JWT_ADMIN_SECRET'), expiresIn: '8h' },
    );

    return { accessToken };
  }
}
```

- [ ] **Step 8: Write the failing test — `apps/api/src/auth/admin-auth.service.spec.ts`**

```typescript
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AdminAuthService } from './admin-auth.service';

jest.mock('bcryptjs');

describe('AdminAuthService', () => {
  const adminUser = { id: 'admin-1', email: 'admin@example.com', passwordHash: 'hash', role: 'ADMIN' };

  function buildService(overrides: Partial<{ findUnique: jest.Mock }> = {}) {
    const prisma = {
      adminUser: { findUnique: overrides.findUnique ?? jest.fn().mockResolvedValue(adminUser) },
    } as any;
    const jwtService = { signAsync: jest.fn().mockResolvedValue('signed-token') } as any;
    const config = { get: jest.fn().mockReturnValue('admin-secret') } as any;
    return { service: new AdminAuthService(prisma, jwtService, config), prisma, jwtService };
  }

  it('returns an access token for valid credentials', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const { service, jwtService } = buildService();

    const result = await service.validateAndLogin('admin@example.com', 'correct-password');

    expect(result).toEqual({ accessToken: 'signed-token' });
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: 'admin-1', role: 'ADMIN' },
      { secret: 'admin-secret', expiresIn: '8h' },
    );
  });

  it('throws UnauthorizedException when the user does not exist', async () => {
    const { service } = buildService({ findUnique: jest.fn().mockResolvedValue(null) });

    await expect(service.validateAndLogin('missing@example.com', 'whatever')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when the password does not match', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const { service } = buildService();

    await expect(service.validateAndLogin('admin@example.com', 'wrong-password')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test --workspace=api -- admin-auth.service.spec.ts`
Expected: PASS — all 3 cases green.

- [ ] **Step 10: Create `apps/api/src/auth/jwt-admin.strategy.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AdminRole } from './admin-role.enum';

interface AdminJwtPayload {
  sub: string;
  role: AdminRole;
}

@Injectable()
export class JwtAdminStrategy extends PassportStrategy(Strategy, 'jwt-admin') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ADMIN_SECRET'),
    });
  }

  validate(payload: AdminJwtPayload) {
    return { userId: payload.sub, role: payload.role };
  }
}
```

- [ ] **Step 11: Create `apps/api/src/auth/jwt-admin-auth.guard.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAdminAuthGuard extends AuthGuard('jwt-admin') {}
```

- [ ] **Step 12: Create `apps/api/src/auth/admin-auth.controller.ts`**

```typescript
import { Body, Controller, Post } from '@nestjs/common';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuthService.validateAndLogin(dto.email, dto.password);
  }
}
```

- [ ] **Step 13: Create `apps/api/src/auth/auth.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { JwtAdminStrategy } from './jwt-admin.strategy';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AdminAuthController],
  providers: [AdminAuthService, JwtAdminStrategy, RolesGuard],
  exports: [RolesGuard],
})
export class AuthModule {}
```

- [ ] **Step 14: Wire `AuthModule` into `AppModule`**

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule],
  controllers: [AppController],
})
export class AppModule {}
```

- [ ] **Step 15: Run the full test suite**

Run: `npm test --workspace=api`
Expected: PASS — all specs from Tasks 1–3 green.

- [ ] **Step 16: Commit**

```bash
git add apps/api/src/auth apps/api/src/app.module.ts
git commit -m "feat: add admin JWT authentication and role-based access guard"
```

---

### Task 4: Customers module (CRUD + portal account creation)

**Files:**
- Create: `apps/api/src/customers/dto/create-customer.dto.ts`
- Create: `apps/api/src/customers/dto/update-customer.dto.ts`
- Create: `apps/api/src/customers/customers.service.ts`
- Create: `apps/api/src/customers/customers.controller.ts`
- Create: `apps/api/src/customers/customers.module.ts`
- Test: `apps/api/src/customers/customers.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService` (Task 2), `JwtAdminAuthGuard`/`RolesGuard`/`Roles`/`AdminRole` (Task 3).
- Produces: `CustomersService.create/findAll/findOne/update/createPortalAccount` — `findOne(id)` throws `NotFoundException` if missing; every other module that needs to look up a customer by id should call this rather than querying Prisma directly.
- Produces: `POST/GET/PATCH /admin/customers`, `POST /admin/customers/:id/portal-account`.

- [ ] **Step 1: Create `apps/api/src/customers/dto/create-customer.dto.ts`**

```typescript
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { CustomerType } from '@prisma/client';

export class CreateCustomerDto {
  @IsEnum(CustomerType)
  type: CustomerType;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  businessRegNo?: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
```

- [ ] **Step 2: Create `apps/api/src/customers/dto/update-customer.dto.ts`**

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateCustomerDto } from './create-customer.dto';

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}
```

- [ ] **Step 3: Create `apps/api/src/customers/customers.service.ts`**

```typescript
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: dto });
  }

  findAll() {
    return this.prisma.customer.findMany();
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException('고객을 찾을 수 없습니다.');
    }
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async createPortalAccount(id: string): Promise<{ email: string; temporaryPassword: string }> {
    const customer = await this.findOne(id);
    const existing = await this.prisma.portalUser.findUnique({ where: { customerId: id } });
    if (existing) {
      throw new ConflictException('이미 포털 계정이 존재합니다.');
    }

    const temporaryPassword = randomBytes(9).toString('base64');
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    await this.prisma.portalUser.create({ data: { customerId: id, passwordHash } });

    return { email: customer.email, temporaryPassword };
  }
}
```

- [ ] **Step 4: Write the failing test — `apps/api/src/customers/customers.service.spec.ts`**

```typescript
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';

describe('CustomersService', () => {
  const customer = { id: 'cust-1', email: 'cust@example.com', name: 'ACME', type: 'COMPANY' };

  function buildService(overrides: any = {}) {
    const prisma = {
      customer: {
        create: jest.fn().mockResolvedValue(customer),
        findMany: jest.fn().mockResolvedValue([customer]),
        findUnique: jest.fn().mockResolvedValue(customer),
        update: jest.fn().mockResolvedValue(customer),
      },
      portalUser: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'portal-1', customerId: 'cust-1' }),
      },
      ...overrides,
    } as any;
    return { service: new CustomersService(prisma), prisma };
  }

  it('throws NotFoundException when the customer does not exist', async () => {
    const { service, prisma } = buildService();
    prisma.customer.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
  });

  it('creates a portal account with a generated temporary password', async () => {
    const { service, prisma } = buildService();

    const result = await service.createPortalAccount('cust-1');

    expect(result.email).toBe('cust@example.com');
    expect(result.temporaryPassword).toEqual(expect.any(String));
    expect(prisma.portalUser.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ customerId: 'cust-1' }) }),
    );
  });

  it('throws ConflictException when a portal account already exists', async () => {
    const { service, prisma } = buildService({
      portalUser: {
        findUnique: jest.fn().mockResolvedValue({ id: 'portal-1', customerId: 'cust-1' }),
        create: jest.fn(),
      },
    });

    await expect(service.createPortalAccount('cust-1')).rejects.toThrow(ConflictException);
  });
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test --workspace=api -- customers.service.spec.ts`
Expected: PASS — all 3 cases green.

- [ ] **Step 6: Create `apps/api/src/customers/customers.controller.ts`**

```typescript
import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAdminAuthGuard } from '../auth/jwt-admin-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminRole } from '../auth/admin-role.enum';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('admin/customers')
@UseGuards(JwtAdminAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles(AdminRole.SALES, AdminRole.ACCOUNTING, AdminRole.ADMIN)
  findAll() {
    return this.customersService.findAll();
  }

  @Get(':id')
  @Roles(AdminRole.SALES, AdminRole.ACCOUNTING, AdminRole.ADMIN)
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Post()
  @Roles(AdminRole.SALES, AdminRole.ADMIN)
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Patch(':id')
  @Roles(AdminRole.SALES, AdminRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  @Post(':id/portal-account')
  @Roles(AdminRole.SALES, AdminRole.ADMIN)
  createPortalAccount(@Param('id') id: string) {
    return this.customersService.createPortalAccount(id);
  }
}
```

- [ ] **Step 7: Create `apps/api/src/customers/customers.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
```

- [ ] **Step 8: Wire `CustomersModule` into `AppModule`**

Add `CustomersModule` to the `imports` array in `apps/api/src/app.module.ts` (alongside `ConfigModule`, `PrismaModule`, `AuthModule`).

- [ ] **Step 9: Run the full test suite**

Run: `npm test --workspace=api`
Expected: PASS — all specs from Tasks 1–4 green.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/customers apps/api/src/app.module.ts
git commit -m "feat: add customers CRUD module with portal account creation"
```

---

### Task 5: Contracts module (contract + recurring items + adhoc charges)

**Files:**
- Create: `apps/api/src/contracts/dto/create-contract.dto.ts`
- Create: `apps/api/src/contracts/dto/create-recurring-item.dto.ts`
- Create: `apps/api/src/contracts/dto/create-adhoc-charge.dto.ts`
- Create: `apps/api/src/contracts/contracts.service.ts`
- Create: `apps/api/src/contracts/contracts.controller.ts`
- Create: `apps/api/src/contracts/contracts.module.ts`
- Test: `apps/api/src/contracts/contracts.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService` (Task 2), auth guards/decorators (Task 3).
- Produces: `ContractsService.create/findAll/findOne/addRecurringItem/addAdhocCharge` — `findOne(id)` throws `NotFoundException` if missing. `addAdhocCharge(contractId, dto, createdByAdminUserId)` is the exact signature Task 6/7 rely on for understanding how `AdhocCharge.createdByAdminUserId` gets populated (via `req.user.userId` from `JwtAdminAuthGuard`).
- Produces: `POST/GET /admin/contracts`, `POST /admin/contracts/:id/recurring-items`, `POST /admin/contracts/:id/adhoc-charges`.

- [ ] **Step 1: Create `apps/api/src/contracts/dto/create-contract.dto.ts`**

```typescript
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class CreateContractDto {
  @IsUUID()
  customerId: string;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
```

- [ ] **Step 2: Create `apps/api/src/contracts/dto/create-recurring-item.dto.ts`**

```typescript
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { RecurringPeriod } from '@prisma/client';

export class CreateRecurringItemDto {
  @IsString()
  description: string;

  @IsEnum(RecurringPeriod)
  period: RecurringPeriod;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
```

- [ ] **Step 3: Create `apps/api/src/contracts/dto/create-adhoc-charge.dto.ts`**

```typescript
import { IsDateString, IsNumber, IsString, Min } from 'class-validator';

export class CreateAdhocChargeDto {
  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsDateString()
  occurredOn: string;
}
```

- [ ] **Step 4: Create `apps/api/src/contracts/contracts.service.ts`**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { CreateRecurringItemDto } from './dto/create-recurring-item.dto';
import { CreateAdhocChargeDto } from './dto/create-adhoc-charge.dto';

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateContractDto) {
    return this.prisma.contract.create({
      data: {
        customerId: dto.customerId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  findAll() {
    return this.prisma.contract.findMany({ include: { recurringItems: true, adhocCharges: true } });
  }

  async findOne(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { recurringItems: true, adhocCharges: true },
    });
    if (!contract) {
      throw new NotFoundException('계약을 찾을 수 없습니다.');
    }
    return contract;
  }

  async addRecurringItem(contractId: string, dto: CreateRecurringItemDto) {
    await this.findOne(contractId);
    return this.prisma.contractRecurringItem.create({
      data: {
        contractId,
        description: dto.description,
        period: dto.period,
        amount: dto.amount,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  async addAdhocCharge(contractId: string, dto: CreateAdhocChargeDto, createdByAdminUserId: string) {
    await this.findOne(contractId);
    return this.prisma.adhocCharge.create({
      data: {
        contractId,
        description: dto.description,
        amount: dto.amount,
        occurredOn: new Date(dto.occurredOn),
        createdByAdminUserId,
      },
    });
  }
}
```

- [ ] **Step 5: Write the failing test — `apps/api/src/contracts/contracts.service.spec.ts`**

```typescript
import { NotFoundException } from '@nestjs/common';
import { ContractsService } from './contracts.service';

describe('ContractsService', () => {
  const contract = { id: 'contract-1', customerId: 'cust-1', recurringItems: [], adhocCharges: [] };

  function buildService(overrides: any = {}) {
    const prisma = {
      contract: {
        create: jest.fn().mockResolvedValue(contract),
        findMany: jest.fn().mockResolvedValue([contract]),
        findUnique: jest.fn().mockResolvedValue(contract),
      },
      contractRecurringItem: {
        create: jest.fn().mockResolvedValue({ id: 'item-1', contractId: 'contract-1' }),
      },
      adhocCharge: {
        create: jest.fn().mockResolvedValue({ id: 'charge-1', contractId: 'contract-1' }),
      },
      ...overrides,
    } as any;
    return { service: new ContractsService(prisma), prisma };
  }

  it('throws NotFoundException when adding a recurring item to a missing contract', async () => {
    const { service, prisma } = buildService();
    prisma.contract.findUnique.mockResolvedValue(null);

    await expect(
      service.addRecurringItem('missing', {
        description: '월 이용료',
        period: 'MONTHLY',
        amount: 100000,
        startDate: '2026-01-01',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('creates a recurring item for an existing contract', async () => {
    const { service, prisma } = buildService();

    const result = await service.addRecurringItem('contract-1', {
      description: '월 이용료',
      period: 'MONTHLY',
      amount: 100000,
      startDate: '2026-01-01',
    });

    expect(result).toEqual({ id: 'item-1', contractId: 'contract-1' });
    expect(prisma.contractRecurringItem.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ contractId: 'contract-1', amount: 100000 }) }),
    );
  });

  it('creates an adhoc charge tagged with the creating admin user', async () => {
    const { service, prisma } = buildService();

    const result = await service.addAdhocCharge(
      'contract-1',
      { description: '추가 작업비', amount: 50000, occurredOn: '2026-07-01' },
      'admin-1',
    );

    expect(result).toEqual({ id: 'charge-1', contractId: 'contract-1' });
    expect(prisma.adhocCharge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contractId: 'contract-1', createdByAdminUserId: 'admin-1' }),
      }),
    );
  });
});
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test --workspace=api -- contracts.service.spec.ts`
Expected: PASS — all 3 cases green.

- [ ] **Step 7: Create `apps/api/src/contracts/contracts.controller.ts`**

```typescript
import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAdminAuthGuard } from '../auth/jwt-admin-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminRole } from '../auth/admin-role.enum';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { CreateRecurringItemDto } from './dto/create-recurring-item.dto';
import { CreateAdhocChargeDto } from './dto/create-adhoc-charge.dto';

interface AuthenticatedRequest {
  user: { userId: string; role: AdminRole };
}

@Controller('admin/contracts')
@UseGuards(JwtAdminAuthGuard, RolesGuard)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  @Roles(AdminRole.SALES, AdminRole.ACCOUNTING, AdminRole.ADMIN)
  findAll() {
    return this.contractsService.findAll();
  }

  @Get(':id')
  @Roles(AdminRole.SALES, AdminRole.ACCOUNTING, AdminRole.ADMIN)
  findOne(@Param('id') id: string) {
    return this.contractsService.findOne(id);
  }

  @Post()
  @Roles(AdminRole.SALES, AdminRole.ADMIN)
  create(@Body() dto: CreateContractDto) {
    return this.contractsService.create(dto);
  }

  @Post(':id/recurring-items')
  @Roles(AdminRole.SALES, AdminRole.ADMIN)
  addRecurringItem(@Param('id') id: string, @Body() dto: CreateRecurringItemDto) {
    return this.contractsService.addRecurringItem(id, dto);
  }

  @Post(':id/adhoc-charges')
  @Roles(AdminRole.SALES, AdminRole.ACCOUNTING, AdminRole.ADMIN)
  addAdhocCharge(@Param('id') id: string, @Body() dto: CreateAdhocChargeDto, @Req() req: AuthenticatedRequest) {
    return this.contractsService.addAdhocCharge(id, dto, req.user.userId);
  }
}
```

- [ ] **Step 8: Create `apps/api/src/contracts/contracts.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

@Module({
  controllers: [ContractsController],
  providers: [ContractsService],
})
export class ContractsModule {}
```

- [ ] **Step 9: Wire `ContractsModule` into `AppModule`**

Add `ContractsModule` to the `imports` array in `apps/api/src/app.module.ts`.

- [ ] **Step 10: Run the full test suite**

Run: `npm test --workspace=api`
Expected: PASS — all specs from Tasks 1–5 green.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/contracts apps/api/src/app.module.ts
git commit -m "feat: add contracts module with recurring items and adhoc charges"
```

---

### Task 6: Invoice generation (preview + batch generate, dedup'd)

This is the core business logic task — most heavily tested per the design spec's "중복 청구 방지" (duplicate-charge prevention) requirement.

**Files:**
- Create: `apps/api/src/invoices/invoice-preview.types.ts`
- Create: `apps/api/src/invoices/dto/generate-invoices.dto.ts`
- Create: `apps/api/src/invoices/invoice-generation.service.ts`
- Create: `apps/api/src/invoices/invoices.controller.ts`
- Create: `apps/api/src/invoices/invoices.module.ts`
- Test: `apps/api/src/invoices/invoice-generation.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `PrismaService` (Task 2), auth guards/decorators (Task 3). Reads Prisma models `Contract`, `ContractRecurringItem`, `AdhocCharge`, `Invoice`, `InvoiceLineItem` (Task 2).
- Produces: `InvoiceGenerationService.previewGeneration(periodStart: Date, periodEnd: Date): Promise<ContractInvoicePreview[]>` and `.generateInvoices(periodStart: Date, periodEnd: Date): Promise<Invoice[]>` (Invoice includes `lineItems`). Task 7 (issuance) reads `Invoice.id`, `Invoice.status`, `Invoice.totalAmount`, `Invoice.dueDate`, `Invoice.lineItems` produced here.
- Produces: `POST /admin/invoices/preview`, `POST /admin/invoices/generate`.

- [ ] **Step 1: Create `apps/api/src/invoices/invoice-preview.types.ts`**

```typescript
import { AdhocCharge, ContractRecurringItem } from '@prisma/client';

export interface ContractInvoicePreview {
  contractId: string;
  recurringItems: ContractRecurringItem[];
  adhocCharges: AdhocCharge[];
}
```

- [ ] **Step 2: Create `apps/api/src/invoices/dto/generate-invoices.dto.ts`**

```typescript
import { IsDateString } from 'class-validator';

export class GenerateInvoicesDto {
  @IsDateString()
  periodStart: string;

  @IsDateString()
  periodEnd: string;
}
```

- [ ] **Step 3: Create `apps/api/src/invoices/invoice-generation.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { AdhocCharge, ContractRecurringItem, Invoice, LineItemSource, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ContractInvoicePreview } from './invoice-preview.types';

const NET_DAYS = 14;

@Injectable()
export class InvoiceGenerationService {
  constructor(private readonly prisma: PrismaService) {}

  async previewGeneration(periodStart: Date, periodEnd: Date): Promise<ContractInvoicePreview[]> {
    const contracts = await this.prisma.contract.findMany({
      where: { status: 'ACTIVE' },
      include: { recurringItems: true, adhocCharges: true },
    });

    const previews: ContractInvoicePreview[] = [];

    for (const contract of contracts) {
      const dueRecurringItems = contract.recurringItems.filter((item) =>
        this.isRecurringItemDueInPeriod(item, periodStart, periodEnd),
      );
      const uninvoicedRecurringItems = await this.filterUninvoicedRecurring(
        dueRecurringItems,
        periodStart,
        periodEnd,
      );

      const chargesInPeriod = contract.adhocCharges.filter(
        (charge) => charge.occurredOn >= periodStart && charge.occurredOn <= periodEnd,
      );
      const uninvoicedAdhocCharges = await this.filterUninvoicedAdhoc(chargesInPeriod);

      if (uninvoicedRecurringItems.length === 0 && uninvoicedAdhocCharges.length === 0) {
        continue;
      }

      previews.push({
        contractId: contract.id,
        recurringItems: uninvoicedRecurringItems,
        adhocCharges: uninvoicedAdhocCharges,
      });
    }

    return previews;
  }

  async generateInvoices(periodStart: Date, periodEnd: Date): Promise<Invoice[]> {
    const previews = await this.previewGeneration(periodStart, periodEnd);
    const invoices: Invoice[] = [];

    for (const preview of previews) {
      const lineItemsInput = [
        ...preview.recurringItems.map((item) => ({
          description: item.description,
          quantity: 1,
          unitPrice: item.amount,
          amount: item.amount,
          source: LineItemSource.RECURRING,
          recurringItemId: item.id,
        })),
        ...preview.adhocCharges.map((charge) => ({
          description: charge.description,
          quantity: 1,
          unitPrice: charge.amount,
          amount: charge.amount,
          source: LineItemSource.ADHOC,
          adhocChargeId: charge.id,
        })),
      ];

      const totalAmount = lineItemsInput.reduce(
        (sum, item) => sum.plus(new Prisma.Decimal(item.amount.toString())),
        new Prisma.Decimal(0),
      );

      const invoice = await this.prisma.invoice.create({
        data: {
          contractId: preview.contractId,
          periodStart,
          periodEnd,
          dueDate: this.calculateDueDate(periodEnd),
          totalAmount,
          lineItems: { create: lineItemsInput },
        },
        include: { lineItems: true },
      });

      invoices.push(invoice);
    }

    return invoices;
  }

  private async filterUninvoicedRecurring(
    items: ContractRecurringItem[],
    periodStart: Date,
    periodEnd: Date,
  ): Promise<ContractRecurringItem[]> {
    if (items.length === 0) return [];

    const alreadyInvoiced = await this.prisma.invoiceLineItem.findMany({
      where: {
        recurringItemId: { in: items.map((item) => item.id) },
        invoice: { periodStart: { lte: periodEnd }, periodEnd: { gte: periodStart } },
      },
      select: { recurringItemId: true },
    });
    const invoicedIds = new Set(alreadyInvoiced.map((line) => line.recurringItemId));

    return items.filter((item) => !invoicedIds.has(item.id));
  }

  private async filterUninvoicedAdhoc(charges: AdhocCharge[]): Promise<AdhocCharge[]> {
    if (charges.length === 0) return [];

    const alreadyInvoiced = await this.prisma.invoiceLineItem.findMany({
      where: { adhocChargeId: { in: charges.map((charge) => charge.id) } },
      select: { adhocChargeId: true },
    });
    const invoicedIds = new Set(alreadyInvoiced.map((line) => line.adhocChargeId));

    return charges.filter((charge) => !invoicedIds.has(charge.id));
  }

  private isRecurringItemDueInPeriod(item: ContractRecurringItem, periodStart: Date, periodEnd: Date): boolean {
    const startsBeforePeriodEnds = item.startDate <= periodEnd;
    const endsAfterPeriodStarts = !item.endDate || item.endDate >= periodStart;
    return startsBeforePeriodEnds && endsAfterPeriodStarts;
  }

  private calculateDueDate(periodEnd: Date): Date {
    const due = new Date(periodEnd);
    due.setDate(due.getDate() + NET_DAYS);
    return due;
  }
}
```

- [ ] **Step 4: Write the failing test — `apps/api/src/invoices/invoice-generation.service.spec.ts`**

```typescript
import { InvoiceGenerationService } from './invoice-generation.service';

describe('InvoiceGenerationService', () => {
  const periodStart = new Date('2026-07-01');
  const periodEnd = new Date('2026-07-31');

  const recurringItem = {
    id: 'recurring-1',
    contractId: 'contract-1',
    description: '월 이용료',
    period: 'MONTHLY',
    amount: 100000,
    startDate: new Date('2026-01-01'),
    endDate: null,
  };

  const adhocCharge = {
    id: 'adhoc-1',
    contractId: 'contract-1',
    description: '추가 작업비',
    amount: 50000,
    occurredOn: new Date('2026-07-15'),
  };

  const contract = {
    id: 'contract-1',
    status: 'ACTIVE',
    recurringItems: [recurringItem],
    adhocCharges: [adhocCharge],
  };

  function buildService(overrides: any = {}) {
    const prisma = {
      contract: { findMany: jest.fn().mockResolvedValue([contract]) },
      invoiceLineItem: { findMany: jest.fn().mockResolvedValue([]) },
      invoice: {
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: 'invoice-1', ...data, lineItems: data.lineItems.create }),
        ),
      },
      ...overrides,
    } as any;
    return { service: new InvoiceGenerationService(prisma), prisma };
  }

  it('includes a recurring item and an adhoc charge that have not been invoiced yet', async () => {
    const { service } = buildService();

    const previews = await service.previewGeneration(periodStart, periodEnd);

    expect(previews).toEqual([
      { contractId: 'contract-1', recurringItems: [recurringItem], adhocCharges: [adhocCharge] },
    ]);
  });

  it('excludes a recurring item already invoiced for an overlapping period', async () => {
    const { service, prisma } = buildService({
      invoiceLineItem: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ recurringItemId: 'recurring-1' }])
          .mockResolvedValueOnce([]),
      },
    });

    const previews = await service.previewGeneration(periodStart, periodEnd);

    expect(previews).toEqual([{ contractId: 'contract-1', recurringItems: [], adhocCharges: [adhocCharge] }]);
  });

  it('excludes an adhoc charge that has already been invoiced', async () => {
    const { service } = buildService({
      invoiceLineItem: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ adhocChargeId: 'adhoc-1' }]),
      },
    });

    const previews = await service.previewGeneration(periodStart, periodEnd);

    expect(previews).toEqual([
      { contractId: 'contract-1', recurringItems: [recurringItem], adhocCharges: [] },
    ]);
  });

  it('creates an invoice with a total amount equal to the sum of its line items', async () => {
    const { service, prisma } = buildService();

    const invoices = await service.generateInvoices(periodStart, periodEnd);

    expect(invoices).toHaveLength(1);
    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contractId: 'contract-1',
          totalAmount: expect.objectContaining({ d: expect.anything() }), // Prisma.Decimal internal shape
        }),
      }),
    );
    expect(invoices[0].totalAmount.toString()).toBe('150000');
  });

  it('produces no invoices for a contract with nothing to bill', async () => {
    const { service } = buildService({
      contract: {
        findMany: jest.fn().mockResolvedValue([{ ...contract, recurringItems: [], adhocCharges: [] }]),
      },
    });

    const invoices = await service.generateInvoices(periodStart, periodEnd);

    expect(invoices).toEqual([]);
  });
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test --workspace=api -- invoice-generation.service.spec.ts`
Expected: PASS — all 5 cases green. (The `totalAmount` assertion in the 4th test checks the `Prisma.Decimal` string form so it doesn't depend on the internal `Decimal.js` shape.)

- [ ] **Step 6: Create `apps/api/src/invoices/invoices.controller.ts`**

```typescript
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAdminAuthGuard } from '../auth/jwt-admin-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminRole } from '../auth/admin-role.enum';
import { InvoiceGenerationService } from './invoice-generation.service';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';

@Controller('admin/invoices')
@UseGuards(JwtAdminAuthGuard, RolesGuard)
@Roles(AdminRole.ACCOUNTING, AdminRole.ADMIN)
export class InvoicesController {
  constructor(private readonly invoiceGenerationService: InvoiceGenerationService) {}

  @Post('preview')
  preview(@Body() dto: GenerateInvoicesDto) {
    return this.invoiceGenerationService.previewGeneration(new Date(dto.periodStart), new Date(dto.periodEnd));
  }

  @Post('generate')
  generate(@Body() dto: GenerateInvoicesDto) {
    return this.invoiceGenerationService.generateInvoices(new Date(dto.periodStart), new Date(dto.periodEnd));
  }
}
```

- [ ] **Step 7: Create `apps/api/src/invoices/invoices.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoiceGenerationService } from './invoice-generation.service';

@Module({
  controllers: [InvoicesController],
  providers: [InvoiceGenerationService],
  exports: [InvoiceGenerationService],
})
export class InvoicesModule {}
```

- [ ] **Step 8: Wire `InvoicesModule` into `AppModule`**

Add `InvoicesModule` to the `imports` array in `apps/api/src/app.module.ts`.

- [ ] **Step 9: Run the full test suite**

Run: `npm test --workspace=api`
Expected: PASS — all specs from Tasks 1–6 green.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/invoices apps/api/src/app.module.ts
git commit -m "feat: add invoice preview/generation with duplicate-charge prevention"
```

---

### Task 7: Invoice issuance (PDF render + email mailer + issue endpoint)

**Files:**
- Create: `apps/api/src/invoices/invoice-pdf.service.ts`
- Create: `apps/api/src/invoices/invoice-pdf-storage.service.ts`
- Create: `apps/api/src/invoices/mailer/invoice-mailer.interface.ts`
- Create: `apps/api/src/invoices/mailer/nodemailer-invoice-mailer.ts`
- Create: `apps/api/src/invoices/invoice-issue.service.ts`
- Modify: `apps/api/src/invoices/invoices.controller.ts`
- Modify: `apps/api/src/invoices/invoices.module.ts`
- Test: `apps/api/src/invoices/invoice-issue.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (Task 2), `Invoice`/`InvoiceLineItem`/`InvoicePdf` models (Task 2), `Invoice` shape produced by Task 6's `generateInvoices`.
- Produces: `InvoiceIssueService.issueInvoice(invoiceId: string): Promise<Invoice>` — throws `ConflictException` if already `SENT`. `POST /admin/invoices/:id/issue`.
- Produces: `InvoiceMailer` interface + `INVOICE_MAILER` DI token — Task 8 does not use this, but any later real-mailer swap only needs a new provider bound to `INVOICE_MAILER`.

- [ ] **Step 1: Create `apps/api/src/invoices/invoice-pdf.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Invoice, InvoiceLineItem } from '@prisma/client';

export type InvoiceWithLineItems = Invoice & { lineItems: InvoiceLineItem[] };

@Injectable()
export class InvoicePdfService {
  render(invoice: InvoiceWithLineItems): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(18).text('청구서', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10);
      doc.text(`청구 기간: ${invoice.periodStart.toISOString().slice(0, 10)} ~ ${invoice.periodEnd.toISOString().slice(0, 10)}`);
      doc.text(`납부 기한: ${invoice.dueDate.toISOString().slice(0, 10)}`);
      doc.moveDown();

      invoice.lineItems.forEach((item) => {
        doc.text(`${item.description}  x${item.quantity}  ${item.amount.toString()}원`);
      });

      doc.moveDown();
      doc.fontSize(12).text(`합계: ${invoice.totalAmount.toString()}원`, { align: 'right' });

      doc.end();
    });
  }
}
```

- [ ] **Step 2: Create `apps/api/src/invoices/invoice-pdf-storage.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import * as path from 'path';
import { InvoicePdf } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvoicePdfStorageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async save(invoiceId: string, buffer: Buffer): Promise<InvoicePdf> {
    const existingCount = await this.prisma.invoicePdf.count({ where: { invoiceId } });
    const version = existingCount + 1;

    const dir = path.join(this.storageDir(), invoiceId);
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `v${version}.pdf`);
    await fs.writeFile(filePath, buffer);

    return this.prisma.invoicePdf.create({ data: { invoiceId, version, filePath } });
  }

  private storageDir(): string {
    return this.config.get<string>('INVOICE_STORAGE_DIR') ?? './storage/invoices';
  }
}
```

- [ ] **Step 3: Create `apps/api/src/invoices/mailer/invoice-mailer.interface.ts`**

```typescript
export interface SendInvoiceParams {
  toEmail: string;
  invoiceId: string;
  totalAmount: string;
  dueDate: Date;
  pdfBuffer: Buffer;
  pdfFileName: string;
}

export interface InvoiceMailer {
  sendInvoice(params: SendInvoiceParams): Promise<void>;
}

export const INVOICE_MAILER = Symbol('INVOICE_MAILER');
```

- [ ] **Step 4: Create `apps/api/src/invoices/mailer/nodemailer-invoice-mailer.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { InvoiceMailer, SendInvoiceParams } from './invoice-mailer.interface';

@Injectable()
export class NodemailerInvoiceMailer implements InvoiceMailer {
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST'),
      port: Number(this.config.get<string>('SMTP_PORT')),
      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendInvoice(params: SendInvoiceParams): Promise<void> {
    await this.transporter.sendMail({
      from: this.config.get<string>('MAIL_FROM'),
      to: params.toEmail,
      subject: `청구서 안내 (납부기한: ${params.dueDate.toISOString().slice(0, 10)})`,
      text: `청구 금액: ${params.totalAmount}원. 납부기한: ${params.dueDate.toISOString().slice(0, 10)}. 첨부된 PDF를 확인해 주세요.`,
      attachments: [{ filename: params.pdfFileName, content: params.pdfBuffer }],
    });
  }
}
```

- [ ] **Step 5: Create `apps/api/src/invoices/invoice-issue.service.ts`**

```typescript
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { Invoice, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicePdfStorageService } from './invoice-pdf-storage.service';
import { INVOICE_MAILER, InvoiceMailer } from './mailer/invoice-mailer.interface';

@Injectable()
export class InvoiceIssueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: InvoicePdfService,
    private readonly pdfStorage: InvoicePdfStorageService,
    @Inject(INVOICE_MAILER) private readonly mailer: InvoiceMailer,
  ) {}

  async issueInvoice(invoiceId: string): Promise<Invoice> {
    const invoice = await this.prisma.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
      include: { lineItems: true, contract: { include: { customer: true } } },
    });

    if (invoice.status === InvoiceStatus.SENT) {
      throw new ConflictException('이미 발송된 청구서입니다.');
    }

    const pdfBuffer = await this.pdfService.render(invoice);
    const pdfRecord = await this.pdfStorage.save(invoiceId, pdfBuffer);

    await this.mailer.sendInvoice({
      toEmail: invoice.contract.customer.email,
      invoiceId: invoice.id,
      totalAmount: invoice.totalAmount.toString(),
      dueDate: invoice.dueDate,
      pdfBuffer,
      pdfFileName: `invoice-${invoice.id}-v${pdfRecord.version}.pdf`,
    });

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: InvoiceStatus.SENT, issueDate: new Date() },
    });
  }
}
```

- [ ] **Step 6: Write the failing test — `apps/api/src/invoices/invoice-issue.service.spec.ts`**

```typescript
import { ConflictException } from '@nestjs/common';
import { InvoiceIssueService } from './invoice-issue.service';

describe('InvoiceIssueService', () => {
  const draftInvoice = {
    id: 'invoice-1',
    status: 'DRAFT',
    totalAmount: { toString: () => '150000' },
    dueDate: new Date('2026-08-14'),
    lineItems: [],
    contract: { customer: { email: 'cust@example.com' } },
  };

  function buildService(overrides: any = {}) {
    const prisma = {
      invoice: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(draftInvoice),
        update: jest.fn().mockResolvedValue({ ...draftInvoice, status: 'SENT' }),
      },
      ...overrides,
    } as any;
    const pdfService = { render: jest.fn().mockResolvedValue(Buffer.from('pdf-bytes')) } as any;
    const pdfStorage = { save: jest.fn().mockResolvedValue({ id: 'pdf-1', invoiceId: 'invoice-1', version: 1 }) } as any;
    const mailer = { sendInvoice: jest.fn().mockResolvedValue(undefined) } as any;

    return { service: new InvoiceIssueService(prisma, pdfService, pdfStorage, mailer), prisma, pdfService, pdfStorage, mailer };
  }

  it('renders the PDF, stores it, emails the customer, and marks the invoice SENT', async () => {
    const { service, mailer, pdfStorage } = buildService();

    const result = await service.issueInvoice('invoice-1');

    expect(pdfStorage.save).toHaveBeenCalledWith('invoice-1', Buffer.from('pdf-bytes'));
    expect(mailer.sendInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ toEmail: 'cust@example.com', invoiceId: 'invoice-1', pdfFileName: 'invoice-invoice-1-v1.pdf' }),
    );
    expect(result.status).toBe('SENT');
  });

  it('throws ConflictException when the invoice was already sent', async () => {
    const { service, prisma } = buildService();
    prisma.invoice.findUniqueOrThrow.mockResolvedValue({ ...draftInvoice, status: 'SENT' });

    await expect(service.issueInvoice('invoice-1')).rejects.toThrow(ConflictException);
  });
});
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test --workspace=api -- invoice-issue.service.spec.ts`
Expected: PASS — both cases green.

- [ ] **Step 8: Add the issue endpoint to `apps/api/src/invoices/invoices.controller.ts`**

```typescript
import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAdminAuthGuard } from '../auth/jwt-admin-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminRole } from '../auth/admin-role.enum';
import { InvoiceGenerationService } from './invoice-generation.service';
import { InvoiceIssueService } from './invoice-issue.service';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';

@Controller('admin/invoices')
@UseGuards(JwtAdminAuthGuard, RolesGuard)
@Roles(AdminRole.ACCOUNTING, AdminRole.ADMIN)
export class InvoicesController {
  constructor(
    private readonly invoiceGenerationService: InvoiceGenerationService,
    private readonly invoiceIssueService: InvoiceIssueService,
  ) {}

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

- [ ] **Step 9: Update `apps/api/src/invoices/invoices.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoiceGenerationService } from './invoice-generation.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicePdfStorageService } from './invoice-pdf-storage.service';
import { InvoiceIssueService } from './invoice-issue.service';
import { INVOICE_MAILER } from './mailer/invoice-mailer.interface';
import { NodemailerInvoiceMailer } from './mailer/nodemailer-invoice-mailer';

@Module({
  controllers: [InvoicesController],
  providers: [
    InvoiceGenerationService,
    InvoicePdfService,
    InvoicePdfStorageService,
    InvoiceIssueService,
    { provide: INVOICE_MAILER, useClass: NodemailerInvoiceMailer },
  ],
  exports: [InvoiceGenerationService],
})
export class InvoicesModule {}
```

- [ ] **Step 10: Run the full test suite**

Run: `npm test --workspace=api`
Expected: PASS — all specs from Tasks 1–7 green.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/invoices
git commit -m "feat: add invoice issuance with PDF generation and email delivery"
```

---

### Task 8: Portal authentication + portal invoice endpoints

**Files:**
- Create: `apps/api/src/auth/dto/portal-login.dto.ts`
- Create: `apps/api/src/auth/portal-auth.service.ts`
- Create: `apps/api/src/auth/portal-auth.controller.ts`
- Create: `apps/api/src/auth/jwt-portal.strategy.ts`
- Create: `apps/api/src/auth/jwt-portal-auth.guard.ts`
- Modify: `apps/api/src/auth/auth.module.ts`
- Create: `apps/api/src/invoices/portal-invoices.service.ts`
- Create: `apps/api/src/invoices/portal-invoices.controller.ts`
- Modify: `apps/api/src/invoices/invoices.module.ts`
- Test: `apps/api/src/auth/portal-auth.service.spec.ts`
- Test: `apps/api/src/invoices/portal-invoices.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `Customer`/`PortalUser`/`Invoice`/`InvoicePdf` models (Task 2), `Invoice.status === SENT` set by Task 7's `issueInvoice`.
- Produces: `PortalAuthService.validateAndLogin(email, password): Promise<{ accessToken: string }>`, `JwtPortalAuthGuard` attaching `req.user = { portalUserId: string; customerId: string }`.
- Produces: `PortalInvoicesService.findForCustomer(customerId): Promise<Invoice[]>`, `.getLatestPdfPath(invoiceId, customerId): Promise<string>` — throws `NotFoundException` if the invoice doesn't belong to the customer or has no PDF yet.
- Produces: `POST /portal/auth/login`, `GET /portal/invoices`, `GET /portal/invoices/:id/pdf`.

- [ ] **Step 1: Create `apps/api/src/auth/dto/portal-login.dto.ts`**

```typescript
import { IsEmail, IsString, MinLength } from 'class-validator';

export class PortalLoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
```

- [ ] **Step 2: Create `apps/api/src/auth/portal-auth.service.ts`**

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PortalAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateAndLogin(email: string, password: string): Promise<{ accessToken: string }> {
    const customer = await this.prisma.customer.findUnique({
      where: { email },
      include: { portalUser: true },
    });
    if (!customer || !customer.portalUser) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const passwordMatches = await bcrypt.compare(password, customer.portalUser.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const accessToken = await this.jwtService.signAsync(
      { sub: customer.portalUser.id, customerId: customer.id },
      { secret: this.config.get<string>('JWT_PORTAL_SECRET'), expiresIn: '8h' },
    );

    return { accessToken };
  }
}
```

- [ ] **Step 3: Write the failing test — `apps/api/src/auth/portal-auth.service.spec.ts`**

```typescript
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PortalAuthService } from './portal-auth.service';

jest.mock('bcryptjs');

describe('PortalAuthService', () => {
  const customer = {
    id: 'cust-1',
    email: 'cust@example.com',
    portalUser: { id: 'portal-1', passwordHash: 'hash' },
  };

  function buildService(overrides: any = {}) {
    const prisma = { customer: { findUnique: jest.fn().mockResolvedValue(customer) }, ...overrides } as any;
    const jwtService = { signAsync: jest.fn().mockResolvedValue('portal-token') } as any;
    const config = { get: jest.fn().mockReturnValue('portal-secret') } as any;
    return { service: new PortalAuthService(prisma, jwtService, config), prisma, jwtService };
  }

  it('returns an access token for valid credentials', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    const { service, jwtService } = buildService();

    const result = await service.validateAndLogin('cust@example.com', 'correct-password');

    expect(result).toEqual({ accessToken: 'portal-token' });
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: 'portal-1', customerId: 'cust-1' },
      { secret: 'portal-secret', expiresIn: '8h' },
    );
  });

  it('throws UnauthorizedException when the customer has no portal account', async () => {
    const { service } = buildService({
      customer: { findUnique: jest.fn().mockResolvedValue({ ...customer, portalUser: null }) },
    });

    await expect(service.validateAndLogin('cust@example.com', 'whatever')).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the password does not match', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    const { service } = buildService();

    await expect(service.validateAndLogin('cust@example.com', 'wrong-password')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test --workspace=api -- portal-auth.service.spec.ts`
Expected: PASS — all 3 cases green.

- [ ] **Step 5: Create `apps/api/src/auth/portal-auth.controller.ts`**

```typescript
import { Body, Controller, Post } from '@nestjs/common';
import { PortalAuthService } from './portal-auth.service';
import { PortalLoginDto } from './dto/portal-login.dto';

@Controller('portal/auth')
export class PortalAuthController {
  constructor(private readonly portalAuthService: PortalAuthService) {}

  @Post('login')
  login(@Body() dto: PortalLoginDto) {
    return this.portalAuthService.validateAndLogin(dto.email, dto.password);
  }
}
```

- [ ] **Step 6: Create `apps/api/src/auth/jwt-portal.strategy.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface PortalJwtPayload {
  sub: string;
  customerId: string;
}

@Injectable()
export class JwtPortalStrategy extends PassportStrategy(Strategy, 'jwt-portal') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_PORTAL_SECRET'),
    });
  }

  validate(payload: PortalJwtPayload) {
    return { portalUserId: payload.sub, customerId: payload.customerId };
  }
}
```

- [ ] **Step 7: Create `apps/api/src/auth/jwt-portal-auth.guard.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtPortalAuthGuard extends AuthGuard('jwt-portal') {}
```

- [ ] **Step 8: Update `apps/api/src/auth/auth.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { JwtAdminStrategy } from './jwt-admin.strategy';
import { PortalAuthController } from './portal-auth.controller';
import { PortalAuthService } from './portal-auth.service';
import { JwtPortalStrategy } from './jwt-portal.strategy';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AdminAuthController, PortalAuthController],
  providers: [AdminAuthService, JwtAdminStrategy, PortalAuthService, JwtPortalStrategy, RolesGuard],
  exports: [RolesGuard],
})
export class AuthModule {}
```

- [ ] **Step 9: Create `apps/api/src/invoices/portal-invoices.service.ts`**

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { Invoice, InvoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PortalInvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  findForCustomer(customerId: string): Promise<Invoice[]> {
    return this.prisma.invoice.findMany({
      where: { contract: { customerId }, status: InvoiceStatus.SENT },
      include: { lineItems: true },
      orderBy: { issueDate: 'desc' },
    });
  }

  async getLatestPdfPath(invoiceId: string, customerId: string): Promise<string> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, contract: { customerId } },
      include: { pdfs: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!invoice || invoice.pdfs.length === 0) {
      throw new NotFoundException('청구서 PDF를 찾을 수 없습니다.');
    }
    return invoice.pdfs[0].filePath;
  }
}
```

- [ ] **Step 10: Write the failing test — `apps/api/src/invoices/portal-invoices.service.spec.ts`**

```typescript
import { NotFoundException } from '@nestjs/common';
import { PortalInvoicesService } from './portal-invoices.service';

describe('PortalInvoicesService', () => {
  function buildService(overrides: any = {}) {
    const prisma = {
      invoice: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      ...overrides,
    } as any;
    return { service: new PortalInvoicesService(prisma), prisma };
  }

  it('lists only SENT invoices scoped to the customer', async () => {
    const { service, prisma } = buildService();

    await service.findForCustomer('cust-1');

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { contract: { customerId: 'cust-1' }, status: 'SENT' },
      }),
    );
  });

  it('throws NotFoundException when the invoice has no PDF yet', async () => {
    const { service, prisma } = buildService({
      invoice: { findFirst: jest.fn().mockResolvedValue({ id: 'invoice-1', pdfs: [] }) },
    });

    await expect(service.getLatestPdfPath('invoice-1', 'cust-1')).rejects.toThrow(NotFoundException);
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'invoice-1', contract: { customerId: 'cust-1' } } }),
    );
  });

  it('returns the highest-version PDF file path', async () => {
    const { service } = buildService({
      invoice: {
        findFirst: jest.fn().mockResolvedValue({ id: 'invoice-1', pdfs: [{ filePath: '/storage/invoice-1/v2.pdf', version: 2 }] }),
      },
    });

    const path = await service.getLatestPdfPath('invoice-1', 'cust-1');

    expect(path).toBe('/storage/invoice-1/v2.pdf');
  });
});
```

- [ ] **Step 11: Run test to verify it passes**

Run: `npm test --workspace=api -- portal-invoices.service.spec.ts`
Expected: PASS — all 3 cases green.

- [ ] **Step 12: Create `apps/api/src/invoices/portal-invoices.controller.ts`**

```typescript
import { Controller, Get, Param, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import { JwtPortalAuthGuard } from '../auth/jwt-portal-auth.guard';
import { PortalInvoicesService } from './portal-invoices.service';

interface PortalRequest {
  user: { portalUserId: string; customerId: string };
}

@Controller('portal/invoices')
@UseGuards(JwtPortalAuthGuard)
export class PortalInvoicesController {
  constructor(private readonly portalInvoicesService: PortalInvoicesService) {}

  @Get()
  findAll(@Req() req: PortalRequest) {
    return this.portalInvoicesService.findForCustomer(req.user.customerId);
  }

  @Get(':id/pdf')
  async downloadPdf(@Param('id') id: string, @Req() req: PortalRequest, @Res() res: Response) {
    const filePath = await this.portalInvoicesService.getLatestPdfPath(id, req.user.customerId);
    res.sendFile(path.resolve(filePath));
  }
}
```

- [ ] **Step 13: Update `apps/api/src/invoices/invoices.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoiceGenerationService } from './invoice-generation.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { InvoicePdfStorageService } from './invoice-pdf-storage.service';
import { InvoiceIssueService } from './invoice-issue.service';
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
    PortalInvoicesService,
    { provide: INVOICE_MAILER, useClass: NodemailerInvoiceMailer },
  ],
  exports: [InvoiceGenerationService],
})
export class InvoicesModule {}
```

- [ ] **Step 14: Run the full test suite**

Run: `npm test --workspace=api`
Expected: PASS — every spec from Tasks 1–8 green. This is the full backend MVP.

- [ ] **Step 15: Commit**

```bash
git add apps/api/src/auth apps/api/src/invoices
git commit -m "feat: add customer portal authentication and invoice viewing"
```

---

## What's next

This plan delivers a fully tested backend API. Follow-up plans (not covered here):
- `admin-web` React SPA (login, customer/contract CRUD screens, invoice generation/issue UI)
- `portal-web` React SPA (customer login, invoice list/PDF viewer)
- Phase 2 specs: PG payment integration, dunning/collections, reporting dashboard

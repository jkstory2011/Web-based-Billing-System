-- CreateEnum
CREATE TYPE "ReminderStage" AS ENUM ('FIRST', 'SECOND', 'FINAL');

-- CreateEnum
CREATE TYPE "ReminderTrigger" AS ENUM ('MANUAL', 'AUTO');

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "autoReminderOverride" BOOLEAN,
ADD COLUMN     "collectionOwnerId" TEXT;

-- CreateTable
CREATE TABLE "CollectionNote" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "authorAdminUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollectionReminder" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "stage" "ReminderStage" NOT NULL,
    "triggeredBy" "ReminderTrigger" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentByAdminUserId" TEXT,

    CONSTRAINT "CollectionReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "autoReminderEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectionNote_customerId_idx" ON "CollectionNote"("customerId");

-- CreateIndex
CREATE INDEX "CollectionNote_invoiceId_idx" ON "CollectionNote"("invoiceId");

-- CreateIndex
CREATE INDEX "CollectionReminder_invoiceId_idx" ON "CollectionReminder"("invoiceId");

-- CreateIndex
CREATE INDEX "Customer_collectionOwnerId_idx" ON "Customer"("collectionOwnerId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_collectionOwnerId_fkey" FOREIGN KEY ("collectionOwnerId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionNote" ADD CONSTRAINT "CollectionNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionNote" ADD CONSTRAINT "CollectionNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionNote" ADD CONSTRAINT "CollectionNote_authorAdminUserId_fkey" FOREIGN KEY ("authorAdminUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionReminder" ADD CONSTRAINT "CollectionReminder_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollectionReminder" ADD CONSTRAINT "CollectionReminder_sentByAdminUserId_fkey" FOREIGN KEY ("sentByAdminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

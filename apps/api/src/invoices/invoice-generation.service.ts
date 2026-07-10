import { Injectable } from '@nestjs/common';
import { AdhocCharge, ContractRecurringItem, Invoice, LineItemSource, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ContractInvoicePreview } from './invoice-preview.types';

const NET_DAYS = 14;

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

@Injectable()
export class InvoiceGenerationService {
  constructor(private readonly prisma: PrismaService) {}

  async previewGeneration(periodStart: Date, periodEnd: Date): Promise<ContractInvoicePreview[]> {
    return this.buildPreviews(this.prisma, periodStart, periodEnd);
  }

  async generateInvoices(periodStart: Date, periodEnd: Date): Promise<Invoice[]> {
    return this.prisma.$transaction(
      async (tx) => {
        const previews = await this.buildPreviews(tx, periodStart, periodEnd);
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

          const invoice = await tx.invoice.create({
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
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async buildPreviews(
    client: PrismaClientLike,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<ContractInvoicePreview[]> {
    const contracts = await client.contract.findMany({
      where: { status: 'ACTIVE' },
      include: { recurringItems: true, adhocCharges: true },
    });

    const previews: ContractInvoicePreview[] = [];

    for (const contract of contracts) {
      const dueRecurringItems = contract.recurringItems.filter((item) =>
        this.isRecurringItemDueInPeriod(item, periodStart, periodEnd),
      );
      const uninvoicedRecurringItems = await this.filterUninvoicedRecurring(
        client,
        dueRecurringItems,
        periodStart,
        periodEnd,
      );

      const chargesInPeriod = contract.adhocCharges.filter(
        (charge) => charge.occurredOn >= periodStart && charge.occurredOn <= periodEnd,
      );
      const uninvoicedAdhocCharges = await this.filterUninvoicedAdhoc(client, chargesInPeriod);

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

  private async filterUninvoicedRecurring(
    client: PrismaClientLike,
    items: ContractRecurringItem[],
    periodStart: Date,
    periodEnd: Date,
  ): Promise<ContractRecurringItem[]> {
    if (items.length === 0) return [];

    const alreadyInvoiced = await client.invoiceLineItem.findMany({
      where: {
        recurringItemId: { in: items.map((item) => item.id) },
        invoice: { periodStart: { lte: periodEnd }, periodEnd: { gte: periodStart } },
      },
      select: { recurringItemId: true },
    });
    const invoicedIds = new Set(alreadyInvoiced.map((line) => line.recurringItemId));

    return items.filter((item) => !invoicedIds.has(item.id));
  }

  private async filterUninvoicedAdhoc(client: PrismaClientLike, charges: AdhocCharge[]): Promise<AdhocCharge[]> {
    if (charges.length === 0) return [];

    const alreadyInvoiced = await client.invoiceLineItem.findMany({
      where: { adhocChargeId: { in: charges.map((charge) => charge.id) } },
      select: { adhocChargeId: true },
    });
    const invoicedIds = new Set(alreadyInvoiced.map((line) => line.adhocChargeId));

    return charges.filter((charge) => !invoicedIds.has(charge.id));
  }

  private isRecurringItemDueInPeriod(item: ContractRecurringItem, periodStart: Date, periodEnd: Date): boolean {
    const startsBeforePeriodEnds = item.startDate <= periodEnd;
    const endsAfterPeriodStarts = !item.endDate || item.endDate >= periodStart;
    if (!startsBeforePeriodEnds || !endsAfterPeriodStarts) {
      return false;
    }

    const cycleMonths = item.period === 'QUARTERLY' ? 3 : 1;
    const monthsSinceStart = this.monthsBetween(item.startDate, periodStart);
    return monthsSinceStart >= 0 && monthsSinceStart % cycleMonths === 0;
  }

  private monthsBetween(from: Date, to: Date): number {
    return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  }

  private calculateDueDate(periodEnd: Date): Date {
    const due = new Date(periodEnd);
    due.setDate(due.getDate() + NET_DAYS);
    return due;
  }
}

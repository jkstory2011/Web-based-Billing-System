import { Injectable } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export interface AgingBuckets {
  d0to30: string;
  d31to60: string;
  d61to90: string;
  d90plus: string;
}

export interface CustomerAgingSummary {
  customerId: string;
  customerName: string;
  buckets: AgingBuckets;
  totalOverdue: string;
  invoiceCount: number;
}

interface AgingAccumulator {
  customerId: string;
  customerName: string;
  invoiceCount: number;
  bucketTotals: Record<keyof AgingBuckets, Prisma.Decimal>;
  total: Prisma.Decimal;
}

@Injectable()
export class CollectionsAgingService {
  constructor(private readonly prisma: PrismaService) {}

  async getAgingReport(): Promise<CustomerAgingSummary[]> {
    const now = new Date();
    const overdueInvoices = await this.prisma.invoice.findMany({
      where: { status: InvoiceStatus.SENT, dueDate: { lt: now } },
      include: { contract: { include: { customer: true } } },
    });

    const byCustomer = new Map<string, AgingAccumulator>();

    for (const invoice of overdueInvoices) {
      const customer = invoice.contract.customer;
      const daysOverdue = Math.floor((now.getTime() - invoice.dueDate.getTime()) / MS_PER_DAY);
      const bucketKey: keyof AgingBuckets =
        daysOverdue <= 30 ? 'd0to30' : daysOverdue <= 60 ? 'd31to60' : daysOverdue <= 90 ? 'd61to90' : 'd90plus';

      let entry = byCustomer.get(customer.id);
      if (!entry) {
        entry = {
          customerId: customer.id,
          customerName: customer.name,
          invoiceCount: 0,
          bucketTotals: {
            d0to30: new Prisma.Decimal(0),
            d31to60: new Prisma.Decimal(0),
            d61to90: new Prisma.Decimal(0),
            d90plus: new Prisma.Decimal(0),
          },
          total: new Prisma.Decimal(0),
        };
        byCustomer.set(customer.id, entry);
      }

      entry.bucketTotals[bucketKey] = entry.bucketTotals[bucketKey].plus(invoice.totalAmount);
      entry.total = entry.total.plus(invoice.totalAmount);
      entry.invoiceCount += 1;
    }

    return Array.from(byCustomer.values()).map((entry) => ({
      customerId: entry.customerId,
      customerName: entry.customerName,
      invoiceCount: entry.invoiceCount,
      buckets: {
        d0to30: entry.bucketTotals.d0to30.toString(),
        d31to60: entry.bucketTotals.d31to60.toString(),
        d61to90: entry.bucketTotals.d61to90.toString(),
        d90plus: entry.bucketTotals.d90plus.toString(),
      },
      totalOverdue: entry.total.toString(),
    }));
  }
}

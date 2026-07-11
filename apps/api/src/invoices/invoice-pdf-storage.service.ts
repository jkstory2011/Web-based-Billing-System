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

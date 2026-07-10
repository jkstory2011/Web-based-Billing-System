import { Module } from '@nestjs/common';
import { InvoicesController } from './invoices.controller';
import { InvoiceGenerationService } from './invoice-generation.service';

@Module({
  controllers: [InvoicesController],
  providers: [InvoiceGenerationService],
  exports: [InvoiceGenerationService],
})
export class InvoicesModule {}

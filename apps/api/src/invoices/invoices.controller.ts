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

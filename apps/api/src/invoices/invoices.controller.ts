import { Body, Controller, Get, HttpCode, Param, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import { JwtAdminAuthGuard } from '../auth/jwt-admin-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminRole } from '../auth/admin-role.enum';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { InvoiceGenerationService } from './invoice-generation.service';
import { InvoiceIssueService } from './invoice-issue.service';
import { InvoiceReminderService } from './invoice-reminder.service';
import { InvoicesQueryService } from './invoices-query.service';
import { GenerateInvoicesDto } from './dto/generate-invoices.dto';

@Controller('admin/invoices')
@UseGuards(JwtAdminAuthGuard, RolesGuard)
@Roles(AdminRole.ACCOUNTING, AdminRole.ADMIN)
export class InvoicesController {
  constructor(
    private readonly invoiceGenerationService: InvoiceGenerationService,
    private readonly invoiceIssueService: InvoiceIssueService,
    private readonly invoiceReminderService: InvoiceReminderService,
    private readonly invoicesQueryService: InvoicesQueryService,
  ) {}

  @Get()
  findAll(@Query() query: PaginationQueryDto) {
    if (query.page === undefined && query.limit === undefined) {
      return this.invoicesQueryService.findAll();
    }
    return this.invoicesQueryService.findAllPaginated(query.page ?? 1, query.limit ?? 20);
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

  @Post(':id/remind')
  @HttpCode(204)
  remind(@Param('id') id: string) {
    return this.invoiceReminderService.sendReminder(id);
  }
}

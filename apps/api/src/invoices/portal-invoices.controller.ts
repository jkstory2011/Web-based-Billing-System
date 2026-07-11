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

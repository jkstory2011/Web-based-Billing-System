import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAdminAuthGuard } from '../auth/jwt-admin-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminRole } from '../auth/admin-role.enum';
import { CollectionsAgingService } from './collections-aging.service';

@Controller('admin/collections')
@UseGuards(JwtAdminAuthGuard, RolesGuard)
@Roles(AdminRole.ACCOUNTING, AdminRole.ADMIN)
export class CollectionsController {
  constructor(private readonly agingService: CollectionsAgingService) {}

  @Get('aging')
  getAging() {
    return this.agingService.getAgingReport();
  }
}

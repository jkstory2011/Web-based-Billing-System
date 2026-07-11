import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAdminAuthGuard } from '../auth/jwt-admin-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminRole } from '../auth/admin-role.enum';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
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
  findAll(@Query() query: PaginationQueryDto) {
    if (query.page === undefined && query.limit === undefined) {
      return this.contractsService.findAll();
    }
    return this.contractsService.findAllPaginated(query.page ?? 1, query.limit ?? 20);
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

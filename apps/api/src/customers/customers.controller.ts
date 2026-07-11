import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAdminAuthGuard } from '../auth/jwt-admin-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminRole } from '../auth/admin-role.enum';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('admin/customers')
@UseGuards(JwtAdminAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles(AdminRole.SALES, AdminRole.ACCOUNTING, AdminRole.ADMIN)
  findAll(@Query() query: PaginationQueryDto) {
    // page/limit are both optional and opt-in — omitting them keeps the
    // existing "return everything" behavior for callers that need the full
    // list (e.g. the customer picker in contract creation), so this stays
    // backward-compatible rather than forcing every consumer to paginate.
    if (query.page === undefined && query.limit === undefined) {
      return this.customersService.findAll();
    }
    return this.customersService.findAllPaginated(query.page ?? 1, query.limit ?? 20);
  }

  @Get(':id')
  @Roles(AdminRole.SALES, AdminRole.ACCOUNTING, AdminRole.ADMIN)
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Post()
  @Roles(AdminRole.SALES, AdminRole.ADMIN)
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Patch(':id')
  @Roles(AdminRole.SALES, AdminRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  @Post(':id/portal-account')
  @Roles(AdminRole.SALES, AdminRole.ADMIN)
  createPortalAccount(@Param('id') id: string) {
    return this.customersService.createPortalAccount(id);
  }
}

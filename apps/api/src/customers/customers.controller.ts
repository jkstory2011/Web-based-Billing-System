import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAdminAuthGuard } from '../auth/jwt-admin-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminRole } from '../auth/admin-role.enum';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('admin/customers')
@UseGuards(JwtAdminAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Roles(AdminRole.SALES, AdminRole.ACCOUNTING, AdminRole.ADMIN)
  findAll() {
    return this.customersService.findAll();
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

import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAdminAuthGuard } from '../auth/jwt-admin-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminRole } from '../auth/admin-role.enum';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CustomersService } from './customers.service';
import { CollectionNotesService } from './collection-notes.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateCollectionOwnerDto } from './dto/update-collection-owner.dto';
import { UpdateAutoReminderOverrideDto } from './dto/update-auto-reminder-override.dto';
import { CreateCollectionNoteDto } from './dto/create-collection-note.dto';

interface AuthenticatedRequest {
  user: { userId: string; role: AdminRole };
}

@Controller('admin/customers')
@UseGuards(JwtAdminAuthGuard, RolesGuard)
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly collectionNotesService: CollectionNotesService,
  ) {}

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

  @Patch(':id/collection-owner')
  @Roles(AdminRole.ACCOUNTING, AdminRole.ADMIN)
  setCollectionOwner(@Param('id') id: string, @Body() dto: UpdateCollectionOwnerDto) {
    return this.customersService.setCollectionOwner(id, dto.adminUserId);
  }

  @Patch(':id/auto-reminder-override')
  @Roles(AdminRole.ADMIN)
  setAutoReminderOverride(@Param('id') id: string, @Body() dto: UpdateAutoReminderOverrideDto) {
    return this.customersService.setAutoReminderOverride(id, dto.autoReminderOverride);
  }

  @Get(':id/collection-notes')
  @Roles(AdminRole.ACCOUNTING, AdminRole.ADMIN)
  listCollectionNotes(@Param('id') id: string) {
    return this.collectionNotesService.listForCustomer(id);
  }

  @Post(':id/collection-notes')
  @Roles(AdminRole.ACCOUNTING, AdminRole.ADMIN)
  createCollectionNote(@Param('id') id: string, @Body() dto: CreateCollectionNoteDto, @Req() req: AuthenticatedRequest) {
    return this.collectionNotesService.create(id, dto, req.user.userId);
  }
}

import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAdminAuthGuard } from '../auth/jwt-admin-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AdminRole } from '../auth/admin-role.enum';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('admin/settings')
@UseGuards(JwtAdminAuthGuard, RolesGuard)
@Roles(AdminRole.ADMIN)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get() {
    return this.settingsService.getSettings();
  }

  @Patch()
  update(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(dto.autoReminderEnabled);
  }
}

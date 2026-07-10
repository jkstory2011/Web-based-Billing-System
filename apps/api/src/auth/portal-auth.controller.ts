import { Body, Controller, Post } from '@nestjs/common';
import { PortalAuthService } from './portal-auth.service';
import { PortalLoginDto } from './dto/portal-login.dto';

@Controller('portal/auth')
export class PortalAuthController {
  constructor(private readonly portalAuthService: PortalAuthService) {}

  @Post('login')
  login(@Body() dto: PortalLoginDto) {
    return this.portalAuthService.validateAndLogin(dto.email, dto.password);
  }
}

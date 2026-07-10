import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { JwtAdminStrategy } from './jwt-admin.strategy';
import { PortalAuthController } from './portal-auth.controller';
import { PortalAuthService } from './portal-auth.service';
import { JwtPortalStrategy } from './jwt-portal.strategy';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AdminAuthController, PortalAuthController],
  providers: [AdminAuthService, JwtAdminStrategy, PortalAuthService, JwtPortalStrategy, RolesGuard],
  exports: [RolesGuard],
})
export class AuthModule {}

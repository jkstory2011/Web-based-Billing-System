import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtPortalAuthGuard extends AuthGuard('jwt-portal') {}

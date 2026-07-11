import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async validateAndLogin(email: string, password: string): Promise<{ accessToken: string }> {
    const adminUser = await this.prisma.adminUser.findUnique({ where: { email } });
    if (!adminUser) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const passwordMatches = await bcrypt.compare(password, adminUser.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    const accessToken = await this.jwtService.signAsync(
      { sub: adminUser.id, role: adminUser.role },
      { secret: this.config.get<string>('JWT_ADMIN_SECRET'), expiresIn: '8h' },
    );

    return { accessToken };
  }
}

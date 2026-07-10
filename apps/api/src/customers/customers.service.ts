import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: dto });
  }

  findAll() {
    return this.prisma.customer.findMany();
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      throw new NotFoundException('고객을 찾을 수 없습니다.');
    }
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async createPortalAccount(id: string): Promise<{ email: string; temporaryPassword: string }> {
    const customer = await this.findOne(id);
    const existing = await this.prisma.portalUser.findUnique({ where: { customerId: id } });
    if (existing) {
      throw new ConflictException('이미 포털 계정이 존재합니다.');
    }

    const temporaryPassword = randomBytes(9).toString('base64');
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    await this.prisma.portalUser.create({ data: { customerId: id, passwordHash } });

    return { email: customer.email, temporaryPassword };
  }
}

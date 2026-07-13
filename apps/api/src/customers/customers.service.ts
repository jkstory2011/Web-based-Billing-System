import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Customer, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedResult } from '../common/pagination.types';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCustomerDto) {
    try {
      return await this.prisma.customer.create({ data: dto });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('이미 등록된 이메일입니다.');
      }
      throw error;
    }
  }

  findAll() {
    return this.prisma.customer.findMany();
  }

  async findAllPaginated(page: number, limit: number): Promise<PaginatedResult<Customer>> {
    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({ skip: (page - 1) * limit, take: limit }),
      this.prisma.customer.count(),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { collectionOwner: { select: { id: true, email: true } } },
    });
    if (!customer) {
      throw new NotFoundException('고객을 찾을 수 없습니다.');
    }
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async setCollectionOwner(id: string, adminUserId: string | null) {
    await this.findOne(id);
    if (adminUserId !== null) {
      const admin = await this.prisma.adminUser.findUnique({ where: { id: adminUserId } });
      if (!admin) {
        throw new NotFoundException('담당자로 지정할 관리자를 찾을 수 없습니다.');
      }
    }
    return this.prisma.customer.update({
      where: { id },
      data: { collectionOwnerId: adminUserId },
      include: { collectionOwner: { select: { id: true, email: true } } },
    });
  }

  async setAutoReminderOverride(id: string, autoReminderOverride: boolean | null) {
    await this.findOne(id);
    return this.prisma.customer.update({ where: { id }, data: { autoReminderOverride } });
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

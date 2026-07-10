import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { CreateRecurringItemDto } from './dto/create-recurring-item.dto';
import { CreateAdhocChargeDto } from './dto/create-adhoc-charge.dto';

@Injectable()
export class ContractsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateContractDto) {
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) {
      throw new NotFoundException('고객을 찾을 수 없습니다.');
    }
    return this.prisma.contract.create({
      data: {
        customerId: dto.customerId,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  findAll() {
    return this.prisma.contract.findMany({ include: { recurringItems: true, adhocCharges: true } });
  }

  async findOne(id: string) {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      include: { recurringItems: true, adhocCharges: true },
    });
    if (!contract) {
      throw new NotFoundException('계약을 찾을 수 없습니다.');
    }
    return contract;
  }

  async addRecurringItem(contractId: string, dto: CreateRecurringItemDto) {
    const contract = await this.findOne(contractId);
    if (contract.status === 'TERMINATED') {
      throw new BadRequestException('해지된 계약에는 정기항목을 추가할 수 없습니다.');
    }
    return this.prisma.contractRecurringItem.create({
      data: {
        contractId,
        description: dto.description,
        period: dto.period,
        amount: dto.amount,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
      },
    });
  }

  async addAdhocCharge(contractId: string, dto: CreateAdhocChargeDto, createdByAdminUserId: string) {
    await this.findOne(contractId);
    return this.prisma.adhocCharge.create({
      data: {
        contractId,
        description: dto.description,
        amount: dto.amount,
        occurredOn: new Date(dto.occurredOn),
        createdByAdminUserId,
      },
    });
  }
}

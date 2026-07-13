import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CollectionNotesService } from './collection-notes.service';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, CollectionNotesService],
})
export class CustomersModule {}

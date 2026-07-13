import { Module } from '@nestjs/common';
import { CollectionsController } from './collections.controller';
import { CollectionsAgingService } from './collections-aging.service';

@Module({
  controllers: [CollectionsController],
  providers: [CollectionsAgingService],
})
export class CollectionsModule {}

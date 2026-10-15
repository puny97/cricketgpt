import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { MatchesService } from './matches.service';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  findAll(
    @Query()
    query: {
      page?: string;
      limit?: string;
      matchType?: string;
      gender?: string;
      from?: string;
      to?: string;
    },
  ) {
    return this.matchesService.findAll(query);
  }

  @Get(':id')
  findById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.matchesService.findById(id);
  }

  @Get(':id/scorecard')
  getScorecard(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.matchesService.getScorecard(id);
  }

  @Get(':id/innings/:inningsNumber/deliveries')
  getDeliveries(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('inningsNumber', new ParseIntPipe()) inningsNumber: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.matchesService.getDeliveries(id, inningsNumber, page, limit);
  }
}

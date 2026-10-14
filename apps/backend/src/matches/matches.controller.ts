import { Controller, Get, Query } from '@nestjs/common';
import { MatchesService } from './matches.service';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  fondAll(
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
}

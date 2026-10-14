import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
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
}

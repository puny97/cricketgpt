import { Controller, Get } from '@nestjs/common';
import { PlayersService } from './players.service';

@Controller('api/v1/players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  async getAllPlayers() {
    return this.playersService.getAllPlayers();
  }
}

import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  checkHealth() {
    return {
      status: 'ok',
      service: 'cricketgpt-api',
      timestamp: new Date().toISOString(),
    };
  }
}

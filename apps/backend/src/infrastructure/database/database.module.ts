import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

export const DATABASE = 'DATABASE';

@Module({
  providers: [
    {
      provide: DATABASE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const connectionString = config.get<string>('DATABASE_URL');

        if (!connectionString) {
          throw new Error('DATABASE_URL is not configured');
        }

        const pool = new Pool({
          connectionString,
          max: 10,
        });

        return drizzle({ client: pool });
      },
    },
  ],
  exports: [DATABASE],
})
export class DatabaseModule {}

import { pgTable, varchar, date, timestamp, uuid } from 'drizzle-orm/pg-core';

export const players = pgTable('players', {
  id: uuid('id').primaryKey(),

  fullName: varchar('full_name', {
    length: 150,
  }).notNull(),

  country: varchar('country', {
    length: 100,
  }),

  playingRole: varchar('playing_role', {
    length: 50,
  }),

  dateOfBirth: date('date_of_birth'),

  createdAt: timestamp('created_at', {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});

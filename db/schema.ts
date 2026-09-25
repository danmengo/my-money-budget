import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({autoIncrement:true}),
  ownerId: text('owner_id').notNull().default(''),
  date: text('date').notNull(),
  name: text('name').notNull(),
  amount: integer('amount').notNull(),
  category: text('category').notNull(),
  type: text('type').notNull(),
  demo: integer('demo').notNull().default(0),
}, table => [index('idx_transactions_owner_date').on(table.ownerId, table.date)]);

export const budgets = sqliteTable('budgets', {
  ownerId: text('owner_id').notNull().default(''),
  category: text('category').notNull(),
  amount: integer('amount').notNull(),
  demo: integer('demo').notNull().default(0),
}, table => [primaryKey({columns:[table.ownerId,table.category]})]);

export const goals = sqliteTable('goals', {
  id: integer('id').primaryKey({autoIncrement:true}),
  ownerId: text('owner_id').notNull().default(''),
  name: text('name').notNull(),
  type: text('type').notNull(),
  target: integer('target').notNull(),
  current: integer('current').notNull(),
  demo: integer('demo').notNull().default(0),
}, table => [index('idx_goals_owner').on(table.ownerId)]);

export const settings = sqliteTable('settings', {
  ownerId: text('owner_id').notNull().default(''),
  key: text('key').notNull(),
  value: text('value').notNull(),
}, table => [primaryKey({columns:[table.ownerId,table.key]})]);

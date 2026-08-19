import { pgTable, serial, date, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const availableDaysTable = pgTable("available_days", {
  id: serial("id").primaryKey(),
  date: date("date", { mode: "string" }).notNull().unique(),
  isAvailable: boolean("is_available").notNull().default(true),
});

export const insertAvailableDaySchema = createInsertSchema(availableDaysTable).omit({ id: true });
export type InsertAvailableDay = z.infer<typeof insertAvailableDaySchema>;
export type AvailableDay = typeof availableDaysTable.$inferSelect;

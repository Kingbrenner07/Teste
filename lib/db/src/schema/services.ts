import { pgTable, text, serial, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const servicesTable = pgTable("services", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  maxPerDay: integer("max_per_day").notNull().default(1),
  period: text("period").notNull().default("full_day"), // full_day, morning_only, afternoon_only, both_periods
  description: text("description").notNull().default(""),
  color: text("color").notNull().default("#3b82f6"),
});

export const insertServiceSchema = createInsertSchema(servicesTable).omit({ id: true });
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof servicesTable.$inferSelect;

import { Router, type IRouter } from "express";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db, availableDaysTable } from "@workspace/db";
import {
  GetAvailableDaysQueryParams,
  GetAvailableDaysResponse,
  SetAvailableDaysBody,
  SetAvailableDaysResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/available-days", async (req, res): Promise<void> => {
  const parsed = GetAvailableDaysQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { month, year } = parsed.data;
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;

  const days = await db
    .select()
    .from(availableDaysTable)
    .where(
      and(
        gte(availableDaysTable.date, startDate),
        lte(availableDaysTable.date, endDate),
      ),
    )
    .orderBy(availableDaysTable.date);

  res.json(GetAvailableDaysResponse.parse(days));
});

router.put("/available-days", async (req, res): Promise<void> => {
  const parsed = SetAvailableDaysBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { month, year, dates } = parsed.data;
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;

  // Delete existing entries for this month
  await db
    .delete(availableDaysTable)
    .where(
      and(
        gte(availableDaysTable.date, startDate),
        lte(availableDaysTable.date, endDate),
      ),
    );

  // Insert the new available days
  if (dates.length > 0) {
    await db.insert(availableDaysTable).values(
      dates.map((date) => ({
        date,
        isAvailable: true,
      })),
    );
  }

  const days = await db
    .select()
    .from(availableDaysTable)
    .where(
      and(
        gte(availableDaysTable.date, startDate),
        lte(availableDaysTable.date, endDate),
      ),
    )
    .orderBy(availableDaysTable.date);

  res.json(SetAvailableDaysResponse.parse(days));
});

export default router;

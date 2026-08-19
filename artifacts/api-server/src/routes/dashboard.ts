import { Router, type IRouter } from "express";
import { and, eq, gte, lte, count } from "drizzle-orm";
import { db, appointmentsTable, availableDaysTable } from "@workspace/db";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function serializeAppointment<T extends { createdAt: Date }>(appointment: T) {
  return {
    ...appointment,
    createdAt: appointment.createdAt.toISOString(),
  };
}

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // Start of week (Monday)
  const dayOfWeek = now.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const weekStart = monday.toISOString().split("T")[0];
  const weekEnd = new Date(monday);
  weekEnd.setDate(monday.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split("T")[0];

  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;

  // Today's appointments
  const todayAppointments = await db
    .select()
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.date, todayStr),
        eq(appointmentsTable.status, "scheduled"),
      ),
    )
    .orderBy(appointmentsTable.timeSlot);

  // Week appointments count
  const [weekRow] = await db
    .select({ count: count() })
    .from(appointmentsTable)
    .where(
      and(
        gte(appointmentsTable.date, weekStart),
        lte(appointmentsTable.date, weekEndStr),
        eq(appointmentsTable.status, "scheduled"),
      ),
    );

  // Month counts
  const [monthRow] = await db
    .select({ count: count() })
    .from(appointmentsTable)
    .where(
      and(
        gte(appointmentsTable.date, monthStart),
        lte(appointmentsTable.date, monthEnd),
      ),
    );

  const [pendingRow] = await db
    .select({ count: count() })
    .from(appointmentsTable)
    .where(
      and(
        gte(appointmentsTable.date, monthStart),
        lte(appointmentsTable.date, monthEnd),
        eq(appointmentsTable.status, "scheduled"),
      ),
    );

  const [completedRow] = await db
    .select({ count: count() })
    .from(appointmentsTable)
    .where(
      and(
        gte(appointmentsTable.date, monthStart),
        lte(appointmentsTable.date, monthEnd),
        eq(appointmentsTable.status, "completed"),
      ),
    );

  const [cancelledRow] = await db
    .select({ count: count() })
    .from(appointmentsTable)
    .where(
      and(
        gte(appointmentsTable.date, monthStart),
        lte(appointmentsTable.date, monthEnd),
        eq(appointmentsTable.status, "cancelled"),
      ),
    );

  // Available days this month
  const [availDaysRow] = await db
    .select({ count: count() })
    .from(availableDaysTable)
    .where(
      and(
        gte(availableDaysTable.date, monthStart),
        lte(availableDaysTable.date, monthEnd),
        eq(availableDaysTable.isAvailable, true),
      ),
    );

  // Next available date (future available days with no full-day booking)
  const futureDays = await db
    .select()
    .from(availableDaysTable)
    .where(
      and(
        gte(availableDaysTable.date, todayStr),
        eq(availableDaysTable.isAvailable, true),
      ),
    )
    .orderBy(availableDaysTable.date)
    .limit(10);

  let nextAvailableDate: string | null = null;
  for (const day of futureDays) {
    const bookedFullDay = await db
      .select({ count: count() })
      .from(appointmentsTable)
      .where(
        and(
          eq(appointmentsTable.date, day.date),
          eq(appointmentsTable.status, "scheduled"),
          eq(appointmentsTable.timeSlot, "full_day"),
        ),
      );
    if ((bookedFullDay[0]?.count ?? 0) === 0) {
      nextAvailableDate = day.date;
      break;
    }
  }

  res.json(
    GetDashboardSummaryResponse.parse({
      todayAppointments: todayAppointments.map(serializeAppointment),
      weekAppointments: weekRow?.count ?? 0,
      monthAppointments: monthRow?.count ?? 0,
      pendingCount: pendingRow?.count ?? 0,
      completedCount: completedRow?.count ?? 0,
      cancelledCount: cancelledRow?.count ?? 0,
      availableDaysThisMonth: availDaysRow?.count ?? 0,
      nextAvailableDate,
    }),
  );
});

export default router;

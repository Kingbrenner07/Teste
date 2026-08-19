import { Router, type IRouter } from "express";
import { and, eq, gte, lte, like } from "drizzle-orm";
import { db, appointmentsTable, servicesTable, availableDaysTable } from "@workspace/db";
import {
  ListAppointmentsQueryParams,
  ListAppointmentsResponse,
  CreateAppointmentBody,
  CreateAppointmentResponse,
  GetAvailableSlotsQueryParams,
  GetAvailableSlotsResponse,
  UpdateAppointmentParams,
  UpdateAppointmentBody,
  UpdateAppointmentResponse,
  DeleteAppointmentParams,
  DeleteAppointmentResponse,
} from "@workspace/api-zod";
import { getAvailableSlots, pickBestSlot } from "../lib/scheduling";

const router: IRouter = Router();

/**
 * PostgreSQL timestamps arrive from Drizzle as Date objects, while the API
 * contract exposes them as ISO strings. Normalize them before response schema
 * validation so all appointment endpoints share the same representation.
 */
function serializeAppointment<T extends { createdAt: Date }>(appointment: T) {
  return {
    ...appointment,
    createdAt: appointment.createdAt.toISOString(),
  };
}

// GET /appointments/slots — must be before /appointments/:id
router.get("/appointments/slots", async (req, res): Promise<void> => {
  const parsed = GetAvailableSlotsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { date, serviceId } = parsed.data;
  const svcId = Number(serviceId);

  const [service] = await db
    .select()
    .from(servicesTable)
    .where(eq(servicesTable.id, svcId));

  if (!service) {
    res.status(404).json({ error: "Serviço não encontrado" });
    return;
  }

  // Check if the day is available
  const [availDay] = await db
    .select()
    .from(availableDaysTable)
    .where(eq(availableDaysTable.date, date));

  if (!availDay || !availDay.isAvailable) {
    res.json(
      GetAvailableSlotsResponse.parse({
        date,
        serviceId: svcId,
        slots: [],
        canSchedule: false,
        reason: "Dia não disponível para agendamentos",
      }),
    );
    return;
  }

  const existing = await db
    .select({ timeSlot: appointmentsTable.timeSlot, serviceId: appointmentsTable.serviceId })
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.date, date),
        eq(appointmentsTable.status, "scheduled"),
      ),
    );

  const availability = getAvailableSlots(
    svcId,
    service.period,
    service.maxPerDay,
    existing,
  );

  res.json(
    GetAvailableSlotsResponse.parse({
      date,
      serviceId: svcId,
      slots: availability.slots,
      canSchedule: availability.canSchedule,
      reason: availability.reason ?? null,
    }),
  );
});

// GET /appointments
router.get("/appointments", async (req, res): Promise<void> => {
  const parsed = ListAppointmentsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { date, month, year, status } = parsed.data;
  const conditions = [];

  if (date) {
    conditions.push(eq(appointmentsTable.date, date));
  }

  if (month && year) {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;
    conditions.push(gte(appointmentsTable.date, startDate));
    conditions.push(lte(appointmentsTable.date, endDate));
  } else if (year) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    conditions.push(gte(appointmentsTable.date, startDate));
    conditions.push(lte(appointmentsTable.date, endDate));
  }

  if (status) {
    conditions.push(eq(appointmentsTable.status, status));
  }

  const appointments =
    conditions.length > 0
      ? await db
          .select()
          .from(appointmentsTable)
          .where(and(...conditions))
          .orderBy(appointmentsTable.date)
      : await db
          .select()
          .from(appointmentsTable)
          .orderBy(appointmentsTable.date);

  res.json(ListAppointmentsResponse.parse(appointments.map(serializeAppointment)));
});

// POST /appointments
router.post("/appointments", async (req, res): Promise<void> => {
  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { customerName, customerPhone, serviceId, date, notes, vehicleModel, vehiclePlate } =
    parsed.data;

  const svcId = Number(serviceId);

  const [service] = await db
    .select()
    .from(servicesTable)
    .where(eq(servicesTable.id, svcId));

  if (!service) {
    res.status(400).json({ error: "Serviço não encontrado" });
    return;
  }

  // Check if day is available
  const [availDay] = await db
    .select()
    .from(availableDaysTable)
    .where(eq(availableDaysTable.date, date));

  if (!availDay || !availDay.isAvailable) {
    res.status(400).json({ error: "Dia não disponível para agendamentos" });
    return;
  }

  const existing = await db
    .select({ timeSlot: appointmentsTable.timeSlot, serviceId: appointmentsTable.serviceId })
    .from(appointmentsTable)
    .where(
      and(
        eq(appointmentsTable.date, date),
        eq(appointmentsTable.status, "scheduled"),
      ),
    );

  const availability = getAvailableSlots(
    svcId,
    service.period,
    service.maxPerDay,
    existing,
  );

  if (!availability.canSchedule) {
    res.status(400).json({ error: availability.reason ?? "Não há vagas disponíveis" });
    return;
  }

  const timeSlot = pickBestSlot(availability.slots);

  const [appointment] = await db
    .insert(appointmentsTable)
    .values({
      customerName,
      customerPhone,
      serviceId: svcId,
      serviceName: service.name,
      date,
      timeSlot,
      status: "scheduled",
      notes: notes ?? null,
      vehicleModel: vehicleModel ?? null,
      vehiclePlate: vehiclePlate ?? null,
    })
    .returning();

  res.status(201).json(CreateAppointmentResponse.parse(serializeAppointment(appointment)));
});

// PATCH /appointments/:id
router.patch("/appointments/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateAppointmentParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateAppointmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [appointment] = await db
    .update(appointmentsTable)
    .set(parsed.data)
    .where(eq(appointmentsTable.id, params.data.id))
    .returning();

  if (!appointment) {
    res.status(404).json({ error: "Agendamento não encontrado" });
    return;
  }

  res.json(UpdateAppointmentResponse.parse(serializeAppointment(appointment)));
});

// DELETE /appointments/:id
router.delete("/appointments/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteAppointmentParams.safeParse({ id: rawId });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [appointment] = await db
    .update(appointmentsTable)
    .set({ status: "cancelled" })
    .where(eq(appointmentsTable.id, params.data.id))
    .returning();

  if (!appointment) {
    res.status(404).json({ error: "Agendamento não encontrado" });
    return;
  }

  res.json(DeleteAppointmentResponse.parse(serializeAppointment(appointment)));
});

export default router;

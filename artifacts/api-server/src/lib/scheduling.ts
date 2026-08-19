// Business rules for scheduling:
// Working hours: 8-12 (morning) and 14-18 (afternoon)
// morning slot starts at 08:00, afternoon at 14:00
//
// Services and their scheduling rules:
// - Lavagem comum (4h): 2 per day — 1 morning + 1 afternoon
// - Técnica (5h): 1 per day (full day)
// - Lavagem premium (6.5h): 1 per day (full day)
// - Detalhada (8h): 1 per day (full day)
// - Restauração dos faróis (8h): 1 per day (full day)
// - Pacote interno (16h / 2 days): occupies full day, no others
// - Lavagem do motor (4h): treated like lavagem comum, 2/day
// - Aplicação de cera (1h): can be added to any slot
// - Remoção de piche (2h): morning or afternoon (fits in a period)
// - Descontaminação da pintura (3h): morning or afternoon (fits in a period)

export type TimeSlot = "morning" | "afternoon" | "full_day";

export interface SlotAvailability {
  slots: TimeSlot[];
  canSchedule: boolean;
  reason?: string;
}

// Check if a service takes the full day (blocks AM and PM)
export function isFullDayService(period: string): boolean {
  return period === "full_day";
}

// Determine which slots are free given existing appointments for a day
export function getAvailableSlots(
  serviceId: number,
  servicePeriod: string,
  serviceMaxPerDay: number,
  existingAppointments: Array<{ timeSlot: string; serviceId: number }>,
): SlotAvailability {
  const morningTaken = existingAppointments.some(
    (a) => a.timeSlot === "morning" || a.timeSlot === "full_day",
  );
  const afternoonTaken = existingAppointments.some(
    (a) => a.timeSlot === "afternoon" || a.timeSlot === "full_day",
  );
  const fullDayTaken = existingAppointments.some(
    (a) => a.timeSlot === "full_day",
  );
  const sameServiceCount = existingAppointments.filter(
    (a) => a.serviceId === serviceId,
  ).length;

  // If full_day already booked, nothing can be added
  if (fullDayTaken) {
    return {
      slots: [],
      canSchedule: false,
      reason: "Dia já está completamente ocupado",
    };
  }

  // Service max per day already reached
  if (sameServiceCount >= serviceMaxPerDay) {
    return {
      slots: [],
      canSchedule: false,
      reason: `Limite de ${serviceMaxPerDay} agendamento(s) por dia para este serviço já atingido`,
    };
  }

  if (servicePeriod === "full_day") {
    // Full day service needs both morning and afternoon free
    if (morningTaken || afternoonTaken) {
      return {
        slots: [],
        canSchedule: false,
        reason: "Serviço ocupa o dia todo e já existe agendamento neste dia",
      };
    }
    return { slots: ["full_day"], canSchedule: true };
  }

  if (servicePeriod === "both_periods") {
    const available: TimeSlot[] = [];
    if (!morningTaken) available.push("morning");
    if (!afternoonTaken) available.push("afternoon");
    if (available.length === 0) {
      return {
        slots: [],
        canSchedule: false,
        reason: "Todos os horários do dia já estão ocupados",
      };
    }
    return { slots: available, canSchedule: true };
  }

  if (servicePeriod === "morning_only") {
    if (morningTaken) {
      return {
        slots: [],
        canSchedule: false,
        reason: "Período da manhã já está ocupado",
      };
    }
    return { slots: ["morning"], canSchedule: true };
  }

  if (servicePeriod === "afternoon_only") {
    if (afternoonTaken) {
      return {
        slots: [],
        canSchedule: false,
        reason: "Período da tarde já está ocupado",
      };
    }
    return { slots: ["afternoon"], canSchedule: true };
  }

  return { slots: [], canSchedule: false, reason: "Serviço inválido" };
}

// Determine best slot for a service given existing appointments
export function pickBestSlot(slots: TimeSlot[]): TimeSlot {
  if (slots.includes("morning")) return "morning";
  if (slots.includes("full_day")) return "full_day";
  return "afternoon";
}

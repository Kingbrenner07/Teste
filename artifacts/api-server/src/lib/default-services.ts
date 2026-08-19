import { db, servicesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

const defaultServices = [
  {
    id: 1,
    name: "Lavagem Comum",
    durationMinutes: 240,
    maxPerDay: 2,
    period: "both_periods",
    description:
      "Lavagem externa completa com shampoo especial, limpeza de rodas e pneus",
    color: "#3b82f6",
  },
  {
    id: 2,
    name: "Lavagem Técnica",
    durationMinutes: 300,
    maxPerDay: 1,
    period: "full_day",
    description:
      "Lavagem técnica profissional com produtos específicos para cada superfície",
    color: "#8b5cf6",
  },
  {
    id: 3,
    name: "Lavagem Premium",
    durationMinutes: 390,
    maxPerDay: 1,
    period: "full_day",
    description: "Lavagem premium com polimento leve e proteção da pintura",
    color: "#f59e0b",
  },
  {
    id: 4,
    name: "Lavagem Detalhada",
    durationMinutes: 480,
    maxPerDay: 1,
    period: "full_day",
    description:
      "Detalhamento completo externo e interno com correção de imperfeições",
    color: "#ef4444",
  },
  {
    id: 5,
    name: "Restauração dos Faróis",
    durationMinutes: 480,
    maxPerDay: 1,
    period: "full_day",
    description:
      "Restauração profissional dos faróis (3h serviço + 5h cura)",
    color: "#06b6d4",
  },
  {
    id: 6,
    name: "Pacote Interno",
    durationMinutes: 960,
    maxPerDay: 1,
    period: "full_day",
    description: "Higienização completa do interior (2 dias de serviço)",
    color: "#10b981",
  },
  {
    id: 7,
    name: "Lavagem do Motor",
    durationMinutes: 240,
    maxPerDay: 2,
    period: "both_periods",
    description: "Lavagem e limpeza completa do compartimento do motor",
    color: "#f97316",
  },
  {
    id: 8,
    name: "Aplicação de Cera",
    durationMinutes: 60,
    maxPerDay: 2,
    period: "both_periods",
    description:
      "Aplicação de cera protetora para maior brilho e durabilidade",
    color: "#ec4899",
  },
  {
    id: 9,
    name: "Remoção de Piche",
    durationMinutes: 120,
    maxPerDay: 2,
    period: "both_periods",
    description: "Remoção de piche, resina e contaminantes da carroceria",
    color: "#6366f1",
  },
  {
    id: 10,
    name: "Descontaminação da Pintura",
    durationMinutes: 180,
    maxPerDay: 2,
    period: "both_periods",
    description:
      "Descontaminação química e mecânica da pintura com clay bar",
    color: "#14b8a6",
  },
] satisfies Array<typeof servicesTable.$inferInsert>;

export async function ensureDefaultServices(): Promise<void> {
  const inserted = await db
    .insert(servicesTable)
    .values(defaultServices)
    .onConflictDoNothing({ target: servicesTable.id })
    .returning({ id: servicesTable.id });

  await db.execute(sql`
    SELECT setval(
      pg_get_serial_sequence('services', 'id'),
      GREATEST(COALESCE((SELECT MAX(id) FROM services), 1), 1),
      true
    )
  `);

  if (inserted.length > 0) {
    logger.info(
      { insertedServices: inserted.length },
      "Default services initialized",
    );
  }
}
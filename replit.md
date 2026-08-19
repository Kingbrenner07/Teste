# EstéticaAuto Dashboard

Dashboard completo para lava-jato/estética automotiva com agenda inteligente e robô de atendimento WhatsApp.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (porta 8080)
- `pnpm --filter @workspace/estetica-auto run dev` — Frontend (porta 22671)
- `pnpm run typecheck` — typecheck completo
- `pnpm --filter @workspace/api-spec run codegen` — regenerar hooks e schemas da OpenAPI spec
- `pnpm --filter @workspace/db run push` — push das mudanças de schema (dev only)
- Required env: `DATABASE_URL` — string de conexão Postgres

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite 7, TailwindCSS 4, TanStack React Query 5, wouter
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (v3), drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- WhatsApp Bot: whatsapp-web.js (QR code via WhatsApp Web)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — source-of-truth da API
- `lib/db/src/schema/` — schemas do banco (services, appointments, available_days, conversations, messages)
- `artifacts/api-server/src/routes/` — rotas Express (services, available-days, appointments, dashboard, bot)
- `artifacts/api-server/src/lib/whatsapp-bot.ts` — singleton WhatsApp bot (whatsapp-web.js)
- `artifacts/api-server/src/lib/scheduling.ts` — lógica de regras de agendamento
- `artifacts/estetica-auto/src/` — frontend React

## Architecture decisions

- WhatsApp bot usa whatsapp-web.js (QR code = sem API paga). O dono escaneia o QR no dashboard e o robô começa a responder automaticamente.
- Agendamentos respeitam regras de período: `both_periods` = manhã OU tarde; `full_day` = dia inteiro; lavagem comum e motor = 2/dia.
- Dias disponíveis são gerenciados manualmente pelo dono via dashboard.
- Bot responde automaticamente às mensagens com menu de serviços, horários e instruções de agendamento.

## Services / Scheduling Rules

- Lavagem Comum (4h): 2/dia — manhã + tarde
- Lavagem Técnica (5h): 1/dia (dia todo)
- Lavagem Premium (6:30h): 1/dia (dia todo)
- Lavagem Detalhada (8h): 1/dia (dia todo)
- Restauração dos Faróis (8h): 1/dia (dia todo)
- Pacote Interno (16h): 1/dia (dia todo, 2 dias)
- Lavagem do Motor (4h): 2/dia — manhã + tarde
- Aplicação de Cera (1h): 2/dia — manhã + tarde
- Remoção de Piche (2h): 2/dia — manhã + tarde
- Descontaminação da Pintura (3h): 2/dia — manhã + tarde

Horário: 08:00–12:00 (manhã) e 14:00–18:00 (tarde)

## Product

Dashboard para dono de estética automotiva:
- **Dashboard**: agendamentos de hoje, stats da semana/mês, próxima data disponível
- **Agenda**: calendário mensal com agendamentos por dia, status (Agendado/Concluído/Cancelado)
- **Novo Agendamento**: formulário com validação de vagas em tempo real
- **Dias Disponíveis**: calendário mensal para o dono selecionar quais dias estão abertos
- **WhatsApp Bot**: conecta via QR code, responde clientes automaticamente com menu de serviços

## User preferences

_Populate as you build._

## Gotchas

- Puppeteer precisa estar em `onlyBuiltDependencies` no pnpm-workspace.yaml para instalar corretamente
- `zod.int()` não existe no Zod v3 — usar `type: number` no OpenAPI spec (não `type: integer`)
- Para o WhatsApp bot funcionar em produção, o servidor precisa manter o processo rodando continuamente
- Os arquivos de sessão do WhatsApp ficam em `/tmp/wwebjs_auth` — não persistem entre deploys

## Pointers

- Ver `pnpm-workspace` skill para estrutura do workspace, TypeScript setup e detalhes dos packages

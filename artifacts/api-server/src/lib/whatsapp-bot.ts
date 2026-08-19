import EventEmitter from "events";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import QRCode from "qrcode";
import { eq, and } from "drizzle-orm";
import { db, appointmentsTable, servicesTable, availableDaysTable } from "@workspace/db";
import { getAvailableSlots, pickBestSlot } from "./scheduling";
import { logger } from "./logger";

const _require = createRequire(import.meta.url);

function findChromiumPath(): string {
  // Prefer system Chromium (Nix) over puppeteer's downloaded Chrome
  // because NixOS shared libraries are only available in the Nix store
  for (const cmd of ["chromium", "chromium-browser", "google-chrome-stable", "google-chrome"]) {
    try {
      return execSync(`which ${cmd}`, { stdio: ["pipe", "pipe", "pipe"] }).toString().trim();
    } catch {
      // not found, try next
    }
  }
  return ""; // fall back to puppeteer default
}

export type BotState =
  | "disconnected"
  | "connecting"
  | "qr_ready"
  | "authenticated"
  | "ready";

interface BotStatus {
  status: BotState;
  connected: boolean;
  qrCode: string | null;
  phoneNumber: string | null;
  lastActivity: string | null;
}

// ── Conversation state machine ────────────────────────────────────────────────
type ConvState = "idle" | "awaiting_data";

interface ConvContext {
  state: ConvState;
  updatedAt: number; // timestamp — reset to idle after 30 min of inactivity
}

const CONVERSATION_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Normalize text: lowercase + strip diacritics (handles WhatsApp NFD encoding) */
function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Simple check: does normalized text include any of the given normalized keywords? */
function matchesAny(text: string, ...keywords: string[]): boolean {
  const t = norm(text);
  return keywords.some((k) => t.includes(norm(k)));
}

const SERVICE_NAMES: Record<number, string> = {
  1: "Lavagem Comum",
  2: "Lavagem Técnica",
  3: "Lavagem Premium",
  4: "Lavagem Detalhada",
  5: "Restauração de Faróis",
  6: "Pacote Interno",
  7: "Lavagem do Motor",
  8: "Aplicação de Cera",
  9: "Remoção de Piche",
  10: "Descontaminação da Pintura",
};

// ── Bot class ──────────────────────────────────────────────────────────────────
class WhatsAppBot extends EventEmitter {
  private _status: BotState = "disconnected";
  private _qrCode: string | null = null;
  private _phoneNumber: string | null = null;
  private _lastActivity: string | null = null;
  private _client: unknown = null;
  private _initialized = false;
  private _conversations = new Map<string, ConvContext>();

  private _getConvState(phone: string): ConvState {
    const ctx = this._conversations.get(phone);
    if (!ctx) return "idle";
    // Reset if stale
    if (Date.now() - ctx.updatedAt > CONVERSATION_TTL_MS) {
      this._conversations.delete(phone);
      return "idle";
    }
    return ctx.state;
  }

  private _setConvState(phone: string, state: ConvState): void {
    this._conversations.set(phone, { state, updatedAt: Date.now() });
  }

  getStatus(): BotStatus {
    return {
      status: this._status,
      connected: this._status === "ready",
      qrCode: this._qrCode,
      phoneNumber: this._phoneNumber,
      lastActivity: this._lastActivity,
    };
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;
    this._initialized = true;

    try {
      // Load whatsapp-web.js via createRequire to correctly handle CJS interop
      const { Client, LocalAuth } = _require("whatsapp-web.js") as {
        Client: new (opts: unknown) => {
          on: (event: string, cb: (...args: unknown[]) => void) => void;
          initialize: () => Promise<void>;
          sendMessage: (to: string, body: string) => Promise<void>;
          destroy: () => Promise<void>;
          info?: { wid?: { user?: string } };
        };
        LocalAuth: new (opts?: { dataPath?: string }) => unknown;
      };

      this._status = "connecting";
      this._qrCode = null;

      const chromiumPath = findChromiumPath();
      const puppeteerConfig: Record<string, unknown> = {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
        ],
      };
      if (chromiumPath) {
        puppeteerConfig.executablePath = chromiumPath;
        logger.info({ chromiumPath }, "Using system Chromium");
      }

      const client = new Client({
        // Set WHATSAPP_AUTH_DIR to a persistent disk in production. Without it,
        // a host restart would require scanning the QR code again.
        authStrategy: new LocalAuth({
          dataPath: process.env["WHATSAPP_AUTH_DIR"] ?? "/tmp/wwebjs_auth",
        }),
        puppeteer: puppeteerConfig,
      });

      client.on("qr", async (qr: string) => {
        this._status = "qr_ready";
        this._lastActivity = new Date().toISOString();
        try {
          // Convert raw QR string to base64 PNG so the frontend can render it directly
          const dataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
          // Strip the "data:image/png;base64," prefix — the frontend adds it back
          this._qrCode = dataUrl.replace("data:image/png;base64,", "");
        } catch (err) {
          logger.error({ err }, "Failed to convert QR code to PNG");
          this._qrCode = qr; // fallback to raw string
        }
        logger.info("WhatsApp QR code generated");
        this.emit("status_change", this.getStatus());
      });

      client.on("authenticated", () => {
        this._status = "authenticated";
        this._qrCode = null;
        this._lastActivity = new Date().toISOString();
        logger.info("WhatsApp authenticated");
        this.emit("status_change", this.getStatus());
      });

      client.on("ready", async () => {
        this._status = "ready";
        this._qrCode = null;
        this._lastActivity = new Date().toISOString();
        const info = client.info;
        this._phoneNumber = info?.wid?.user ?? null;
        logger.info({ phone: this._phoneNumber }, "WhatsApp bot ready");
        this.emit("status_change", this.getStatus());
      });

      client.on("disconnected", (reason: string) => {
        this._status = "disconnected";
        this._qrCode = null;
        this._phoneNumber = null;
        this._lastActivity = new Date().toISOString();
        this._initialized = false;
        logger.info({ reason }, "WhatsApp disconnected");
        this.emit("status_change", this.getStatus());
      });

      client.on("message", async (msg: { body: string; from: string; fromMe: boolean; id: { id: string } }) => {
        this._lastActivity = new Date().toISOString();
        logger.info({ from: msg.from }, "WhatsApp message received");
        this.emit("message", msg);
        await this._handleMessage(client, msg);
      });

      this._client = client;
      await client.initialize();
    } catch (err) {
      this._status = "disconnected";
      this._initialized = false;
      logger.error({ err }, "Failed to initialize WhatsApp bot");
    }
  }

  async disconnect(): Promise<void> {
    if (this._client) {
      try {
        const client = this._client as { destroy: () => Promise<void> };
        await client.destroy();
      } catch (err) {
        logger.error({ err }, "Error destroying WhatsApp client");
      }
    }
    this._client = null;
    this._status = "disconnected";
    this._qrCode = null;
    this._phoneNumber = null;
    this._initialized = false;
    this.emit("status_change", this.getStatus());
  }

  private async _handleMessage(
    client: { sendMessage: (to: string, body: string) => Promise<void> },
    msg: { body: string; from: string; fromMe: boolean },
  ): Promise<void> {
    if (msg.fromMe) return;

    const raw = msg.body.trim();
    const phone = msg.from;
    const state = this._getConvState(phone);

    let response: string | null = null;

    // ── Priority keywords always override state ───────────────────────────────
    if (matchesAny(raw, "menu")) {
      this._setConvState(phone, "idle");
      response = this._menuMessage();

    } else if (matchesAny(raw, "cancelar", "cancelamento")) {
      this._setConvState(phone, "idle");
      response =
        `❌ Para cancelar seu agendamento, entre em contato com nossa equipe informando:\n\n` +
        `• Seu nome\n` +
        `• Data do agendamento\n` +
        `• Serviço agendado\n\n` +
        `Agradecemos a compreensão! 🙏`;

    } else if (matchesAny(raw, "preco", "preço", "valor", "quanto custa", "quanto")) {
      response =
        `💰 Para informações sobre preços, entre em contato com nossa equipe.\n\n` +
        `Os valores variam conforme o tamanho e estado do veículo.\n\n` +
        `Digite *MENU* para ver nossos serviços ou *AGENDAR* para marcar um horário. 😊`;

    } else if (matchesAny(raw, "horario", "horário", "que horas", "funciona", "funcionamento")) {
      response =
        `⏰ *Horário de Funcionamento:*\n\n` +
        `Segunda a Sábado\n` +
        `🌅 Manhã: 08:00 às 12:00\n` +
        `☀️ Tarde: 14:00 às 18:00\n\n` +
        `Para agendar, responda com *AGENDAR*. 😊`;

    // ── "Agendar" → entra no estado awaiting_data ─────────────────────────────
    } else if (matchesAny(raw, "agendar", "agendamento", "agendar servico", "quero agendar", "marcar")) {
      this._setConvState(phone, "awaiting_data");
      response =
        `📅 Para realizar seu agendamento, precisamos dos seguintes dados:\n\n` +
        `1️⃣ Seu nome completo\n` +
        `2️⃣ Número do serviço (veja o MENU)\n` +
        `3️⃣ Data preferida (DD/MM/AAAA)\n` +
        `4️⃣ Modelo do veículo\n` +
        `5️⃣ Placa do veículo (opcional)\n\n` +
        `📋 *Exemplo:*\n` +
        `João Silva\n` +
        `1\n` +
        `25/08/2026\n` +
        `Gol\n` +
        `ABC1234\n\n` +
        `Envie tudo junto em uma mensagem. 😊`;

    // ── Estado awaiting_data: tenta interpretar os dados enviados ─────────────
    } else if (state === "awaiting_data") {
      response = await this._parseAppointmentData(phone, raw);

    // ── Cumprimentos (usa norm() para ignorar acentos e encoding NFD) ─────────
    } else if (
      matchesAny(raw, "oi", "ola", "olá", "bom dia", "boa tarde", "boa noite", "hello", "hi", "boa", "tudo bem", "tudo bom")
    ) {
      response = this._menuMessage();

    // ── Fallback ──────────────────────────────────────────────────────────────
    } else {
      response =
        `Olá! 👋 Como posso ajudar?\n\n` +
        `• Digite *MENU* para ver nossos serviços\n` +
        `• Digite *AGENDAR* para marcar um horário\n` +
        `• Digite *HORÁRIO* para ver nossos horários\n\n` +
        `Estamos aqui para ajudar. 😊🚗`;
    }

    if (response) {
      try {
        await client.sendMessage(phone, response);
        this._lastActivity = new Date().toISOString();
      } catch (err) {
        logger.error({ err, to: phone }, "Error sending WhatsApp message");
      }
    }
  }

  private _menuMessage(): string {
    return (
      `👋 Olá! Seja bem-vindo à nossa estética automotiva!\n\n` +
      `*Nossos serviços:*\n` +
      `1️⃣ Lavagem Comum (4h)\n` +
      `2️⃣ Lavagem Técnica (5h)\n` +
      `3️⃣ Lavagem Premium (6:30h)\n` +
      `4️⃣ Lavagem Detalhada (8h)\n` +
      `5️⃣ Restauração de Faróis (8h)\n` +
      `6️⃣ Pacote Interno (2 dias)\n` +
      `7️⃣ Lavagem do Motor (4h)\n` +
      `8️⃣ Aplicação de Cera (1h)\n` +
      `9️⃣ Remoção de Piche (2h)\n` +
      `🔟 Descontaminação da Pintura (3h)\n\n` +
      `⏰ Horário: Seg–Sáb, 8h–12h e 14h–18h\n\n` +
      `Para agendar, responda com *AGENDAR* 😊`
    );
  }

  /**
   * Parse a multi-line appointment data block sent by the customer and,
   * if valid, create the appointment directly in the database.
   *
   * Expected format (one item per line):
   *   Nome completo
   *   Número do serviço (1-10)
   *   Data (DD/MM/AAAA)
   *   Modelo do veículo
   *   Placa (opcional)
   */
  private async _parseAppointmentData(phone: string, raw: string): Promise<string> {
    const lines = raw
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    // Need at least 4 lines (name, service, date, model)
    if (lines.length < 4) {
      return (
        `⚠️ Parece que faltaram alguns dados. Por favor, envie *tudo junto* no formato:\n\n` +
        `_Nome completo_\n` +
        `_Número do serviço (1 a 10)_\n` +
        `_Data (DD/MM/AAAA)_\n` +
        `_Modelo do veículo_\n` +
        `_Placa (opcional)_\n\n` +
        `Exemplo:\n` +
        `João Silva\n1\n25/08/2026\nGol\nABC1234`
      );
    }

    const name = lines[0];

    // Find the service number (scan all lines for a number 1-10)
    let serviceNum: number | null = null;
    let serviceLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const digits = lines[i].replace(/[^\d]/g, "");
      const n = parseInt(digits, 10);
      if (!isNaN(n) && n >= 1 && n <= 10 && digits === String(n)) {
        serviceNum = n;
        serviceLineIdx = i;
        break;
      }
    }

    if (serviceNum === null) {
      return (
        `⚠️ Não identifiquei o *número do serviço*. Por favor, informe um número de 1 a 10 correspondente ao serviço do MENU.\n\n` +
        `Digite *MENU* para ver a lista de serviços.`
      );
    }

    // Find a date pattern DD/MM/YYYY anywhere in the lines
    const datePattern = /(\d{2})[\/-](\d{2})[\/-](\d{4})/;
    let dateStr: string | null = null;
    let dateLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(datePattern);
      if (m) {
        dateStr = `${m[1]}/${m[2]}/${m[3]}`;
        dateLineIdx = i;
        break;
      }
    }

    if (!dateStr) {
      return (
        `⚠️ Não identifiquei a *data*. Por favor, informe a data no formato DD/MM/AAAA.\n\n` +
        `Exemplo: 25/08/2026`
      );
    }

    // Vehicle model: first remaining line (not name, service, or date)
    const usedIdxs = new Set([0, serviceLineIdx, dateLineIdx]);
    const remainingLines = lines.filter((_, i) => !usedIdxs.has(i));
    const vehicleModel = remainingLines[0] ?? "";
    const plate = remainingLines[1] ?? "";

    if (!vehicleModel) {
      return `⚠️ Por favor, informe também o *modelo do veículo*.`;
    }

    // Validate date — convert DD/MM/YYYY → YYYY-MM-DD for DB
    const [dd, mm, yyyy] = dateStr.split("/").map(Number);
    const appointmentDate = new Date(yyyy, mm - 1, dd);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(appointmentDate.getTime()) || appointmentDate < today) {
      return `⚠️ A data *${dateStr}* parece inválida ou está no passado. Por favor, informe uma data futura no formato DD/MM/AAAA.`;
    }

    const isoDate = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;

    // ── Database checks ───────────────────────────────────────────────────────
    try {
      // 1. Look up the service
      const [service] = await db
        .select()
        .from(servicesTable)
        .where(eq(servicesTable.id, serviceNum));

      if (!service) {
        return `⚠️ Serviço *${serviceNum}* não encontrado. Digite *MENU* para ver os serviços disponíveis.`;
      }

      // 2. Check if the day is marked as available
      const [availDay] = await db
        .select()
        .from(availableDaysTable)
        .where(eq(availableDaysTable.date, isoDate));

      if (!availDay || !availDay.isAvailable) {
        return (
          `⚠️ A data *${dateStr}* não está disponível para agendamentos. ` +
          `Por favor, entre em contato para verificar as datas disponíveis, ou envie outra data. 📅`
        );
      }

      // 3. Check slot availability for that service on that day
      const existing = await db
        .select({ timeSlot: appointmentsTable.timeSlot, serviceId: appointmentsTable.serviceId })
        .from(appointmentsTable)
        .where(
          and(
            eq(appointmentsTable.date, isoDate),
            eq(appointmentsTable.status, "scheduled"),
          ),
        );

      const availability = getAvailableSlots(
        service.id,
        service.period,
        service.maxPerDay,
        existing,
      );

      if (!availability.canSchedule) {
        return (
          `⚠️ Infelizmente não há vagas disponíveis para *${service.name}* em *${dateStr}*.\n\n` +
          `${availability.reason ?? "Dia lotado."}\n\n` +
          `Por favor, informe outra data. 📅`
        );
      }

      const timeSlot = pickBestSlot(availability.slots);
      const slotLabel =
        timeSlot === "morning" ? "Manhã (08:00–12:00)"
        : timeSlot === "afternoon" ? "Tarde (14:00–18:00)"
        : "Dia todo (08:00–18:00)";

      // 4. Create the appointment
      const phoneDigits = phone.replace("@c.us", "").replace(/\D/g, "");

      const [created] = await db
        .insert(appointmentsTable)
        .values({
          customerName: name,
          customerPhone: phoneDigits,
          serviceId: service.id,
          serviceName: service.name,
          date: isoDate,
          timeSlot,
          status: "scheduled",
          vehicleModel,
          vehiclePlate: plate.toUpperCase() || null,
          notes: `Agendado via WhatsApp`,
        })
        .returning();

      logger.info({ appointmentId: created.id, phone, service: service.name, date: isoDate }, "Appointment created via WhatsApp");

      // All good — reset state
      this._setConvState(phone, "idle");

      const plateInfo = plate ? `\n🔢 Placa: *${plate.toUpperCase()}*` : "";

      return (
        `✅ *Agendamento confirmado!*\n\n` +
        `👤 Nome: *${name}*\n` +
        `🔧 Serviço: *${service.name}*\n` +
        `📅 Data: *${dateStr}*\n` +
        `⏰ Horário: *${slotLabel}*\n` +
        `🚗 Veículo: *${vehicleModel}*` +
        plateInfo +
        `\n\n` +
        `Seu agendamento já está registrado no nosso sistema! ` +
        `Qualquer dúvida, é só chamar. Até lá! 😊🚗✨`
      );
    } catch (err) {
      logger.error({ err }, "Error creating appointment via WhatsApp");
      return (
        `⚠️ Houve um erro ao registrar seu agendamento. Por favor, tente novamente ou entre em contato diretamente com a equipe.`
      );
    }
  }
}

// Singleton instance
export const whatsappBot = new WhatsAppBot();

import { Router, type IRouter } from "express";
import { and, eq, desc, gte, lte } from "drizzle-orm";
import { db, conversationsTable, messagesTable } from "@workspace/db";
import {
  GetBotStatusResponse,
  DisconnectBotResponse,
  ListConversationsResponse,
  GetConversationParams,
  GetConversationResponse,
} from "@workspace/api-zod";
import { whatsappBot } from "../lib/whatsapp-bot";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Track conversation updates from bot messages
whatsappBot.on("message", async (msg: { body: string; from: string; fromMe: boolean; id: { id: string } }) => {
  const phone = msg.from.replace("@c.us", "");
  try {
    // Upsert conversation
    const existing = await db
      .select()
      .from(conversationsTable)
      .where(eq(conversationsTable.phone, phone));

    if (existing.length > 0) {
      await db
        .update(conversationsTable)
        .set({
          lastMessage: msg.body,
          lastMessageAt: new Date(),
          unreadCount: msg.fromMe ? existing[0].unreadCount : existing[0].unreadCount + 1,
        })
        .where(eq(conversationsTable.phone, phone));
    } else {
      await db.insert(conversationsTable).values({
        phone,
        name: phone,
        lastMessage: msg.body,
        lastMessageAt: new Date(),
        unreadCount: msg.fromMe ? 0 : 1,
        hasAppointment: false,
      });
    }

    // Store message
    await db.insert(messagesTable).values({
      phone,
      body: msg.body,
      fromMe: msg.fromMe,
      timestamp: new Date(),
      externalId: msg.id?.id ?? null,
    });
  } catch (err) {
    logger.error({ err, phone }, "Error saving WhatsApp message to DB");
  }
});

// GET /bot/status
router.get("/bot/status", async (_req, res): Promise<void> => {
  const status = whatsappBot.getStatus();
  res.json(GetBotStatusResponse.parse(status));
});

// POST /bot/disconnect
router.post("/bot/disconnect", async (_req, res): Promise<void> => {
  await whatsappBot.disconnect();
  const status = whatsappBot.getStatus();
  res.json(DisconnectBotResponse.parse(status));
});

// POST /bot/connect (custom endpoint to trigger initialization)
router.post("/bot/connect", async (_req, res): Promise<void> => {
  // Fire and forget — initialization happens in background
  whatsappBot.initialize().catch((err) => {
    logger.error({ err }, "WhatsApp init error");
  });
  const status = whatsappBot.getStatus();
  res.json(GetBotStatusResponse.parse({ ...status, status: "connecting" }));
});

// GET /bot/conversations
router.get("/bot/conversations", async (_req, res): Promise<void> => {
  const conversations = await db
    .select()
    .from(conversationsTable)
    .orderBy(desc(conversationsTable.lastMessageAt))
    .limit(50);

  res.json(
    ListConversationsResponse.parse(
      conversations.map((c) => ({
        phone: c.phone,
        name: c.name,
        lastMessage: c.lastMessage,
        lastMessageAt: c.lastMessageAt.toISOString(),
        unreadCount: c.unreadCount,
        hasAppointment: c.hasAppointment,
      })),
    ),
  );
});

// GET /bot/conversations/:phone
router.get("/bot/conversations/:phone", async (req, res): Promise<void> => {
  const rawPhone = Array.isArray(req.params.phone)
    ? req.params.phone[0]
    : req.params.phone;
  const params = GetConversationParams.safeParse({ phone: rawPhone });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const msgs = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.phone, params.data.phone))
    .orderBy(messagesTable.timestamp)
    .limit(100);

  res.json(
    GetConversationResponse.parse(
      msgs.map((m) => ({
        id: String(m.id),
        phone: m.phone,
        body: m.body,
        fromMe: m.fromMe,
        timestamp: m.timestamp.toISOString(),
      })),
    ),
  );
});

export default router;

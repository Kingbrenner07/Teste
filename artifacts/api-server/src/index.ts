import app from "./app";
import { ensureDefaultServices } from "./lib/default-services";
import { logger } from "./lib/logger";
import { whatsappBot } from "./lib/whatsapp-bot";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start(): Promise<void> {
  await ensureDefaultServices();

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");

    // Do not delay the health check while Chromium starts. LocalAuth reuses
    // the persisted production session, reconnecting the bot after a restart.
    void whatsappBot.initialize().catch((botError: unknown) => {
      logger.error({ err: botError }, "Failed to start WhatsApp bot");
    });
  });
}

start().catch((err: unknown) => {
  logger.fatal({ err }, "Failed to initialize the API");
  process.exit(1);
});

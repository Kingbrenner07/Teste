import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
const githubPagesOrigin = "https://kingbrenner07.github.io";
const configuredOrigin = process.env["ALLOWED_ORIGIN"]?.trim();

if (
  process.env["NODE_ENV"] === "production" &&
  configuredOrigin !== githubPagesOrigin
) {
  throw new Error(
    `ALLOWED_ORIGIN must be ${githubPagesOrigin} in production.`,
  );
}

let allowedOrigin: string | undefined;
if (configuredOrigin) {
  try {
    allowedOrigin = new URL(configuredOrigin).origin;
  } catch {
    throw new Error(
      "ALLOWED_ORIGIN must be a valid origin, for example https://owner.github.io.",
    );
  }
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin header are server-to-server checks (for
      // example, the hosting provider's health probe), not browser clients.
      if (!origin || !allowedOrigin) {
        callback(null, true);
        return;
      }

      callback(null, origin === allowedOrigin);
    },
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;

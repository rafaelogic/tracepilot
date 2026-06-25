import cors from "cors";
import express from "express";
import { auditRoutes } from "./routes/auditRoutes.js";
import { healthRoutes } from "./routes/healthRoutes.js";
import { toHttpError } from "./utils/httpError.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));
  app.use("/api", healthRoutes);
  app.use("/api", auditRoutes);
  app.use(errorHandler);

  return app;
}

function errorHandler(error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) {
  const httpError = toHttpError(error);
  response.status(httpError.statusCode).json({ error: httpError.message });
}

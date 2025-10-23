import express from "express";
import cors from "cors";
import { createHealthRouter } from "./routes/health.router";

export function createApp() {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json());

  app.use(createHealthRouter());

  return app;
}



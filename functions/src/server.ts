import express, { Request, Response } from "express";
import cors from "cors";

export function createApp() {
  const app = express();
  app.use(cors({ origin: true }));
  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ ok: true });
  });

  return app;
}



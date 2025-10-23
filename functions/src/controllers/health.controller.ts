import { Request, Response } from "express";

export function getHealth(_req: Request, res: Response) {
  res.status(200).json({ ok: true });
}



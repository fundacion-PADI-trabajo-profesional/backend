import { describe, it, expect } from "vitest";
import request from "supertest";
import express from "express";
import cors from "cors";

// Minimal inline app mirroring src/index.ts for fast unit test without emulator
const app = express();
app.use(cors({ origin: true }));
app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

describe("health endpoint", () => {
  it("returns ok:true", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});



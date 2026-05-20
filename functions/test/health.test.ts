import { describe, it, expect, afterEach, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import { HealthRepository } from "../src/repositories/health.repository";

const app = createApp();

describe("health endpoints", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /livez", () => {
    it("returns 200 always (no DB check)", async () => {
      const res = await request(app).get("/livez");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe("GET /readyz", () => {
    it("returns 200 when DB is accessible", async () => {
      vi.spyOn(HealthRepository.prototype, "getStatus").mockResolvedValue({ ok: true });

      const res = await request(app).get("/readyz");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("returns 503 when DB is not accessible", async () => {
      vi.spyOn(HealthRepository.prototype, "getStatus").mockRejectedValue(new Error("DB unreachable"));

      const res = await request(app).get("/readyz");
      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /health (backwards compat)", () => {
    it("returns 200 when DB is accessible", async () => {
      vi.spyOn(HealthRepository.prototype, "getStatus").mockResolvedValue({ ok: true });

      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("returns 503 when DB is not accessible", async () => {
      vi.spyOn(HealthRepository.prototype, "getStatus").mockRejectedValue(new Error("DB unreachable"));

      const res = await request(app).get("/health");
      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
    });
  });
});

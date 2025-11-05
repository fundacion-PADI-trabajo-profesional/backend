import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
const app = createApp();

describe("health endpoint", () => {
  it("returns ok:true", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true });
  });
});

describe("evaluaciones endpoint", () => {
  it("returns empty list", async () => {
    const res = await request(app).get("/evaluaciones");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: "ok" });
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("returns 404 when not found", async () => {
    const res = await request(app).get("/evaluaciones/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, message: "not found" });
  });
});



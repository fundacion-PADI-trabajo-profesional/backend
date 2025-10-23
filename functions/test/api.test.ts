import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
const app = createApp();

describe("health endpoint", () => {
  it("returns ok:true", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: "ok" });
  });
});

describe("evaluaciones endpoint", () => {
  it("returns empty list", async () => {
    const res = await request(app).get("/evaluaciones");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: "ok", data: [] });
  });
});



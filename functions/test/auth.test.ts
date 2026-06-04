import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/server";
import * as supabaseClient from "../src/config/supabaseClient";

const app = createApp();

describe("auth endpoints", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("POST /auth/login returns 200 on valid credentials", async () => {
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1", email: "test@example.com" }, session: { access_token: "t" } },
          error: null,
        }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: vi.fn().mockResolvedValue({ data: { id: "user-1", rol: "docente" }, error: null }),
            is: () => ({
              order: () => ({
                limit: () => ({
                  single: vi.fn().mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      }),
    } as any);

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "test@example.com", password: "secret" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(200);
    expect(res.type).toMatch(/json/);
  });

  it("POST /auth/login returns 401 on invalid credentials", async () => {
    vi.spyOn(supabaseClient, "getSupabase").mockReturnValue({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "Invalid login" },
        }),
      },
      from: () => ({ select: () => ({ eq: () => ({ single: vi.fn() }) }) }),
    } as any);

    const res = await request(app)
      .post("/auth/login")
      .send({ email: "wrong@example.com", password: "bad" })
      .set("Content-Type", "application/json");

    expect(res.status).toBe(401);
    expect(res.type).toMatch(/json/);
  });
});



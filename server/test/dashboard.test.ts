import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { AgentRuntime } from "../src/agents/runtime";
import { loadConfig } from "../src/config/env";
import { createDb, type Db } from "../src/db/client";
import { seed } from "../src/db/seed";
import { LlmError, type LlmProvider, type LlmRequest, type LlmResponse } from "../src/llm/types";

const config = loadConfig({
  DB_PATH: ":memory:",
  JWT_SECRET: randomBytes(32).toString("hex"),
  ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  SEED_PASSWORD: "test-password",
});

class ScriptedProvider implements LlmProvider {
  readonly kind = "anthropic" as const;
  readonly model = "fake";
  constructor(private readonly replies: (string | Error)[]) {}
  async chat(_req: LlmRequest): Promise<LlmResponse> {
    const next = this.replies.shift() ?? "";
    if (next instanceof Error) throw next;
    return { text: next, toolCalls: [], stopReason: "end_turn", model: this.model, usage: { inputTokens: 1, outputTokens: 1 } };
  }
}

let db: Db;
beforeEach(async () => {
  db = createDb(":memory:");
  await seed(db, config.SEED_PASSWORD);
});

async function session(app: Awaited<ReturnType<typeof buildApp>>, email: string) {
  const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { email, password: config.SEED_PASSWORD } });
  const c = res.cookies.find((x) => x.name === "unpam_session")!;
  return `${c.name}=${c.value}`;
}

describe("dashboard", () => {
  it("butuh login", async () => {
    const app = await buildApp({ db, config });
    expect((await app.inject({ method: "GET", url: "/api/dashboard" })).statusCode).toBe(401);
  });

  it("menghitung statistik hari ini dan status agent", async () => {
    const provider = new ScriptedProvider(["UTS 9–20 November [1].", new LlmError("x"), new LlmError("x")]);
    const app = await buildApp({ db, config, llm: () => provider });
    const mhs = await session(app, "mahasiswa@unpam.test");
    await app.inject({ method: "POST", url: "/api/agents/akademik/chat", headers: { cookie: mhs }, payload: { message: "Kapan UTS?" } });
    await app.inject({ method: "POST", url: "/api/agents/akademik/chat", headers: { cookie: mhs }, payload: { message: "Siapa juara piala dunia?" } });
    await app.inject({ method: "POST", url: "/api/agents/akademik/chat", headers: { cookie: mhs }, payload: { message: "Bagaimana cara isi KRS?" } });

    const res = await app.inject({ method: "GET", url: "/api/dashboard", headers: { cookie: mhs } });
    const body = res.json();
    expect(body.stats).toMatchObject({ questionsToday: 3, answersToday: 2, errorsToday: 1, documents: 2, users: 5 });
    expect(body.answersPerHour).toHaveLength(12);
    expect(body.answersPerHour.at(-1)).toBe(2);
    expect(body.agents.find((a: { id: string }) => a.id === "akademik")).toMatchObject({ status: "error" });
    expect(body.agents.find((a: { id: string }) => a.id === "hima")).toMatchObject({ active: true, status: "idle" });
    expect(body.stats).toMatchObject({ pendingApprovals: 0, decidedToday: 0 });
  });

  it("aktivitas akun hanya terlihat oleh admin", async () => {
    const app = await buildApp({ db, config });
    const mhs = await session(app, "mahasiswa@unpam.test");
    const admin = await session(app, "admin@unpam.test");

    const forStudent = (await app.inject({ method: "GET", url: "/api/dashboard", headers: { cookie: mhs } })).json();
    expect(forStudent.recentActivity.some((a: { text: string }) => a.text.includes("masuk"))).toBe(false);

    const forAdmin = (await app.inject({ method: "GET", url: "/api/dashboard", headers: { cookie: admin } })).json();
    expect(forAdmin.recentActivity.some((a: { text: string }) => a.text === "Admin Prodi masuk")).toBe(true);
  });
});

describe("AgentRuntime", () => {
  it("status completed kembali ke idle setelah jeda", () => {
    const rt = new AgentRuntime();
    rt.set("akademik", "completed", "Selesai");
    expect(rt.list().find((a) => a.id === "akademik")?.status).toBe("completed");
    expect(rt.list(Date.now() + 60_000).find((a) => a.id === "akademik")?.status).toBe("idle");
  });
});

import { Hono } from "hono";
import type { Health } from "../shared/types";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json<Health>({ ok: true, service: "rogers" }));

export default app;

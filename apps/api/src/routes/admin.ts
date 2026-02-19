import type { FastifyInstance } from "fastify";
import { config } from "../config";
import { pool } from "../db";

export async function registerAdminRoutes(app: FastifyInstance) {
  app.post("/admin/members", async (request, reply) => {
    const tokenHeader = request.headers["x-admin-token"];
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;

    if (!config.adminToken || token !== config.adminToken) {
      reply.code(401).send({ error: "Invalid admin token" });
      return;
    }

    const body = request.body as { telegramUserId?: number; isEnabled?: boolean; note?: string };
    const telegramUserId = Number(body?.telegramUserId);

    if (!Number.isFinite(telegramUserId)) {
      reply.code(400).send({ error: "Invalid telegramUserId" });
      return;
    }

    const isEnabled = body?.isEnabled ?? true;
    const note = body?.note ?? "manual";

    const result = await pool.query(
      `
      INSERT INTO members (telegram_user_id, is_enabled, note)
      VALUES ($1, $2, $3)
      ON CONFLICT (telegram_user_id) DO UPDATE
      SET is_enabled = EXCLUDED.is_enabled,
          note = EXCLUDED.note
      RETURNING telegram_user_id, is_enabled, note
      `,
      [telegramUserId, isEnabled, note]
    );

    reply.send({ member: result.rows[0] });
  });
}

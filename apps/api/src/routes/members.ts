import type { FastifyInstance } from "fastify";
import { pool } from "../db";

export async function registerMembersRoutes(app: FastifyInstance) {
  app.post("/members/ensure", async (request, reply) => {
    const userId = request.userId as number;

    await pool.query(
      `
      INSERT INTO members (telegram_user_id, is_enabled, note)
      VALUES ($1, true, 'auto_start')
      ON CONFLICT (telegram_user_id) DO NOTHING
      `,
      [userId]
    );

    reply.send({ status: "ok" });
  });
}


import type { FastifyInstance } from "fastify";
import { COMMENT_MAX_CHARS, COMMENT_MAX_WORDS, MERGE_DISTANCE_METERS, TTL_HOURS } from "@community-map/shared";
import { pool } from "../db";

function validateComment(comment: string | undefined): string | null {
  if (!comment) return null;
  const trimmed = comment.trim();
  if (!trimmed) return null;
  if (trimmed.length > COMMENT_MAX_CHARS) {
    return "Comment too long";
  }
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > COMMENT_MAX_WORDS) {
    return "Comment has too many words";
  }
  return null;
}

export async function registerPointsRoutes(app: FastifyInstance) {
  app.get("/points", async () => {
    const result = await pool.query(
      `
      SELECT
        id,
        ST_Y(geom::geometry) AS lat,
        ST_X(geom::geometry) AS lng,
        created_at,
        last_refreshed_at,
        expires_at,
        refresh_count,
        comments_count
      FROM points
      WHERE is_hidden = false AND expires_at > now()
      ORDER BY last_refreshed_at DESC
      `
    );

    return { points: result.rows };
  });

  app.post("/points/location", async (request, reply) => {
    const body = request.body as { lat?: number; lng?: number; comment?: string };
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      reply.code(400).send({ error: "Invalid coordinates" });
      return;
    }

    const commentError = validateComment(body?.comment);
    if (commentError) {
      reply.code(400).send({ error: commentError });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const nearest = await client.query(
        `
        SELECT id
        FROM points
        WHERE is_hidden = false
          AND expires_at > now()
          AND ST_DWithin(
            geom::geography,
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            $3
          )
        ORDER BY ST_Distance(
          geom::geography,
          ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
        ) ASC
        LIMIT 1
        `,
        [lng, lat, MERGE_DISTANCE_METERS]
      );

      const userId = request.userId as number;
      let pointId: number;
      let status: "created" | "refreshed";

      if (nearest.rows.length > 0) {
        pointId = Number(nearest.rows[0].id);
        status = "refreshed";
        await client.query(
          `
          UPDATE points
          SET last_refreshed_at = now(),
              last_updated_by = $2,
              expires_at = now() + interval '${TTL_HOURS} hours',
              refresh_count = refresh_count + 1
          WHERE id = $1
          `,
          [pointId, userId]
        );
      } else {
        status = "created";
        const inserted = await client.query(
          `
          INSERT INTO points (
            geom,
            created_by,
            last_updated_by,
            created_at,
            last_refreshed_at,
            expires_at,
            refresh_count,
            comments_count,
            is_hidden
          ) VALUES (
            ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography,
            $3,
            $3,
            now(),
            now(),
            now() + interval '${TTL_HOURS} hours',
            1,
            0,
            false
          )
          RETURNING id
          `,
          [lng, lat, userId]
        );
        pointId = Number(inserted.rows[0].id);
      }

      if (body?.comment) {
        await client.query(
          `
          INSERT INTO point_comments (point_id, created_by, body, is_hidden)
          VALUES ($1, $2, $3, false)
          `,
          [pointId, userId, body.comment.trim()]
        );
        await client.query(
          `
          UPDATE points
          SET comments_count = comments_count + 1
          WHERE id = $1
          `,
          [pointId]
        );
      }

      await client.query("COMMIT");
      reply.send({ status, pointId });
    } catch (error) {
      await client.query("ROLLBACK");
      request.log.error({ error }, "Failed to upsert point");
      reply.code(500).send({ error: "Failed to update point" });
    } finally {
      client.release();
    }
  });

  app.get("/points/:id/comments", async (request, reply) => {
    const params = request.params as { id: string };
    const pointId = Number(params.id);
    if (!Number.isFinite(pointId)) {
      reply.code(400).send({ error: "Invalid point id" });
      return;
    }

    const active = await pool.query(
      `
      SELECT id FROM points
      WHERE id = $1 AND is_hidden = false AND expires_at > now()
      `,
      [pointId]
    );

    if (!active.rows[0]) {
      reply.code(404).send({ error: "Point not found" });
      return;
    }

    const comments = await pool.query(
      `
      SELECT id, created_at, body
      FROM point_comments
      WHERE point_id = $1 AND is_hidden = false
      ORDER BY created_at DESC
      `,
      [pointId]
    );

    reply.send({ comments: comments.rows });
  });

  app.post("/points/:id/comment", async (request, reply) => {
    const params = request.params as { id: string };
    const body = request.body as { comment?: string };
    const pointId = Number(params.id);

    if (!Number.isFinite(pointId)) {
      reply.code(400).send({ error: "Invalid point id" });
      return;
    }

    const commentError = validateComment(body?.comment);
    if (commentError) {
      reply.code(400).send({ error: commentError });
      return;
    }

    if (!body?.comment) {
      reply.code(400).send({ error: "Comment required" });
      return;
    }

    const active = await pool.query(
      `
      SELECT id FROM points
      WHERE id = $1 AND is_hidden = false AND expires_at > now()
      `,
      [pointId]
    );

    if (!active.rows[0]) {
      reply.code(404).send({ error: "Point not found" });
      return;
    }

    const userId = request.userId as number;
    await pool.query(
      `
      INSERT INTO point_comments (point_id, created_by, body, is_hidden)
      VALUES ($1, $2, $3, false)
      `,
      [pointId, userId, body.comment.trim()]
    );
    await pool.query(
      `
      UPDATE points
      SET comments_count = comments_count + 1
      WHERE id = $1
      `,
      [pointId]
    );

    reply.send({ status: "ok" });
  });
}

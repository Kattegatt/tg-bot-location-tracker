import type { FastifyReply, FastifyRequest } from "fastify";
import { extractTelegramUserId, isInitDataFresh, verifyInitData } from "@community-map/shared";
import { config } from "./config";

type AuthResult = {
  userId: number;
};

function parseBotUserId(headerValue: string | string[] | undefined): number | null {
  if (!headerValue) return null;
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<AuthResult | null> {
  const botTokenHeader = request.headers["x-bot-token"];
  const initDataHeader = request.headers["x-telegram-init-data"];

  let userId: number | null = null;

  if (botTokenHeader) {
    const token = Array.isArray(botTokenHeader) ? botTokenHeader[0] : botTokenHeader;
    if (!config.botApiToken || token !== config.botApiToken) {
      reply.code(401).send({ error: "Invalid bot token" });
      return null;
    }
    userId = parseBotUserId(request.headers["x-bot-user-id"]);
    if (!userId) {
      reply.code(400).send({ error: "Missing bot user id" });
      return null;
    }
  } else if (initDataHeader) {
    const initData = Array.isArray(initDataHeader) ? initDataHeader[0] : initDataHeader;
    if (!config.botToken || !verifyInitData(initData, config.botToken)) {
      reply.code(401).send({ error: "Invalid init data" });
      return null;
    }
    if (!isInitDataFresh(initData, config.initDataMaxAgeSeconds)) {
      reply.code(401).send({ error: "Init data expired" });
      return null;
    }
    userId = extractTelegramUserId(initData);
  }

  if (!userId) {
    reply.code(401).send({ error: "Unauthorized" });
    return null;
  }

  return { userId };
}

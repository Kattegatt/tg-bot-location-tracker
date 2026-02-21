import "dotenv/config";
import { Telegraf, Markup } from "telegraf";
import { COMMENT_MAX_CHARS, COMMENT_MAX_WORDS } from "@community-map/shared";

const botToken = process.env.BOT_TOKEN;
const apiUrl = process.env.API_URL || "http://localhost:3001";
const botApiToken = process.env.BOT_API_TOKEN || "";
const webappUrl = process.env.WEBAPP_URL || "";
const webappCacheBust = process.env.WEBAPP_CACHE_BUST || String(Date.now());

if (!botToken) {
  console.warn("BOT_TOKEN is not set. Bot is idle.");
  setInterval(() => {}, 60_000);
} else {
  const bot = new Telegraf(botToken);

  const lastLocationAt = new Map<number, number>();
  const lastCommentAt = new Map<number, number>();
  const pendingComments = new Map<
    number,
    { pointId: number; expiresAt: number }
  >();

  function rateLimit(
    map: Map<number, number>,
    userId: number,
    minMs: number,
  ): boolean {
    const now = Date.now();
    const last = map.get(userId) || 0;
    if (now - last < minMs) return false;
    map.set(userId, now);
    return true;
  }

  async function apiRequest(path: string, userId: number, body: unknown) {
    const response = await fetch(`${apiUrl}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-bot-token": botApiToken,
        "x-bot-user-id": String(userId),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, data };
  }

  function buildWebAppLaunchUrl(): string {
    if (!webappUrl) return "";

    try {
      const url = new URL(webappUrl);
      url.searchParams.set("v", webappCacheBust);
      return url.toString();
    } catch {
      const separator = webappUrl.includes("?") ? "&" : "?";
      return `${webappUrl}${separator}v=${encodeURIComponent(webappCacheBust)}`;
    }
  }

  bot.start(async (ctx) => {
    const userId = ctx.from?.id;
    if (userId) {
      await apiRequest("/members/ensure", userId, {});
    }

    ctx.reply(
      "Send a location to add or refresh a point on the community map.",
    );
  });

  bot.command("map", (ctx) => {
    const launchUrl = buildWebAppLaunchUrl();

    if (launchUrl) {
      ctx.reply(
        "Open the community map:",
        Markup.inlineKeyboard([Markup.button.webApp("Open map", launchUrl)]),
      );
    } else {
      ctx.reply("WebApp URL is not configured.");
    }
  });

  bot.on("location", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    if (!rateLimit(lastLocationAt, userId, 20_000)) {
      ctx.reply("Please wait a bit before sending another location.");
      return;
    }

    const { latitude, longitude } = ctx.message.location;
    const result = await apiRequest("/points/location", userId, {
      lat: latitude,
      lng: longitude,
    });

    if (!result.ok) {
      ctx.reply(result.data?.error || "Failed to update location.");
      return;
    }

    const pointId = result.data.pointId as number;
    const expiresAt = Date.now() + 2 * 60 * 1000;
    pendingComments.set(userId, { pointId, expiresAt });

    ctx.reply(
      "Location saved. Send a short comment within 2 minutes (optional).",
      {
        reply_markup: {
          keyboard: [[{ text: "Skip comment" }]],
          one_time_keyboard: true,
          resize_keyboard: true,
        },
      },
    );

    setTimeout(
      () => {
        const pending = pendingComments.get(userId);
        if (pending && pending.pointId === pointId) {
          pendingComments.delete(userId);
        }
      },
      2 * 60 * 1000 + 1000,
    );
  });

  bot.on("text", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const text = ctx.message.text.trim();
    if (text === "Skip comment") {
      pendingComments.delete(userId);
      ctx.reply("Comment skipped.");
      return;
    }

    const pending = pendingComments.get(userId);
    if (!pending || Date.now() > pending.expiresAt) {
      return;
    }

    if (!rateLimit(lastCommentAt, userId, 10_000)) {
      ctx.reply("Please wait a bit before sending another comment.");
      return;
    }

    if (text.length > COMMENT_MAX_CHARS) {
      ctx.reply(`Comment too long (max ${COMMENT_MAX_CHARS} chars).`);
      return;
    }
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length > COMMENT_MAX_WORDS) {
      ctx.reply(`Comment has too many words (max ${COMMENT_MAX_WORDS}).`);
      return;
    }

    const result = await apiRequest(
      `/points/${pending.pointId}/comment`,
      userId,
      {
        comment: text,
      },
    );

    if (!result.ok) {
      ctx.reply(result.data?.error || "Failed to save comment.");
      return;
    }

    pendingComments.delete(userId);
    ctx.reply("Comment saved.", { reply_markup: { remove_keyboard: true } });
  });

  bot.launch();

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

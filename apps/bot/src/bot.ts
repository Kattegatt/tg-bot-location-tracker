import "dotenv/config";
import { Telegraf, Markup } from "telegraf";
import { COMMENT_MAX_CHARS, COMMENT_MAX_WORDS } from "@community-map/shared";

type Locale = "uk" | "en";

type BotTexts = {
  startIntro: string;
  startHelpHint: string;
  openMap: string;
  openMapButton: string;
  webappNotConfigured: string;
  waitBeforeLocation: string;
  failedToUpdateLocation: string;
  locationSaved: string;
  skipComment: string;
  commentSkipped: string;
  waitBeforeComment: string;
  commentTooLong: (maxChars: number) => string;
  commentTooManyWords: (maxWords: number) => string;
  failedToSaveComment: string;
  commentSaved: string;
  helpHowItWorks: string;
  helpStep1: string;
  helpStep2: string;
  helpStep3: (maxChars: number, maxWords: number) => string;
  helpStep4: string;
  helpDonationTitle: string;
  helpDonationJoke: string;
  helpDonationPrompt: string;
  helpMonobankLabel: string;
  helpCryptoLabel: string;
  donationNotConfigured: string;
  commandStartDescription: string;
  commandMapDescription: string;
  commandHelpDescription: string;
};

const botToken = process.env.BOT_TOKEN;
const apiUrl = process.env.API_URL || "http://localhost:3001";
const botApiToken = process.env.BOT_API_TOKEN || "";
const webappUrl = process.env.WEBAPP_URL || "";
const webappCacheBust = process.env.WEBAPP_CACHE_BUST || String(Date.now());
const donateMonoCard = process.env.DONATE_MONO_CARD || "";
const donateCryptoWallet = process.env.DONATE_CRYPTO_WALLET || "";

const TEXTS: Record<Locale, BotTexts> = {
  uk: {
    startIntro:
      "Надішли локацію, щоб додати або оновити точку на мапі спільноти.",
    startHelpHint:
      "Команда /help покаже інструкцію та реквізити для підтримки сервісу.",
    openMap: "Відкрити мапу спільноти:",
    openMapButton: "Відкрити мапу",
    webappNotConfigured: "WEBAPP_URL не налаштовано.",
    waitBeforeLocation: "Зачекай трохи перед відправкою наступної локації.",
    failedToUpdateLocation: "Не вдалося оновити локацію.",
    locationSaved:
      "Локацію збережено. Надішли короткий коментар протягом 2 хвилин (опційно).",
    skipComment: "Пропустити коментар",
    commentSkipped: "Коментар пропущено.",
    waitBeforeComment: "Зачекай трохи перед відправкою наступного коментаря.",
    commentTooLong: (maxChars) =>
      `Коментар занадто довгий (максимум ${maxChars} символів).`,
    commentTooManyWords: (maxWords) =>
      `У коментарі забагато слів (максимум ${maxWords}).`,
    failedToSaveComment: "Не вдалося зберегти коментар.",
    commentSaved: "Коментар збережено.",
    helpHowItWorks: "Як працює бот:",
    helpStep1: "Надішли свою геолокацію.",
    helpStep2: "Бот створить або оновить найближчу точку на мапі.",
    helpStep3: (maxChars, maxWords) =>
      `Після локації є 2 хвилини, щоб додати коментар (до ${maxChars} символів, до ${maxWords} слів).`,
    helpStep4: "Кнопка OPEN такКоманда /map відкриває інтерактивну мапу.",
    helpDonationTitle: "Підтримка сервісу:",
    helpDonationJoke:
      "Сервер не працює на ентузіазмі, а ентузіазм не оплачує хостинг.",
    helpDonationPrompt: "Якщо сервіс корисний, можна закинути на підтримку:",
    helpMonobankLabel: "Monobank",
    helpCryptoLabel: "USDT TRC20",
    donationNotConfigured: "не вказано",
    commandStartDescription: "Коротко про бота",
    commandMapDescription: "Відкрити мапу",
    commandHelpDescription: "Довідка і підтримка",
  },
  en: {
    startIntro:
      "Send a location to add or refresh a point on the community map.",
    startHelpHint: "Use /help for instructions and support details.",
    openMap: "Open the community map:",
    openMapButton: "Open map",
    webappNotConfigured: "WEBAPP_URL is not configured.",
    waitBeforeLocation: "Please wait a bit before sending another location.",
    failedToUpdateLocation: "Failed to update location.",
    locationSaved:
      "Location saved. Send a short comment within 2 minutes (optional).",
    skipComment: "Skip comment",
    commentSkipped: "Comment skipped.",
    waitBeforeComment: "Please wait a bit before sending another comment.",
    commentTooLong: (maxChars) => `Comment too long (max ${maxChars} chars).`,
    commentTooManyWords: (maxWords) =>
      `Comment has too many words (max ${maxWords}).`,
    failedToSaveComment: "Failed to save comment.",
    commentSaved: "Comment saved.",
    helpHowItWorks: "How it works:",
    helpStep1: "Send your geolocation.",
    helpStep2: "The bot creates or refreshes the nearest map point.",
    helpStep3: (maxChars, maxWords) =>
      `After sending location, you have 2 minutes to add a comment (up to ${maxChars} chars, up to ${maxWords} words).`,
    helpStep4: "Use OPEN button or /map to open the interactive map.",
    helpDonationTitle: "Support the service:",
    helpDonationJoke:
      "The server does not run on vibes, and vibes do not pay hosting.",
    helpDonationPrompt: "If this bot is useful, you can support it here:",
    helpMonobankLabel: "Monobank",
    helpCryptoLabel: "USDT TRC20",
    donationNotConfigured: "not provided",
    commandStartDescription: "Quick intro",
    commandMapDescription: "Open map",
    commandHelpDescription: "Help and support",
  },
};

function resolveLocale(languageCode: string | undefined): Locale {
  if (!languageCode) return "en";
  const normalized = languageCode.toLowerCase();
  if (normalized.startsWith("uk") || normalized.startsWith("ua")) return "uk";
  return "en";
}

function textForLanguage(languageCode: string | undefined): BotTexts {
  return TEXTS[resolveLocale(languageCode)];
}

function buildHelpMessage(languageCode: string | undefined): string {
  const t = textForLanguage(languageCode);
  const monobank = donateMonoCard || t.donationNotConfigured;
  const cryptoWallet = donateCryptoWallet || t.donationNotConfigured;

  return [
    t.helpHowItWorks,
    `1. ${t.helpStep1}`,
    `2. ${t.helpStep2}`,
    `3. ${t.helpStep3(COMMENT_MAX_CHARS, COMMENT_MAX_WORDS)}`,
    `4. ${t.helpStep4}`,
    "",
    t.helpDonationTitle,
    t.helpDonationJoke,
    t.helpDonationPrompt,
    `- ${t.helpMonobankLabel}: ${monobank}`,
    `- ${t.helpCryptoLabel}: ${cryptoWallet}`,
  ].join("\n");
}

if (!botToken) {
  console.warn("BOT_TOKEN is not set. Bot is idle.");
  setInterval(() => {}, 60_000);
} else {
  const bot = new Telegraf(botToken);

  const lastLocationAt = new Map<number, number>();
  const lastCommentAt = new Map<number, number>();
  const skipCommentLabels = new Set<string>([
    TEXTS.uk.skipComment,
    TEXTS.en.skipComment,
  ]);
  const pendingComments = new Map<
    number,
    { pointId: number; expiresAt: number }
  >();

  function commandSet(locale: Locale) {
    const t = TEXTS[locale];
    return [
      { command: "start", description: t.commandStartDescription },
      { command: "map", description: t.commandMapDescription },
      { command: "help", description: t.commandHelpDescription },
    ];
  }

  void Promise.all([
    bot.telegram.setMyCommands(commandSet("en")),
    bot.telegram.setMyCommands(commandSet("en"), { language_code: "en" }),
    bot.telegram.setMyCommands(commandSet("uk"), { language_code: "uk" }),
  ]).catch((error) => {
    console.warn("Failed to set bot commands", error);
  });

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

    const t = textForLanguage(ctx.from?.language_code);
    ctx.reply(`${t.startIntro}\n${t.startHelpHint}`);
  });

  bot.command("help", (ctx) => {
    ctx.reply(buildHelpMessage(ctx.from?.language_code));
  });

  bot.command("map", (ctx) => {
    const t = textForLanguage(ctx.from?.language_code);
    const launchUrl = buildWebAppLaunchUrl();

    if (launchUrl) {
      ctx.reply(
        t.openMap,
        Markup.inlineKeyboard([
          Markup.button.webApp(t.openMapButton, launchUrl),
        ]),
      );
    } else {
      ctx.reply(t.webappNotConfigured);
    }
  });

  bot.on("location", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    const t = textForLanguage(ctx.from?.language_code);

    if (!rateLimit(lastLocationAt, userId, 20_000)) {
      ctx.reply(t.waitBeforeLocation);
      return;
    }

    const { latitude, longitude } = ctx.message.location;
    const result = await apiRequest("/points/location", userId, {
      lat: latitude,
      lng: longitude,
    });

    if (!result.ok) {
      ctx.reply(result.data?.error || t.failedToUpdateLocation);
      return;
    }

    const pointId = result.data.pointId as number;
    const expiresAt = Date.now() + 2 * 60 * 1000;
    pendingComments.set(userId, { pointId, expiresAt });

    ctx.reply(t.locationSaved, {
      reply_markup: {
        keyboard: [[{ text: t.skipComment }]],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    });

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
    const t = textForLanguage(ctx.from?.language_code);

    const text = ctx.message.text.trim();
    if (skipCommentLabels.has(text)) {
      pendingComments.delete(userId);
      ctx.reply(t.commentSkipped, { reply_markup: { remove_keyboard: true } });
      return;
    }

    const pending = pendingComments.get(userId);
    if (!pending || Date.now() > pending.expiresAt) {
      return;
    }

    if (!rateLimit(lastCommentAt, userId, 10_000)) {
      ctx.reply(t.waitBeforeComment);
      return;
    }

    if (text.length > COMMENT_MAX_CHARS) {
      ctx.reply(t.commentTooLong(COMMENT_MAX_CHARS));
      return;
    }
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length > COMMENT_MAX_WORDS) {
      ctx.reply(t.commentTooManyWords(COMMENT_MAX_WORDS));
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
      ctx.reply(result.data?.error || t.failedToSaveComment);
      return;
    }

    pendingComments.delete(userId);
    ctx.reply(t.commentSaved, { reply_markup: { remove_keyboard: true } });
  });

  bot.launch();

  process.once("SIGINT", () => bot.stop("SIGINT"));
  process.once("SIGTERM", () => bot.stop("SIGTERM"));
}

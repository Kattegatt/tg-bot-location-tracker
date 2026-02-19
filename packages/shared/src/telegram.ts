import crypto from "node:crypto";

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export type InitData = {
  queryId?: string;
  user?: TelegramUser;
  authDate?: number;
  hash: string;
  raw: string;
};

export function parseInitData(initData: string): InitData {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") || "";
  const userRaw = params.get("user");
  const user = userRaw ? (JSON.parse(userRaw) as TelegramUser) : undefined;
  const authDateRaw = params.get("auth_date");
  const authDate = authDateRaw ? Number(authDateRaw) : undefined;
  const queryId = params.get("query_id") || undefined;

  return { queryId, user, authDate, hash, raw: initData };
}

export function buildDataCheckString(initData: string): string {
  const params = new URLSearchParams(initData);
  const entries: string[] = [];

  for (const [key, value] of params.entries()) {
    if (key === "hash") continue;
    entries.push(`${key}=${value}`);
  }

  entries.sort();
  return entries.join("\n");
}

export function verifyInitData(initData: string, botToken: string): boolean {
  const parsed = parseInitData(initData);
  if (!parsed.hash) return false;

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const dataCheckString = buildDataCheckString(initData);
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash.length !== parsed.hash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(parsed.hash));
}

export function isInitDataFresh(initData: string, maxAgeSeconds: number): boolean {
  const parsed = parseInitData(initData);
  if (!parsed.authDate) return false;
  const now = Math.floor(Date.now() / 1000);
  return now - parsed.authDate <= maxAgeSeconds;
}

export function extractTelegramUserId(initData: string): number | null {
  const parsed = parseInitData(initData);
  return parsed.user?.id ?? null;
}

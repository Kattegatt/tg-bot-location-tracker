export const config = {
  port: Number(process.env.PORT || 3001),
  databaseUrl: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/community_map",
  botToken: process.env.BOT_TOKEN || "",
  botApiToken: process.env.BOT_API_TOKEN || "",
  adminToken: process.env.ADMIN_TOKEN || "",
  initDataMaxAgeSeconds: Number(process.env.INITDATA_MAX_AGE_SECONDS || 86400),
  corsOrigin: process.env.CORS_ORIGIN || "*"
};

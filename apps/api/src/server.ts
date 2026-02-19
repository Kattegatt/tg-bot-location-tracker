import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { config } from "./config";
import { authenticate } from "./auth";
import { registerHealthRoutes } from "./routes/health";
import { registerMembersRoutes } from "./routes/members";
import { registerPointsRoutes } from "./routes/points";
import { registerAdminRoutes } from "./routes/admin";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: config.corsOrigin,
  credentials: true
});

app.addHook("preHandler", async (request, reply) => {
  if (request.url.startsWith("/health") || request.url.startsWith("/admin")) return;
  const result = await authenticate(request, reply);
  if (!result) return reply;
  request.userId = result.userId;
});

await registerHealthRoutes(app);
await registerMembersRoutes(app);
await registerPointsRoutes(app);
await registerAdminRoutes(app);

app.listen({ port: config.port, host: "0.0.0.0" }).catch((error) => {
  app.log.error(error, "Failed to start server");
  process.exit(1);
});

# Community Map Production Deployment

## 1. VPS Requirements
- Ubuntu 24.04
- Docker Engine
- Docker Compose plugin (`docker compose`)
- Git
- Node.js + npm (required for `build-webapp.sh`)

## 2. DNS
Point both records to your VPS public IP:
- `app.communitymap.website`
- `api.communitymap.website`

## 3. Server Setup
```bash
sudo mkdir -p /srv/communitymap
sudo chown -R "$USER":"$USER" /srv/communitymap
cd /srv/communitymap
git clone https://github.com/Kattegatt/tg-bot-location-tracker.git .
```

## 4. Environment File
Create `.env.prod` from template:
```bash
cp .env.example.prod .env.prod
```

Set real values in `.env.prod`:
- `POSTGRES_PASSWORD`
- `BOT_TOKEN`
- `BOT_API_TOKEN`
- `ADMIN_TOKEN`
- `INITDATA_MAX_AGE_SECONDS`
- optionally override `APP_DOMAIN`, `API_DOMAIN`

Never commit `.env.prod`.

## 5. Initial Start
```bash
./build-webapp.sh
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

Optional migration:
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T api npm run db:migrate
```

## 6. Update Deployment
```bash
./deploy.sh
```

By default `deploy.sh` deploys `master`. You can override:
```bash
DEPLOY_BRANCH=main ./deploy.sh
```

## 7. Useful Commands
```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml ps
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f caddy
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f api
docker compose --env-file .env.prod -f docker-compose.prod.yml logs -f bot
docker compose --env-file .env.prod -f docker-compose.prod.yml down
```

## 8. TLS / Caddy
- Caddy serves:
  - `api.communitymap.website` -> `api:3001`
  - `app.communitymap.website` -> static files from `webapp-dist`
- HTTPS certificates are managed automatically by Caddy (Let's Encrypt).


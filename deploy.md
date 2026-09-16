# Deployment Guide

## Docker Compose

1. Copy the environment template:

```bash
cp .env.example .env
```

2. Edit `.env` or `docker-compose.yml` and set strong secrets:

```text
ADMIN_PASSWORD=change-me
JWT_SECRET=long-random-secret
TK_SECRET=another-long-random-secret
ALLOWED_ORIGINS=https://your-domain.example
```

You can also use a JSON config file. Environment variables override config file values:

```bash
cp config.example.json config.json
```

```json
{
  "adminUsername": "admin",
  "adminPassword": "change-me",
  "jwtSecret": "long-random-secret",
  "tkSecret": "another-long-random-secret"
}
```

For Docker, mount or bake the config file into the container and set:

```text
CONFIG_FILE=/app/config.json
```

3. Start the service with Docker Compose:

```bash
docker compose up -d --build
```

Or start it through npm:

```bash
npm run docker:up -- --port 3001 --admin-password "change-me"
```

4. Open:

```text
http://localhost:3000
```

If you used `--port 3001`, open:

```text
http://localhost:3001
```

## Volumes

The compose file mounts:

- `./storage:/app/storage`
- `./data:/app/data`

Back up both directories.

## Reverse Proxy

Use nginx, Caddy, or another reverse proxy for TLS. Forward to:

```text
http://127.0.0.1:3000
```

Set `ALLOWED_ORIGINS` to your public HTTPS origin.

## Dynamic Links

Dynamic links are generated with a token and expire after `DYNAMIC_TOKEN_TTL_SECONDS`, default 600 seconds.

## Video Thumbnails

The Docker image installs `ffmpeg`. Local non-Docker deployments need `ffmpeg` in `PATH` for video thumbnails.

## Admin Git

Admin Git is disabled by default. Enable only if the deployment environment has the right Git remote and credentials:

```text
ENABLE_ADMIN_GIT=true
```

Git commands are restricted to the `storage/` directory.

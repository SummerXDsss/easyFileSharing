# Easy File Sharing

Easy File Sharing is a list-style file sharing and mirror download site built with Node.js, Express, and SQLite.

## Features

- File download page with directory browsing.
- Picture sharing center that only lists image files.
- User registration and login. Registration requires an invite code.
- Default generated user avatars.
- Admin panel hidden from the public navigation. Visit `/admin` directly.
- Admin JWT access token plus long-lived `tk` refresh cookie.
- SQLite storage for users, invites, file metadata, protected paths, dynamic tokens, and logs.
- Per-file password protection.
- Per-file login-required download restriction.
- Static direct links by default: `/files/path/to/file`.
- Dynamic links with id and 10-minute token: `/dl/:id?token=...`.
- Origin/Referer allowlist support.
- Range requests and streamed downloads for high concurrency and resume support.
- File notes and uploader display.
- Image thumbnails and image/video preview. Video thumbnails require `ffmpeg`.
- Admin file rename, upload, metadata editing, invite creation, and optional Git operations on `storage/`.
- Docker and docker-compose deployment.

## Quick Start

```powershell
npm install
copy .env.example .env
npm start
```

Open:

- Site: http://localhost:3000/
- Admin: http://localhost:3000/admin

Default admin credentials:

- Username: `admin`
- Password: `admin123456`

Change these before deployment.

## Important Environment Variables

```text
PORT=3000
SITE_TITLE=Easy File Sharing
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123456
JWT_SECRET=change-this-jwt-secret
TK_SECRET=change-this-refresh-secret
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=30
DYNAMIC_TOKEN_TTL_SECONDS=600
ALLOWED_ORIGINS=https://example.com,http://localhost:3000
REQUIRE_ALLOWED_ORIGIN=false
ENABLE_ADMIN_GIT=false
```

## Storage

Put shared files in `storage/`. SQLite and thumbnails live in `data/`.

The admin panel can upload files, rename files/folders, edit notes, switch link modes, and require login for individual downloads.

## Invite Codes

The first database initialization creates a default invite code:

```text
WELCOME
```

Create additional invite codes in the admin panel.

## Git Admin Mode

Set `ENABLE_ADMIN_GIT=true` to expose safe Git actions for the `storage/` directory:

- `git init`
- `git pull --ff-only`
- `git add . && git commit -m "..."`
- `git push`
- recent `git log`

The admin panel cannot run arbitrary shell commands.

## Verification

```powershell
npm test
```

With the server running locally:

```powershell
npm run test:e2e
```

## Repository

Target GitHub repository:

```text
https://github.com/SummerXDsss/easyFileSharing
```

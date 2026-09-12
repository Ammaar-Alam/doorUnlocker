# API

Routes are relative to your server (`http://localhost:3000` when running locally). The same routes are available under `/api` for existing clients. Responses use JSON and are not cached.

## Authentication

During protected hours, supply the password in the JSON request body, or use `POST /login` with a `password` string to obtain a token. A browser receives an HTTP-only cookie; other clients can send the returned token in `Authorization: Bearer …`. Login always checks the password, including during public hours. Tokens expire after 24 hours by default.

`AUTH_REQUIRED=scheduled` protects midnight through 7:59:59 a.m. in `America/New_York`. `true` always requires authentication; `false` allows public control. The schedule is evaluated in the server on every request and survives restarts without a scheduled job.

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/auth-status` | Returns `authRequired` and `authenticated` |
| POST | `/login` | Checks `password`, sets a cookie, and returns `token` |
| GET | `/status` | Returns `doorOpen`, `online`, and `updatedAt` |
| GET | `/events` | Streams the same status using server-sent events |
| POST | `/open` | Opens the handle without a timer |
| POST | `/close` | Releases the handle |
| POST | `/force-open` | Runs another opening stroke while idle |
| POST | `/force-close` | Runs another closing stroke while idle |
| POST | `/command` | Accepts `command` with one of the four action names above |
| POST | `/emergency-close` | Alias for normal Close |
| POST | `/ring-doorbell` | Sends optional `message` text when notification delivery is configured |

Successful commands return `{"ok":true,"command":"open","message":"Command sent"}`. This confirms Arduino Cloud accepted the request; it is not a physical-position acknowledgement. Read `/status` or `/events` for the controller's reported state. When offline, `doorOpen` is `null`, not a stale open or closed value.

The Arduino ignores expired commands and commands retained from a previous connection. Each Open or Close received while idle runs a full stroke, even when the controller already reports that position. A Close received during the opening stroke completes that calibrated stroke before reversing; a Close after opening starts releasing immediately. Force commands are ignored while a stroke is already running.

Clients own any wait between Open and Close. The `/pulse` endpoint is no longer supported; replace it with separate Open and Close requests. If Close never arrives, the handle remains held.

## Errors

Errors return `{"ok":false,"message":"…"}` with a suitable HTTP status:

- `400`: invalid command, body, or JSON
- `401`: login required or invalid password
- `409`: another request is currently publishing a command
- `503`: controller offline or configuration missing
- `502`: Arduino or notification service failure, including a timeout

Do not automatically retry a command after a timeout: it may already have reached the controller. Check the live state before issuing another action.

The server retries explicit Arduino HTTP 429 responses up to twice within the request timeout, honoring `Retry-After` when provided. Retries keep the same command ID and expiry. Timeouts and other ambiguous failures are not retried. Logs identify failed commands and rate-limited endpoints, including this server's request count in the preceding second.

## Temporary authentication override

`POST /admin/set-auth-required` requires `X-Admin-Token` matching `ADMIN_TOKEN`. Send `enabled: true` to protect access, `false` to allow public control, or `null` to restore the configured schedule. This override lasts until it is cleared or the server restarts. Use `AUTH_REQUIRED=true` in the service configuration for an override that must survive restarts.

# Troubleshooting - Slack KPI Service

## Nightly job not posting to Slack (Heroku Scheduler / external job)

**Setup**: You use a **separate** job (e.g. Heroku Scheduler) to call the Slack KPI service; there is no in-app scheduler.

**Two things must be correct:**

### 1. The job must authenticate

The service requires either **JWT** or **scheduler secret** for `POST /report/night`:

- **Option A – JWT (recommended if you can store a token):**  
  In Heroku Scheduler, run a curl that includes a valid JWT:
  ```bash
  curl -X POST https://YOUR_APP.herokuapp.com/report/night -H "Authorization: Bearer YOUR_JWT_TOKEN" -H "Content-Type: application/json"
  ```
  Generate the token with the same `JWT_SECRET` as on Heroku (e.g. `node utils/generateJwtToken.js` locally with the same secret).

- **Option B – Scheduler secret (no JWT):**  
  1. Set a shared secret on the app:
     ```bash
     heroku config:set SCHEDULER_SECRET=your-long-random-secret --app slack-kpi-service
     ```
  2. In Heroku Scheduler, call the report with that value as the Bearer token:
     ```bash
     curl -X POST https://YOUR_APP.herokuapp.com/report/night -H "Authorization: Bearer your-long-random-secret" -H "Content-Type: application/json"
     ```
  If `SCHEDULER_SECRET` is set, the service accepts it for any `/report/*` path instead of JWT.

If the job does not send a valid JWT or `SCHEDULER_SECRET`, the API returns **401 Missing token** and the report never runs.

### 2. Slack must accept the message

If the job succeeds (202) but nothing appears in Slack, check logs for:

- **`not_allowed_token_type`** → Use a **Bot User OAuth Token** (`xoxb-`). See section below.
- **`Invalid channel ID or bot not in channel`** → Fix channel ID and invite the bot. See section below.

After fixing the token/channel, the next night run should post to Slack.

---

## Night report timeout (H12) on Heroku

**Symptom**: Heroku logs show `at=error code=H12 desc="Request timeout" method=POST path="/report/night"` and the request returns 503 after 30 seconds.

**Cause**: Heroku’s router closes requests after 30 seconds. The night report (Aircall fetch + formatting + Slack send) can take longer than that.

**Fix**: The night report endpoint now returns **202 Accepted** immediately and runs the report in the background. The caller (Heroku Scheduler, cron, or manual POST) gets a quick response; the report continues and is sent to Slack when done. No config change needed after deploying this behavior.

---

## Slack API error: `not_allowed_token_type`

**Symptom**: Logs show `Slack API error: not_allowed_token_type` or `Slack request failed: not_allowed_token_type`.

**Cause**: The token in `SLACK_API_TOKEN` is the wrong type. For `chat.postMessage` and most Web API methods, Slack requires a **Bot User OAuth Token**, not an app-level token.

**Fix**:

1. In [Slack API](https://api.slack.com/apps), open your app → **OAuth & Permissions**.
2. Under **OAuth Tokens for Your Workspace**, copy the **Bot User OAuth Token** (it starts with `xoxb-`).
3. Do **not** use:
   - App-level token (starts with `xapp-`) — only for Socket Mode.
   - User token (starts with `xoxp-`) — not valid for `chat.postMessage` in this context.
4. Set the token on Heroku:
   ```bash
   heroku config:set SLACK_API_TOKEN=xoxb-your-bot-token-here --app slack-kpi-service
   ```
5. Ensure the bot is in the channel: invite it with `/invite @YourBotName` in the channel identified by `SLACK_CHANNEL_ID`.

---

## Invalid channel ID or bot not in channel

**Symptom**: Logs show `Invalid channel ID or bot not in channel` (from connection validation) or Slack errors about the channel.

**Fix**:

1. Confirm `SLACK_CHANNEL_ID` is the correct channel ID (e.g. `C01234ABCDE`), not the channel name.
2. Invite the bot into that channel: in Slack, `/invite @YourBotName` in the channel.
3. In the Slack app, **OAuth & Permissions** → **Scopes** → Bot Token Scopes should include `chat:write` and `channels:read` (or `groups:read` for private channels).

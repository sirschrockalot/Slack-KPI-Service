# Troubleshooting - Slack KPI Service

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

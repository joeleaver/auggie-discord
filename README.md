# Auggie Discord Bot (DM-only, Interactive, Prompt Enhancer)

This bot runs Auggie in a PTY per DM, supports Prompt Enhancer (Ctrl+P), and streams output to Discord.

## Install Auggie CLI
Requirements:
- Node.js 22+ installed (check with `node -v`)

Install globally (recommended):
```
npm install -g @augmentcode/auggie
auggie --version
```
If you prefer a local install:
```
npm install @augmentcode/auggie --save-dev
```
Then either set `AUGGIE_BIN` to the local binary path or let the bot auto-detect `node_modules/.bin/auggie`.

See docs/IMPLEMENTATION.md for the plan, commands, and setup steps.

## Discord setup (getting your token, app ID, guild ID)
1) Create the application
- Go to https://discord.com/developers/applications → New Application → name it → Create
- On “General Information”, copy Application ID (also called Client ID). This is DISCORD_APP_ID

2) Create the Bot user and token
- Left sidebar → Bot → Add Bot → Confirm
- On the Bot page, click “Reset Token” or “Copy Token” to get the bot token. This is DISCORD_TOKEN
- Intents: none required for this bot. Leave Message Content intent OFF unless you later add guild message reading. DMs do not require the privileged Message Content intent

3) Invite the bot to your server (optional but recommended for faster command registration via guild scope)
- Left sidebar → OAuth2 → URL Generator
  - Scopes: check both “applications.commands” and “bot”
  - Bot Permissions: check “Send Messages”, “Read Message History”, “Embed Links”, “Attach Files”
- Copy the generated URL, open it, and invite the bot to a server where you have “Manage Server”

## User install (DM-only) alternative
1) In the Developer Portal → your app → Installation:
   - Set Install Type to "User Install"
   - Under "Default Install Settings", select scopes: applications.commands and bot
   - For Bot Permissions, enable: Send Messages, Read Message History, Embed Links, Attach Files
   - Save Changes
2) Click the "Install to account" button (or use the generated Install Link)
3) In Discord, open a DM with your bot and try /start

Note: Global command registration can take several minutes (sometimes up to ~1 hour) to propagate. If slash commands do not appear in DM immediately, wait a bit and try again. During development, guild-scoped registration is faster, but user install is fine for DM-only usage once commands propagate.

4) Get your server (guild) ID (for guild-scoped command registration)
- In the Discord client: Settings → Advanced → enable “Developer Mode”
- Right‑click your server icon → “Copy Server ID”. This is DISCORD_GUILD_ID

## Register slash commands
Faster (guild-scoped) registration during development is recommended.

PowerShell (Windows):
```
# Guild-scoped registration (fast propagation)
$env:DISCORD_TOKEN="<your_bot_token>"
$env:DISCORD_APP_ID="<your_application_id>"
$env:DISCORD_GUILD_ID="<your_guild_id>"
npx ts-node src/commands/register.ts --guild

# Global registration (slower propagation, optional)
$env:DISCORD_TOKEN="<your_bot_token>"
$env:DISCORD_APP_ID="<your_application_id>"
npx ts-node src/commands/register.ts
```

## Run the bot (dev)
PowerShell (Windows):
```
$env:DISCORD_TOKEN="<your_bot_token>"
node --loader ts-node/esm src/index.ts
```

DM the bot:
## Storing your Discord credentials locally (git-ignored)
We store your app ID and bot token in a local secrets file that is already git-ignored:
- Path: data/app-secrets.json
- Format:
```
{
  "DISCORD_APP_ID": "<your_app_id>",
  "DISCORD_TOKEN": "<your_bot_token>"
}
```
You can also set these as environment variables; the bot prefers env but falls back to this file.

Optional: set DISCORD_OWNER_ID to DM help on startup
- You can set an environment variable `DISCORD_OWNER_ID=<your_user_id>` so the bot DMs you a short help message when it starts.
- To copy your user ID: Discord → Settings → Advanced → enable Developer Mode → Right-click your profile → Copy User ID.

- /start to spawn an Auggie PTY
- /root set <path> to set your workspace root
- /enhance now and /submit to control Prompt Enhancer behavior

### Chatting in DM (no slash command)
- You can just type in the DM and the bot will send that text to Auggie.
- The bot auto-starts a session on your first message if none is running.
- It streams output by editing a placeholder "Working…" message and posting overflow chunks.

### Changing workspace root at runtime
- Use `/root set <path>` to change the working directory.
- The bot restarts the Auggie PTY with the new root and resumes streaming.

## Developer: test the stream filter
Use the local tool to compare raw vs filtered Auggie frames while interacting:
```
npm run dev:filter -- [optional auggie args]
# examples:
# npm run dev:filter -- --version
# npm run dev:filter -- --workspace-root "C:\\path\\to\\project"
```
- Console shows two sections per tick: RAW (ANSI stripped) and FILTERED
- Also writes to data/filter-test/raw.txt and data/filter-test/filtered.txt
- Press Ctrl+C to exit

## Quick start (alternative using package scripts)
```
# After setting env vars in the same PowerShell session
npm run register:guild    # or: npm run register:global
npm run dev               # or: npm run build && npm start
```


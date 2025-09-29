# Auggie Discord Bot – Implementation Plan

This document captures architecture, dependencies, commands, and the step‑by‑step plan to build a DM‑only, interactive Auggie PTY bot with Prompt Enhancer support.

## Tech stack
- Node.js 18+
- TypeScript
- discord.js v14+
- @homebridge/node-pty-prebuilt-multiarch (PTY)
- keytar (secrets in OS keychain)
- strip-ansi (sanitize Auggie TUI output)
- zod (light input validation)

## Environment variables
- DISCORD_TOKEN: Bot token
- DISCORD_APP_ID: Application (client) ID
- DISCORD_GUILD_ID: Optional for guild‑scoped command registration during dev

## Install (to be run by developer)
```
# init project
npm init -y

# runtime deps
npm install discord.js @homebridge/node-pty-prebuilt-multiarch keytar strip-ansi zod yargs

# dev deps
npm install -D typescript ts-node @types/node nodemon

# tsconfig
npx tsc --init --rootDir src --outDir dist --esModuleInterop --resolveJsonModule --module commonjs --target ES2020
```

## NPM scripts (suggested)
```
"scripts": {
  "dev": "nodemon --watch src --ext ts --exec node --loader ts-node/esm src/index.ts",
  "build": "tsc -p .",
  "start": "node dist/index.js",
  "register:global": "ts-node src/commands/register.ts",
  "register:guild": "ts-node src/commands/register.ts --guild"
}
```

## Features (phase 1)
- DM‑only sessions, one PTY per DM channel
- /start, /stop, /session info, /timeout set, /resize
- Streaming output with deferReply + throttled editReply/followUp
- Prompt Enhancer default‑on toggle; /enhance-now, /submit
- /root set/show (restart with --workspace-root)
- Persist non‑secrets in data/sessions; secrets via keytar
- Default AUGMENT_DISABLE_AUTO_UPDATE=1

## Features (phase 2)
- /env set|unset|list (keytar for sensitive)
- /login (paste token + interactive auggie --login relay)
- /model list|set (TUI attempt first, fallback restart with --model)
- /rules set|clear (restart with --rules)
- /attach (save files into workspace uploads)

## Streaming rules
- Respond within 3s via deferReply (ephemeral by default)
- Edit at ≤2/s; chunk to ≤2000 chars per message; use followUp for overflow
- Strip ANSI sequences; optionally coalesce redraw noise

## Security
- Never print secrets back to Discord
- Store AUGMENT_API_TOKEN in keytar (service: "auggie-discord", account: `${channelId}:AUGMENT_API_TOKEN`)

## Directory layout
```
src/
  index.ts                # bot entry
  commands/
    commands.ts           # data/builders
    handlers.ts           # command handlers
    register.ts           # command registration script
  session/
    AuggieSession.ts
    SessionManager.ts
  storage/
    persistence.ts        # json + keytar helpers
  util/
    ansi.ts               # strip/segment utils

docs/
  IMPLEMENTATION.md
```

## Next steps
- Fill command handlers progressively
- Harden streaming and backpressure
- Add MCP and advanced controls after core is stable


import { Client, Events, GatewayIntentBits, Interaction, Partials } from 'discord.js';
import { handleSlashCommand, ensureCommandsLoaded, sessions } from './commands/handlers';

// Entry point for the bot. Prefers DISCORD_TOKEN from env, otherwise reads data/app-secrets.json
import fs from 'node:fs';
import path from 'node:path';

function loadTokenFromFile(): string | undefined {
  try {
    const file = path.resolve(process.cwd(), 'data', 'app-secrets.json');
    if (!fs.existsSync(file)) return undefined;
    const j = JSON.parse(fs.readFileSync(file, 'utf8')) as { DISCORD_TOKEN?: string };
    return j.DISCORD_TOKEN;
  } catch {
    return undefined;
  }
}
function loadOwnerFromFile(): string | undefined {
  try {
    const file = path.resolve(process.cwd(), 'data', 'app-secrets.json');
    if (!fs.existsSync(file)) return undefined;
    const j = JSON.parse(fs.readFileSync(file, 'utf8')) as { DISCORD_OWNER_ID?: string };
    return j.DISCORD_OWNER_ID;
  } catch {
    return undefined;
  }
}

const token = process.env.DISCORD_TOKEN ?? loadTokenFromFile();
if (!token) {
  console.error('Missing DISCORD_TOKEN (env or data/app-secrets.json).');
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.DirectMessages],
  partials: [Partials.Channel], // needed for DMs
});

client.once(Events.ClientReady, async (c) => {
  console.log(`Bot logged in as ${c.user.tag}`);
  await ensureCommandsLoaded();
  // DM a brief help to known DM channels (previous sessions) or owner if provided
  try {
    const ownerId = process.env.DISCORD_OWNER_ID ?? loadOwnerFromFile();
    if (ownerId) {
      const user = await c.users.fetch(ownerId);
      await user.send(startupHelpMessage());
    } else {
      // Fallback: DM any known session channels from data/sessions/*.json
      const dir = path.resolve(process.cwd(), 'data', 'sessions');
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
        for (const f of files) {
          const channelId = f.replace(/\.json$/, '');
          try {
            const ch = await c.channels.fetch(channelId);
            if (ch?.isDMBased()) {
              await (ch as any).send(startupHelpMessage());
            }
          } catch {}
        }
      }
    }
  } catch (e) { console.warn('Startup DM help send failed:', e); }
});

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;
    // DM-only policy for now
    if (interaction.inGuild()) {
      await interaction.reply({ content: 'Please DM me to use Auggie for now.', ephemeral: true });
      return;
    }
    await handleSlashCommand(interaction);
  } catch (err) {
    console.error(err);
    if (interaction.isRepliable()) {
      try { await interaction.reply({ content: 'An error occurred.', ephemeral: true }); } catch (_) {}
    }
  }
});
client.on(Events.MessageCreate, async (message) => {
  try {
    if (message.author?.bot) return;
    if (message.inGuild()) return; // DM-only behavior
    const content = message.content?.trim();
    if (!content) return;
    if (content.startsWith('/')) return; // slash commands handled separately

    const s = await sessions.getOrStart(message.channelId);
    const reply = await message.reply('Working…');
    await s.attachStreamingToMessage(reply);
    await s.send(content);
  } catch (e) {
    console.error('messageCreate error', e);
  }
});


function startupHelpMessage() {
  return [
    'Hi! I\'m your Auggie DM bot. Quick help:',
    '- /start: start an interactive Auggie PTY',
    '- /root set <path>: set workspace root',
    '- /login token <token> or /login interactive: authenticate',
    '- /enhance toggle | /enhance now, and /submit to send Enter',
    '- /env set|unset|list: manage env overrides (token stored securely)',
    '',
    'Tip: Global commands may take time to propagate. If you don\'t see slash commands yet, wait a bit and try again.',
  ].join('\n');
}

console.log('Starting Discord client...');
client.login(token);


import { REST, Routes } from 'discord.js';
import { commands } from './commands';

const token = process.env.DISCORD_TOKEN;
const appId = process.env.DISCORD_APP_ID;
const guildId = process.env.DISCORD_GUILD_ID; // optional for guild testing

if (!token || !appId) {
  console.error('DISCORD_TOKEN and DISCORD_APP_ID are required');
  process.exit(1);
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const { REST, Routes } = await import('discord.js');
  const rest = new REST({ version: '10' }).setToken(token as string);

  if (hasFlag('guild')) {
    if (!guildId) throw new Error('Set DISCORD_GUILD_ID to register guild commands');
    const data = await rest.put(
      Routes.applicationGuildCommands(appId as string, guildId as string),
      { body: commands },
    );
    console.log('Registered guild commands:', (data as any[]).length);
  } else {
    const data = await rest.put(
      Routes.applicationCommands(appId as string),
      { body: commands },
    );
    console.log('Registered global commands:', (data as any[]).length);
  }
}

main().catch(err => { console.error(err); process.exit(1); });


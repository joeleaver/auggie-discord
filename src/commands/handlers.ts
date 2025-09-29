import { ChatInputCommandInteraction, MessageFlags } from 'discord.js';
import { SessionManager } from '../session/SessionManager';
import { z } from 'zod';

export const sessions = new SessionManager();

export async function ensureCommandsLoaded() {
  // Placeholder: we could self-register here, but keep explicit script instead.
}

export async function handleSlashCommand(interaction: ChatInputCommandInteraction) {
  const name = interaction.commandName;
  const sub = interaction.options.getSubcommand(false);
  const channelId = interaction.channelId;

  switch (name) {
    case 'start': {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const s = await sessions.start(channelId);
      await s.attachStreaming(interaction); // begins streaming loop
      await interaction.followUp({ content: 'Session started.', flags: MessageFlags.Ephemeral });
      break;
    }
    case 'stop': {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      await sessions.stop(channelId);
      await interaction.editReply('Session stopped.');
      break;
    }
    case 'session': {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const info = await sessions.info(channelId);
      await interaction.editReply(codeBlock(JSON.stringify(info, null, 2)));
      break;
    }
    case 'root': {
      if (sub === 'set') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const path = interaction.options.getString('path', true);
        const s = await sessions.getOrStart(channelId);
        await s.setWorkspaceRoot(path);
        await s.attachStreaming(interaction);
        await interaction.followUp({ content: `Workspace root set to: ${path}`, flags: MessageFlags.Ephemeral });
      } else {
        const s = sessions.peek(channelId);
        await interaction.reply({ content: `Current root: ${s?.config.rootPath ?? '(not set)'}`, flags: MessageFlags.Ephemeral });
      }
      break;
    }
    case 'enhance': {
      if (sub === 'toggle') {
        const s = await sessions.getOrStart(channelId);
        s.config.enhancerDefault = !s.config.enhancerDefault;
        await sessions.persist(channelId);
        await interaction.reply({ content: `Enhancer default: ${s.config.enhancerDefault ? 'ON' : 'OFF'}`, flags: MessageFlags.Ephemeral });
      } else if (sub === 'now') {
        const s = await sessions.getOrStart(channelId);
        await s.triggerEnhanceNow();
        await interaction.reply({ content: 'Enhancer triggered. Submitting shortly...', flags: MessageFlags.Ephemeral });
      }
      break;
    }
    case 'submit': {
      const s = await sessions.getOrStart(channelId);
      await s.submit();
      await interaction.reply({ content: 'Submitted (Enter).', flags: MessageFlags.Ephemeral });
      break;
    }
    case 'env': {
      if (sub === 'set') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const key = interaction.options.getString('key', true);
        const value = interaction.options.getString('value', true);
        await sessions.setEnv(channelId, key, value);
        await interaction.editReply(`Set env: ${key}=${mask(value)}`);
      } else if (sub === 'unset') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const key = interaction.options.getString('key', true);
        await sessions.unsetEnv(channelId, key);
        await interaction.editReply(`Unset env: ${key}`);
      } else {
        const list = await sessions.listEnv(channelId);
        await interaction.reply({ content: codeBlock(list.map(([k,v])=>`${k}=${v}`).join('\n') || '(none)'), flags: MessageFlags.Ephemeral });
      }
      break;
    }
    case 'login': {
      if (sub === 'token') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const token = interaction.options.getString('token', true);
        await sessions.setEnv(channelId, 'AUGMENT_API_TOKEN', token, true);
        await interaction.editReply('Token stored securely.');
      } else if (sub === 'interactive') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const s = await sessions.getOrStart(channelId);
        await s.runInteractiveLogin(interaction);
      }
      break;
    }
    case 'model': {
      if (sub === 'list') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const models = await sessions.listModels(channelId);
        await interaction.editReply(codeBlock(models.join('\n') || '(none)'));
      } else if (sub === 'set') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const name = interaction.options.getString('name', true);
        const s = await sessions.getOrStart(channelId);
        await s.setModel(name);
        await interaction.editReply(`Model set to ${name}`);
      }
      break;
    }
    case 'rules': {
      if (sub === 'set') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const path = interaction.options.getString('path', true);
        const s = await sessions.getOrStart(channelId);
        await s.setRules(path);
        await interaction.editReply(`Rules file set: ${path}`);
      } else if (sub === 'clear') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const s = await sessions.getOrStart(channelId);
        await s.clearRules();
        await interaction.editReply('Rules cleared.');
      }
      break;
    }
    case 'timeout': {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const seconds = interaction.options.getInteger('seconds', true);
      const s = await sessions.getOrStart(channelId);
      await s.setIdleTimeout(seconds);
      await interaction.editReply(`Idle timeout set to ${seconds}s`);
      break;
    }
    case 'resize': {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const cols = interaction.options.getInteger('cols', true);
      const rows = interaction.options.getInteger('rows', true);
      const s = await sessions.getOrStart(channelId);
      await s.resize(cols, rows);
      await interaction.editReply(`Resized to ${cols}x${rows}`);
      break;
    }
    default:
      await interaction.reply({ content: 'Unknown command.', flags: MessageFlags.Ephemeral });
  }
}

function codeBlock(s: string) { return '```\n' + s + '\n```'; }
function mask(v: string) { return v.length <= 6 ? '*'.repeat(v.length) : v.slice(0,2) + '***' + v.slice(-2); }


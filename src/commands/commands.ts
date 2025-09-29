import { SlashCommandBuilder } from 'discord.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('start')
    .setDescription('Start an Auggie session in this DM.')
    .setDMPermission(true),
  new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop the Auggie session for this DM.')
    .setDMPermission(true),
  new SlashCommandBuilder()
    .setName('session')
    .setDescription('Show session info.')
    .setDMPermission(true),
  new SlashCommandBuilder()
    .setName('root')
    .setDescription('Workspace root controls')
    .setDMPermission(true)
    .addSubcommand(sc => sc
      .setName('set')
      .setDescription('Set workspace root path')
      .addStringOption(o => o.setName('path').setDescription('Absolute or relative path').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('show')
      .setDescription('Show current workspace root')), 
  new SlashCommandBuilder()
    .setName('enhance')
    .setDescription('Prompt Enhancer controls')
    .setDMPermission(true)
    .addSubcommand(sc => sc.setName('toggle').setDescription('Toggle enhancer default on/off'))
    .addSubcommand(sc => sc.setName('now').setDescription('Trigger enhancer now on next submission')),
  new SlashCommandBuilder()
    .setName('submit')
    .setDescription('Send Enter to Auggie (submit input).')
    .setDMPermission(true),
  new SlashCommandBuilder()
    .setName('env')
    .setDescription('Environment overrides')
    .setDMPermission(true)
    .addSubcommand(sc => sc
      .setName('set')
      .setDescription('Set env var (secret keys stored securely)')
      .addStringOption(o => o.setName('key').setDescription('ENV KEY').setRequired(true))
      .addStringOption(o => o.setName('value').setDescription('ENV VALUE').setRequired(true)))
    .addSubcommand(sc => sc
      .setName('unset')
      .setDescription('Unset env var')
      .addStringOption(o => o.setName('key').setDescription('ENV KEY').setRequired(true)))
    .addSubcommand(sc => sc.setName('list').setDescription('List env overrides (values redacted)')),
  new SlashCommandBuilder()
    .setName('login')
    .setDescription('Authenticate Auggie')
    .setDMPermission(true)
    .addSubcommand(sc => sc
      .setName('token')
      .setDescription('Provide AUGMENT_API_TOKEN (ephemeral)')
      .addStringOption(o => o.setName('token').setDescription('Token').setRequired(true)))
    .addSubcommand(sc => sc.setName('interactive').setDescription('Run auggie --login flow')),
  new SlashCommandBuilder()
    .setName('model')
    .setDescription('Model controls')
    .setDMPermission(true)
    .addSubcommand(sc => sc.setName('list').setDescription('List available models'))
    .addSubcommand(sc => sc.setName('set').setDescription('Set model')
      .addStringOption(o => o.setName('name').setDescription('model name').setRequired(true))),
  new SlashCommandBuilder()
    .setName('rules')
    .setDescription('Rules controls')
    .setDMPermission(true)
    .addSubcommand(sc => sc.setName('set').setDescription('Set rules file path')
      .addStringOption(o => o.setName('path').setDescription('path to rules file').setRequired(true)))
    .addSubcommand(sc => sc.setName('clear').setDescription('Clear rules')),
  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Idle timeout')
    .setDMPermission(true)
    .addIntegerOption(o => o.setName('seconds').setDescription('Idle shutdown seconds').setRequired(true)),
  new SlashCommandBuilder()
    .setName('resize')
    .setDescription('Resize the PTY window')
    .setDMPermission(true)
    .addIntegerOption(o => o.setName('cols').setDescription('Columns').setRequired(true))
    .addIntegerOption(o => o.setName('rows').setDescription('Rows').setRequired(true)),
].map(c => c.toJSON());

export type CommandName =
  | 'start' | 'stop' | 'session'
  | 'root' | 'enhance' | 'submit' | 'env' | 'login'
  | 'model' | 'rules' | 'timeout' | 'resize';


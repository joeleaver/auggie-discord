import * as pty from '@homebridge/node-pty-prebuilt-multiarch';
import { ChatInputCommandInteraction, Message, MessageFlags } from 'discord.js';
import { persistSession, readSession, SessionConfig } from '../storage/persistence';
import { splitToChunks } from '../util/ansi';
import { filterAuggieFrame } from '../util/streamFilter';
import fs from 'node:fs';
import path from 'node:path';

function stripAnsiLocal(s: string): string {
  return s.replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]/g, '');
}

export class AuggieSession {

  public pty?: pty.IPty;
  public config: SessionConfig;
  private buffer: string[] = [];
  private lastActivity = Date.now();
  private enhanceNext = false;

  private lastStreamSnapshot: string | undefined;
  private rolling: string = '';
  private readonly maxRolling = 12000;

  private finalSent = true;
  private readonly idleMs = 1500;
  private streamInterval?: NodeJS.Timeout;



  constructor(public channelId: string, cfg: SessionConfig) {
    this.config = cfg;
  }
  private buildSpawnTarget(): { file: string; args: string[] } {
    const bin = this.resolveAuggieBin();
    const args = this.buildArgs();
    if (process.platform === 'win32') {
      const file = process.env.COMSPEC || 'C\\\Windows\\\System32\\\cmd.exe';
      return { file, args: ['/c', bin, ...args] };
    }
    return { file: bin, args };
  }


  async start() {
    if (this.pty) return;
    const env = await readSession.envCombined(this.channelId, this.config);
    const { file, args } = this.buildSpawnTarget();
    this.pty = pty.spawn(file, args, {
      name: 'xterm-color', cols: this.config.cols ?? 120, rows: this.config.rows ?? 30,
      cwd: this.config.rootPath ?? process.cwd(), env,
    });
    this.pty.onData((d) => { this.buffer.push(d); this.lastActivity = Date.now(); });
    this.pty.onExit(() => { this.pty = undefined; });
  }

  async stop() {
    if (!this.pty) return;
    try { this.pty.write('\x03'); /* Ctrl+C */ } catch {}
    setTimeout(()=>{ try { this.pty?.kill(); } catch {} this.pty = undefined; }, 750);
  }

  async attachStreaming(interaction: ChatInputCommandInteraction) {
    // Append streaming: first chunk edits the placeholder; subsequent chunks use followUps
    let sending = false;
    let primed = false;
    const tick = async () => {
      if (sending) return;
      sending = true;
      try {
        if (this.buffer.length === 0) return;
        const chunk = filterAuggieFrame(this.buffer.join(''));
        this.buffer.length = 0;
        if (!chunk.trim()) return;
        // Accumulate rolling content and send a window
        this.rolling = this.rolling ? this.rolling + '\n' + chunk : chunk;
        if (this.rolling.length > this.maxRolling) this.rolling = this.rolling.slice(-this.maxRolling);
        const windowText = this.rolling.length > 1900 ? this.rolling.slice(-1900) : this.rolling;
        if (windowText === this.lastStreamSnapshot) return;
        this.lastStreamSnapshot = windowText;
        await interaction.editReply(windowText);
        await this.maybeSendFinal(interaction);
      } finally { sending = false; }
    };
    if (this.streamInterval) clearInterval(this.streamInterval);
    this.streamInterval = setInterval(tick, 1000);
    setTimeout(()=>{ if (this.streamInterval) { clearInterval(this.streamInterval); this.streamInterval = undefined; } }, 14 * 60 * 1000);
  }

  async attachStreamingToMessage(message: Message) {
    let sending = false;
    let primed = false;
    const tick = async () => {
      if (sending) return;
      sending = true;
      try {
        if (this.buffer.length === 0) return;
        const chunk = filterAuggieFrame(this.buffer.join(''));
        this.buffer.length = 0;
        if (!chunk.trim()) return;

        this.rolling = this.rolling ? this.rolling + '\n' + chunk : chunk;
        if (this.rolling.length > this.maxRolling) this.rolling = this.rolling.slice(-this.maxRolling);
        const windowText = this.rolling.length > 1900 ? this.rolling.slice(-1900) : this.rolling;
        if (windowText === this.lastStreamSnapshot) return;
        this.lastStreamSnapshot = windowText;
        await message.edit(windowText);
        await this.maybeSendFinal(message);
      } finally { sending = false; }
    };
    if (this.streamInterval) clearInterval(this.streamInterval);
    this.streamInterval = setInterval(tick, 1000);
    setTimeout(()=>{ if (this.streamInterval) { clearInterval(this.streamInterval); this.streamInterval = undefined; } }, 14 * 60 * 1000);
  }

  async send(text: string) {
    await this.start();
    // Reset rolling window for a new request
    this.rolling = '';
    this.finalSent = false;
    this.lastStreamSnapshot = undefined;
    this.pty!.write(text);
    if (this.config.enhancerDefault || this.enhanceNext) {
      this.pty!.write('\x10'); // Ctrl+P
    }
    setTimeout(()=> this.pty?.write('\r'), 600);
    this.enhanceNext = false;
  }

  async triggerEnhanceNow() {
    this.enhanceNext = true;
  }

  async submit() {
    await this.start();
    this.pty!.write('\r');
  }

  private async maybeSendFinal(interactionOrMessage: ChatInputCommandInteraction | Message) {
    if (this.finalSent) return;
    if (Date.now() - this.lastActivity < this.idleMs) return;
    const full = this.rolling.trim();
    if (!full) { this.finalSent = true; return; }
    const channel: any = (interactionOrMessage as any).channel;
    if (!channel) { this.finalSent = true; return; }
    const chunks: string[] = [];
    let i = 0;
    while (i < full.length && chunks.length < 5) {
      chunks.push(full.slice(i, i + 1900));
      i += 1900;
    }
    try {
      for (const c of chunks) await channel.send({ content: c });
    } catch {}
    this.finalSent = true;
  }

  async setWorkspaceRoot(path: string) {
    this.config.rootPath = path;
    await this.restart();
  }

  async setModel(name: string) {
    // Try in-TUI first (best effort)
    await this.start();
    this.pty!.write(`/model ${name}`);
    setTimeout(()=> this.pty?.write('\r'), 100);
    // Fallback: restart with flag if needed
    this.config.model = name;
    await persistSession(this.channelId, this.config);
  }

  async listModels(): Promise<string[]> {
    // TODO: run one-shot `auggie --list-models` and parse. For now, return empty.
    return [];
  }

  async runInteractiveLogin(interaction: import('discord.js').ChatInputCommandInteraction) {
    // Spawn a temporary PTY for `auggie --login` and relay its output ephemerally
    const env = await readSession.envCombined(this.channelId, this.config);
    const bin = this.resolveAuggieBin();
    const isWin = process.platform === 'win32';
    const file = isWin ? (process.env.COMSPEC || 'C\\Windows\\System32\\cmd.exe') : bin;
    const args = isWin ? ['/c', bin, '--login'] : ['--login'];
    const loginPty = pty.spawn(file, args, {
      name: 'xterm-color', cols: 100, rows: 20,
      cwd: this.config.rootPath ?? process.cwd(),
      env,
    });
    loginPty.onData(async (d) => {
      const text = stripAnsiLocal(d);
      if (!text.trim()) return;
      // best-effort incremental updates (followUp to avoid edit timing issues)
      await interaction.followUp({ content: '```\n' + text.slice(0, 1800) + '\n```', flags: MessageFlags.Ephemeral });
    });
    await new Promise<void>((resolve) => loginPty.onExit(() => resolve()));
    // After exit, we could verify token via a one-shot.
    await interaction.followUp({ content: 'Login flow completed (if successful). You can verify by trying a command.', flags: MessageFlags.Ephemeral });
  }

  private resolveAuggieBin(): string {
    // Priority: config.auggieBin -> env AUGGIE_BIN -> local node_modules/.bin/auggie -> 'auggie'
    if (this.config.auggieBin && fs.existsSync(this.config.auggieBin)) return this.config.auggieBin;
    const envBin = process.env.AUGGIE_BIN;
    if (envBin && fs.existsSync(envBin)) return envBin;
    const localBin = path.resolve(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'auggie.cmd' : 'auggie');
    if (fs.existsSync(localBin)) return localBin;
    return 'auggie';
  }

  async setRules(path: string) { this.config.rules = path; await this.restart(); }
  async clearRules() { this.config.rules = undefined; await this.restart(); }

  async setIdleTimeout(seconds: number) { this.config.idleTimeoutSecs = seconds; await persistSession(this.channelId, this.config); }

  async resize(cols: number, rows: number) { this.config.cols = cols; this.config.rows = rows; this.pty?.resize(cols, rows); await persistSession(this.channelId, this.config); }

  info() {
    return {
      pid: this.pty?.pid ?? null,
      rootPath: this.config.rootPath ?? null,
      model: this.config.model ?? null,
      rules: this.config.rules ?? null,
      enhancerDefault: this.config.enhancerDefault,
      idleTimeoutSecs: this.config.idleTimeoutSecs ?? null,
      size: { cols: this.config.cols ?? 120, rows: this.config.rows ?? 30 },
      lastActivity: this.lastActivity,
    };
  }

  private buildArgs(): string[] {
    const args: string[] = [];
    if (this.config.rootPath) { args.push('--workspace-root', this.config.rootPath); }
    if (this.config.rules) { args.push('--rules', this.config.rules); }
    if (this.config.model) { args.push('--model', this.config.model); }
    return args;
  }

  private async restart() {
    await persistSession(this.channelId, this.config);
    await this.stop();
    await this.start();
  }
}


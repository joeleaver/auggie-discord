import { AuggieSession } from './AuggieSession';
import { ensureStore, loadConfig, persistSession, readSession, SessionConfig } from '../storage/persistence';

const DEFAULTS: SessionConfig = {
  enhancerDefault: true,
  ephemeralDefault: true,
  idleTimeoutSecs: 45 * 60,
  cols: 120,
  rows: 30,
};

export class SessionManager {
  private sessions = new Map<string, AuggieSession>();
  private timers = new Map<string, NodeJS.Timeout>();

  constructor() { ensureStore(); }

  peek(channelId: string) { return this.sessions.get(channelId); }

  async getOrStart(channelId: string) {
    let s = this.sessions.get(channelId);
    if (!s) {
      const cfg = await loadConfig(channelId, DEFAULTS);
      s = new AuggieSession(channelId, cfg);
      this.sessions.set(channelId, s);
      this.armIdleTimer(channelId);
      await s.start();
    }
    return s;
  }

  async start(channelId: string) { return this.getOrStart(channelId); }

  async stop(channelId: string) {
    const s = this.sessions.get(channelId);
    if (s) {
      await s.stop();
      this.sessions.delete(channelId);
    }
    const t = this.timers.get(channelId); if (t) clearTimeout(t);
  }

  async info(channelId: string) {
    const s = await this.getOrStart(channelId);
    return s.info();
  }

  async setEnv(channelId: string, key: string, value: string, secret = false) {
    await readSession.setEnv(channelId, key, value, secret);
    await persistSession(channelId, (await loadConfig(channelId, DEFAULTS)));
    const s = this.sessions.get(channelId);
    if (s) await s.start();
  }

  async unsetEnv(channelId: string, key: string) {
    await readSession.unsetEnv(channelId, key);
  }

  async listEnv(channelId: string) {
    const pairs = await readSession.listEnv(channelId);
    return pairs.map(([k,v]) => [k, v.redacted] as const);
  }

  async persist(channelId: string) {
    const s = this.sessions.get(channelId);
    if (!s) return;
    await persistSession(channelId, s.config);
  }

  async listModels(channelId: string) {
    const s = await this.getOrStart(channelId);
    return s.listModels();
  }

  private armIdleTimer(channelId: string) {
    const s = this.sessions.get(channelId);
    if (!s) return;
    const secs = s.config.idleTimeoutSecs ?? DEFAULTS.idleTimeoutSecs!;
    const t = setTimeout(() => {
      this.stop(channelId).catch(()=>{});
    }, secs * 1000);
    this.timers.set(channelId, t);
  }
}


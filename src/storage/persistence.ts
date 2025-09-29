import fs from 'node:fs';
import path from 'node:path';
import keytar from 'keytar';

export type SessionConfig = {
  rootPath?: string;
  model?: string;
  rules?: string;
  auggieBin?: string;
  enhancerDefault: boolean;
  ephemeralDefault: boolean;
  idleTimeoutSecs?: number;
  cols?: number;
  rows?: number;
};

const DATA_DIR = path.resolve(process.cwd(), 'data', 'sessions');
const SERVICE = 'auggie-discord';

export function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export async function loadConfig(channelId: string, defaults: SessionConfig): Promise<SessionConfig> {
  ensureStore();
  const file = path.join(DATA_DIR, `${channelId}.json`);
  if (!fs.existsSync(file)) return { ...defaults };
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as SessionConfig;
  return { ...defaults, ...raw };
}

export async function persistSession(channelId: string, cfg: SessionConfig) {
  ensureStore();
  const file = path.join(DATA_DIR, `${channelId}.json`);
  fs.writeFileSync(file, JSON.stringify(cfg, null, 2), 'utf8');
}

export const readSession = {
  async envCombined(channelId: string, cfg: SessionConfig): Promise<NodeJS.ProcessEnv> {
    const plain = await this._readPlain(channelId);
    const secret = await this._readSecrets(channelId);
    return {
      ...process.env,
      AUGMENT_DISABLE_AUTO_UPDATE: '1',
      ...plain,
      ...secret,
    };
  },
  async setEnv(channelId: string, key: string, value: string, secret = false) {
    if (secret || isSensitive(key)) {
      await keytar.setPassword(SERVICE, `${channelId}:${key}`, value);
      await this._writePlain(channelId, (env) => { delete env[key]; return env; });
    } else {
      await this._writePlain(channelId, (env) => { env[key] = value; return env; });
    }
  },
  async unsetEnv(channelId: string, key: string) {
    await keytar.deletePassword(SERVICE, `${channelId}:${key}`);
    await this._writePlain(channelId, (env) => { delete env[key]; return env; });
  },
  async listEnv(channelId: string): Promise<Array<[string, { redacted: string }]>> {
    const plain = await this._readPlain(channelId);
    const keys = Object.keys(plain);
    const redactedPlain = keys.map(k => [k, { redacted: redact(plain[k]) }] as const);
    // We cannot enumerate keytar secrets by service consistently across OS; show known sensitive keys
    const sensitiveKeys = ['AUGMENT_API_TOKEN'];
    const redactedSecrets = await Promise.all(sensitiveKeys.map(async k => {
      const v = await keytar.getPassword(SERVICE, `${channelId}:${k}`);
      return v ? [k, { redacted: redact(v) }] as const : undefined;
    }));
    return [...redactedPlain, ...redactedSecrets.filter(Boolean) as any[]];
  },
  async _readPlain(channelId: string): Promise<Record<string,string>> {
    const file = path.join(DATA_DIR, `${channelId}.env.json`);
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string,string>;
  },
  async _writePlain(channelId: string, mut: (env: Record<string,string>) => Record<string,string>) {
    const file = path.join(DATA_DIR, `${channelId}.env.json`);
    const current = await this._readPlain(channelId);
    const next = mut(current);
    fs.writeFileSync(file, JSON.stringify(next, null, 2), 'utf8');
  },
  async _readSecrets(channelId: string): Promise<Record<string,string>> {
    const secrets: Record<string,string> = {};
    const sensitiveKeys = ['AUGMENT_API_TOKEN'];
    for (const k of sensitiveKeys) {
      const val = await keytar.getPassword(SERVICE, `${channelId}:${k}`);
      if (val) secrets[k] = val;
    }
    return secrets;
  },
};

function isSensitive(key: string) {
  return /TOKEN|SECRET|KEY|PASSWORD/i.test(key);
}

function redact(v: string) {
  return v.length <= 6 ? '*'.repeat(v.length) : `${v.slice(0,2)}***${v.slice(-2)}`;
}


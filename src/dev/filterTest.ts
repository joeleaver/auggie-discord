import * as pty from '@homebridge/node-pty-prebuilt-multiarch';
import fs from 'node:fs';
import path from 'node:path';
import { filterAuggieFrame } from '../util/streamFilter';

function stripAnsiLocal(s: string): string {
  // Basic CSI sequence stripper
  return s.replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]/g, '');
}

function resolveAuggieBin(): string {
  const envBin = process.env.AUGGIE_BIN;
  if (envBin && fs.existsSync(envBin)) return envBin;
  const localBin = path.resolve(process.cwd(), 'node_modules', '.bin', process.platform === 'win32' ? 'auggie.cmd' : 'auggie');
  if (fs.existsSync(localBin)) return localBin;
  return 'auggie';
}

function buildSpawnTarget(extraArgs: string[]): { file: string; args: string[] } {
  const bin = resolveAuggieBin();
  const args = extraArgs;
  if (process.platform === 'win32') {
    const file = process.env.COMSPEC || 'C\\Windows\\System32\\cmd.exe';
    return { file, args: ['/c', bin, ...args] };
  }
  return { file: bin, args };
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

async function main() {
  console.log('[filterTest] Starting interactive Auggie with raw vs filtered capture. Press Ctrl+C to exit.');
  const dataDir = path.resolve(process.cwd(), 'data', 'filter-test');
  console.log('\n[filterTest] Keyboard passthrough enabled. Type to send to Auggie. Ctrl+C to exit.');

  ensureDir(dataDir);
  const rawFile = path.join(dataDir, 'raw.txt');
  const filteredFile = path.join(dataDir, 'filtered.txt');
  fs.writeFileSync(rawFile, '');
  fs.writeFileSync(filteredFile, '');

  const extraArgs = process.argv.slice(2); // pass-through any args (e.g., --workspace-root ...)
  const { file, args } = buildSpawnTarget(extraArgs);

  const p = pty.spawn(file, args, {
    name: 'xterm-color', cols: 120, rows: 30,
    cwd: process.cwd(), env: process.env,
  });

  let buffer = '';
  p.onData(d => { buffer += d; });

  const tick = () => {
    if (!buffer) return;
    const chunk = buffer;
    buffer = '';
    const raw = stripAnsiLocal(chunk);
    const filtered = filterAuggieFrame(chunk);
    // Console view
    console.log('\n===== RAW (cleaned ANSI) =====');
    console.log(raw);
    console.log('===== FILTERED =====');
    console.log(filtered);
    // Append to files
  // Forward keyboard input to PTY
  if (process.stdin.isTTY) {
    try { (process.stdin as any).setRawMode(true); } catch {}
  }
  process.stdin.resume();
  process.stdin.on('data', (d) => {
    try { p.write(d.toString()); } catch {}
  });

    fs.appendFileSync(rawFile, raw + '\n');
    fs.appendFileSync(filteredFile, filtered + '\n');
  };
  const interval = setInterval(tick, 500);

  process.on('SIGINT', () => {
    clearInterval(interval);
    try { p.write('\x03'); } catch {}
    setTimeout(() => { try { p.kill(); } catch {}; process.exit(0); }, 300);
  });
}

main().catch(e => { console.error(e); process.exit(1); });


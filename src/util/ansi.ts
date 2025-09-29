// Minimal ANSI CSI stripper to avoid ESM import issues
export function stripAnsi(s: string) {
  return s.replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]/g, '');
}

export function splitToChunks(s: string, max = 1900): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    out.push(s.slice(i, i + max));
    i += max;
  }
  return out;
}


// Heuristic filters to reduce TUI noise from Auggie frames
function stripAnsiLocal(s: string): string {
  return s.replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]/g, '');
}

export function filterAuggieFrame(raw: string): string {
  const s = stripAnsiLocal(raw);
  const lines = s.split(/\r?\n/);
  // Always drop the last 4 lines (input box + footer area)
  // Capture a possibly-removed "Indexing complete" line so we can re-add it later if it falls in the last 4 lines
  let indexingCompleteText: string | undefined;
  for (let i = lines.length - 1; i >= 0; i--) {
    const t = lines[i].trim();
    if (/^✓\s*Indexing complete/i.test(t) || /Indexing complete/i.test(t)) { indexingCompleteText = t; break; }
  }

  const base = lines.length > 4 ? lines.slice(0, lines.length - 4) : lines.slice();

  // 1) Find the LAST input box triple: top (╭…), middle (│ …), bottom (╰…)
  let lastTop = -1;
  for (let i = 0; i < base.length - 2; i++) {
    const a = base[i]?.trimStart();
    const b = base[i+1]?.trimStart();
    const c = base[i+2]?.trimStart();
    if (a?.startsWith('╭') && b?.startsWith('│') && c?.startsWith('╰')) {
      lastTop = i;
    }
  }

  // 2) Keep everything BEFORE the last input box (drops box + footer)
  const slice = lastTop >= 0 ? base.slice(0, lastTop) : base.slice();

  // 3) Filter obvious chrome within the slice and extract inner pane content (strip leading/trailing box borders)
  const out: string[] = [];
  const borderOnly = /^[ \t\u2500-\u257F]+$/;
  const footerHints = /(Ctrl\+P|Prompt Enhancer|\? to show shortcuts|type \/ for commands)/i;
  const rightPath = /[A-Za-z]:\\[^\s]+$/;
  const paneLine = /^\s*[\u2502\u2551](.*?)[\u2502\u2551]\s*$/; // "│ ... │" or "║ ... ║"
  const spinner = /^\s*[\u2800-\u28FF].*\b(Sending|Processing|Indexing)\b.*$/i; // braille spinners + status
  const progressBar = /[░█]+\s*\d+%/; // progress bar lines
  const barePrompt = /^\s*[>\u203a\u276f\u00bb]\s*$/;

  for (let i = 0; i < slice.length; i++) {
    const rawLine = slice[i];
    const trimmedEnd = rawLine.replace(/[\r\n]+$/, '');
    let candidate = trimmedEnd.trimEnd();

    // Strip inner content from framed lines
    const m = candidate.match(paneLine);
    if (m) candidate = m[1].replace(/\s+$/,'');

    // Drop inline spinner/status suffixes even if appended to content
    candidate = candidate
      .replace(/[\u2800-\u28FF]\s*(Sending request|Processing response|Indexing)[^\r\n]*$/i, '')
      .replace(/\s*(Sending request|Processing response|Indexing)\.{3}[^\r\n]*$/i, '')
      .replace(/\s*\([^)]*esc to interrupt\)[^\r\n]*$/i, '')
      .replace(/[ \t\u2500-\u257F]*[\u256D\u2570]?[\u2500\u2501\u2550\u2504\u2505\u2506\u2507\u254C\u254D]+[\u256E\u256F]?[ \t]*$/,'')
      .trimEnd();

    if (!candidate.trim()) continue;
    if (borderOnly.test(candidate)) continue; // pure borders/dividers
    if (footerHints.test(candidate)) continue; // footer hint strings
    if (/\bTry '.*'\b/i.test(candidate)) continue; // try-hint line
    if (rightPath.test(candidate)) continue;   // right-aligned path
    if (spinner.test(candidate)) continue;     // transient spinner/status lines
    if (progressBar.test(candidate)) continue; // progress bar lines
    if (barePrompt.test(candidate)) continue;  // lone prompt without content
    if (/^\s{20,}$/.test(candidate)) continue;

    out.push(candidate);
  }

  // 4) Collapse duplicate adjacent lines
  const dedup: string[] = [];
  for (const l of out) {
    if (dedup.length === 0 || dedup[dedup.length - 1] !== l) dedup.push(l);
  }

  // If the "Indexing complete" line was in the trimmed tail and not kept, append it once
  if (indexingCompleteText && !dedup.some(l => /Indexing complete/i.test(l))) {
    dedup.push(indexingCompleteText);
  }
  return dedup.join('\n').trim();
}


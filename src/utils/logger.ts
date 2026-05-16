/**
 * Minimal structured logger. When JSON mode is enabled (`--json`), key
 * pipeline milestones are emitted as one JSON object per line on stdout for
 * downstream analysis. Otherwise it's a no-op (ora handles human output).
 */

let jsonMode = false;

export function setJsonLogging(enabled: boolean): void {
  jsonMode = enabled;
}

export function logEvent(event: string, data: Record<string, unknown> = {}): void {
  if (!jsonMode) return;
  process.stdout.write(
    JSON.stringify({ ts: new Date().toISOString(), event, ...data }) + "\n"
  );
}

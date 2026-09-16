/**
 * Resolve process group (TGID), executable path, and optional command line from /proc
 * for opensnoop thread PIDs.
 */

import { readFileSync, readlinkSync } from 'fs';
import { basename } from 'path';

export interface ProcessResolveOptions {
  /** When true, read /proc/{tgid}/cmdline (may contain secrets; off by default). */
  captureCommandLine?: boolean;
}

export interface ProcessInfo {
  tgid: number;
  processName: string;
  threadComm: string;
  /** Resolved /proc/{tgid}/exe path when readable. */
  processExecutablePath?: string;
  /** Full argv joined with spaces; only present when captureCommandLine is enabled. */
  processCommandLine?: string;
}

const cache = new Map<string, ProcessInfo>();

function cacheKey(threadPid: number, options: ProcessResolveOptions): string {
  return `${threadPid}:${options.captureCommandLine ? 'cmd' : 'nocmd'}`;
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/** Format null-separated /proc/cmdline bytes into a single display string. */
export function formatCmdline(raw: string): string | undefined {
  const parts = raw.split('\0').filter(Boolean);
  if (parts.length === 0) {
    return undefined;
  }
  return parts.join(' ');
}

function readExecutablePath(tgid: number): string | undefined {
  try {
    return readlinkSync(`/proc/${tgid}/exe`);
  } catch {
    return undefined;
  }
}

function readCommandLine(tgid: number): string | undefined {
  const raw = readText(`/proc/${tgid}/cmdline`);
  if (!raw) {
    return undefined;
  }
  return formatCmdline(raw);
}

/**
 * Resolve TGID, process name, and executable path for a thread PID.
 * Command line is read only when captureCommandLine is true.
 */
export function resolveProcessInfo(
  threadPid: number,
  threadComm: string,
  options: ProcessResolveOptions = {},
): ProcessInfo {
  const key = cacheKey(threadPid, options);
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  let tgid = threadPid;
  const status = readText(`/proc/${threadPid}/status`);
  if (status) {
    const tgidMatch = status.match(/^Tgid:\s+(\d+)/m);
    if (tgidMatch) {
      const parsed = parseInt(tgidMatch[1], 10);
      if (!Number.isNaN(parsed)) {
        tgid = parsed;
      }
    }
  }

  const processExecutablePath = readExecutablePath(tgid);

  let processName = threadComm.trim() || 'unknown';
  const comm = readText(`/proc/${tgid}/comm`);
  if (comm) {
    processName = comm.trim();
  } else if (processExecutablePath) {
    processName = basename(processExecutablePath);
  }

  const info: ProcessInfo = {
    tgid,
    processName,
    threadComm: threadComm.trim(),
    processExecutablePath,
  };

  if (options.captureCommandLine) {
    const processCommandLine = readCommandLine(tgid);
    if (processCommandLine) {
      info.processCommandLine = processCommandLine;
    }
  }

  cache.set(key, info);
  return info;
}

/** Clear cache (for tests). */
export function clearProcessInfoCache(): void {
  cache.clear();
}

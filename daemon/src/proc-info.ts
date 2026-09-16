/**
 * Resolve process group (TGID) and process name from /proc for opensnoop thread PIDs.
 */

import { readFileSync, readlinkSync } from 'fs';
import { basename } from 'path';

export interface ProcessInfo {
  tgid: number;
  processName: string;
  threadComm: string;
}

const cache = new Map<number, ProcessInfo>();

function readText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Resolve TGID and process name for a thread PID. Results are cached per thread PID.
 */
export function resolveProcessInfo(threadPid: number, threadComm: string): ProcessInfo {
  const cached = cache.get(threadPid);
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

  let processName = threadComm.trim() || 'unknown';
  const comm = readText(`/proc/${tgid}/comm`);
  if (comm) {
    processName = comm.trim();
  } else {
    try {
      const exePath = readlinkSync(`/proc/${tgid}/exe`);
      processName = basename(exePath);
    } catch {
      // keep thread comm fallback
    }
  }

  const info: ProcessInfo = {
    tgid,
    processName,
    threadComm: threadComm.trim(),
  };

  cache.set(threadPid, info);
  return info;
}

/** Clear cache (for tests). */
export function clearProcessInfoCache(): void {
  cache.clear();
}

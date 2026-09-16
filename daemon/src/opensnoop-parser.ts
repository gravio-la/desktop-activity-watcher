/**
 * Parse BCC opensnoop output with -T -U (default) or -T -U -e (FLAGS column).
 *
 * Default:  TIME(s) UID PID COMM(16) FD ERR PATH
 * With -e:   TIME(s) UID PID COMM(16) FD ERR FLAGS PATH
 *
 * Note: opensnoop -F is --full-path (kernel-internal headers), not flags.
 * COMM is a fixed 16-character kernel task name (may contain spaces, padded).
 */

export interface ParsedOpensnoopLine {
  timeStr: string;
  uid: number;
  threadPid: number;
  comm: string;
  fd: number;
  err: string;
  flags: string;
  filePath: string;
}

const HEADER_PREFIXES = ['TIME', 'UID', '---'];

/**
 * Parse one opensnoop output line. Returns null for headers, blanks, or malformed lines.
 */
export function parseOpensnoopLine(line: string): ParsedOpensnoopLine | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  if (HEADER_PREFIXES.some((prefix) => trimmed.startsWith(prefix))) {
    return null;
  }

  // TIME UID PID — first three whitespace-separated fields
  const headerMatch = trimmed.match(/^(\S+)\s+(\d+)\s+(\d+)\s+/);
  if (!headerMatch) {
    return null;
  }

  const [, timeStr, uidStr, pidStr] = headerMatch;
  const uid = parseInt(uidStr, 10);
  const threadPid = parseInt(pidStr, 10);

  if (Number.isNaN(uid) || Number.isNaN(threadPid)) {
    return null;
  }

  let rest = trimmed.slice(headerMatch[0].length);
  if (rest.length < 16) {
    return null;
  }

  const commRaw = rest.slice(0, 16);
  const comm = commRaw.trimEnd();
  rest = rest.slice(16).trimStart();

  const tailParts = rest.split(/\s+/);
  if (tailParts.length < 3) {
    return null;
  }

  const fd = parseInt(tailParts[0], 10);
  const err = tailParts[1];

  // With -e, field 3 is O_RDONLY|…; otherwise field 3 starts the path
  const hasFlags = tailParts.length >= 4 && /^O_[A-Z0-9_|]+$/.test(tailParts[2]);
  const flags = hasFlags ? tailParts[2] : '';
  const filePath = hasFlags ? tailParts.slice(3).join(' ') : tailParts.slice(2).join(' ');

  if (Number.isNaN(fd) || !filePath) {
    return null;
  }

  return {
    timeStr,
    uid,
    threadPid,
    comm,
    fd,
    err,
    flags,
    filePath,
  };
}

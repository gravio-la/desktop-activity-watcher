/**
 * Parse BCC opensnoop output with -T -U (default) or -T -U -e (FLAGS + MODE columns).
 *
 * Default:  TIME(s) UID PID COMM(16) FD ERR PATH
 * With -e:   TIME(s) UID PID COMM(16) FD ERR FLAGS MODE PATH
 *            FLAGS is octal (e.g. 02204000); MODE is octal or "n/a" (bcc 0.35+).
 *            Older builds may emit symbolic FLAGS (O_RDONLY|…) without MODE.
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

  const isSymbolicFlags = /^O_[A-Z0-9_|]+$/.test(tailParts[2] ?? '');
  const isNumericFlags = /^0[0-7]+$/.test(tailParts[2] ?? '');
  const isModeToken = (token: string) => token === 'n/a' || /^0[0-7]+$/.test(token);

  let flags = '';
  let filePath: string;

  if (isSymbolicFlags && tailParts.length >= 4) {
    flags = tailParts[2];
    filePath = tailParts.slice(3).join(' ');
  } else if (isNumericFlags && tailParts.length >= 5 && isModeToken(tailParts[3])) {
    flags = tailParts[2];
    filePath = tailParts.slice(4).join(' ');
  } else {
    filePath = tailParts.slice(2).join(' ');
  }

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

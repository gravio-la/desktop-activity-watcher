import { describe, expect, test } from 'bun:test';
import { parseOpensnoopLine } from './opensnoop-parser';

describe('parseOpensnoopLine', () => {
  test('parses line with spaced COMM and flags', () => {
    const line =
      '0.123456 1000 12345 Web Content     23 0 O_RDONLY /home/basti/daten/test.txt';
    const parsed = parseOpensnoopLine(line);

    expect(parsed).not.toBeNull();
    expect(parsed!.uid).toBe(1000);
    expect(parsed!.threadPid).toBe(12345);
    expect(parsed!.comm).toBe('Web Content');
    expect(parsed!.fd).toBe(23);
    expect(parsed!.err).toBe('0');
    expect(parsed!.flags).toBe('O_RDONLY');
    expect(parsed!.filePath).toBe('/home/basti/daten/test.txt');
  });

  test('parses short COMM padded to 16 chars', () => {
    const line = '1.0 1000 99 firefox         3 0 O_RDWR /home/basti/file';
    const parsed = parseOpensnoopLine(line);

    expect(parsed!.comm).toBe('firefox');
    expect(parsed!.flags).toBe('O_RDWR');
    expect(parsed!.filePath).toBe('/home/basti/file');
  });

  test('returns null for header lines', () => {
    expect(parseOpensnoopLine('TIME(s) UID PID COMM FD ERR FLAGS PATH')).toBeNull();
    expect(parseOpensnoopLine('---')).toBeNull();
    expect(parseOpensnoopLine('')).toBeNull();
  });

  test('returns null for malformed lines', () => {
    expect(parseOpensnoopLine('not valid')).toBeNull();
  });
});

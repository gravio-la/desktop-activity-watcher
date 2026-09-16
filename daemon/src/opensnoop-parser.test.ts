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

  test('parses -T -U line without FLAGS column (kernel 6.12+ safe)', () => {
    const line =
      '0.007656000   1000  800895 cursor             -1   2 /home/basti/daten/project/readme.md';
    const parsed = parseOpensnoopLine(line);

    expect(parsed).not.toBeNull();
    expect(parsed!.uid).toBe(1000);
    expect(parsed!.threadPid).toBe(800895);
    expect(parsed!.comm).toBe('cursor');
    expect(parsed!.fd).toBe(-1);
    expect(parsed!.err).toBe('2');
    expect(parsed!.flags).toBe('');
    expect(parsed!.filePath).toBe('/home/basti/daten/project/readme.md');
  });

  test('parses successful open (ERR=0) without flags', () => {
    const line =
      '0.009434000   1000  4162172 ThreadPoolForeg    36   0 /home/basti/daten/scores/symphony.pdf';
    const parsed = parseOpensnoopLine(line);

    expect(parsed!.err).toBe('0');
    expect(parsed!.flags).toBe('');
    expect(parsed!.filePath).toBe('/home/basti/daten/scores/symphony.pdf');
  });

  test('parses BCC 0.35 -e line with octal FLAGS and n/a MODE', () => {
    const line =
      '0.131974000   1000  3104554 KIO::WorkerThre    40   0 02204000 n/a  /home/basti/daten/project/readme.md';
    const parsed = parseOpensnoopLine(line);

    expect(parsed).not.toBeNull();
    expect(parsed!.comm).toBe('KIO::WorkerThre');
    expect(parsed!.flags).toBe('02204000');
    expect(parsed!.filePath).toBe('/home/basti/daten/project/readme.md');
  });

  test('parses BCC 0.35 -e line with octal FLAGS and MODE', () => {
    const line =
      '0.500000000   1000  12345 cursor             12   0 00000101 0644 /home/basti/new-file.txt';
    const parsed = parseOpensnoopLine(line);

    expect(parsed!.flags).toBe('00000101');
    expect(parsed!.filePath).toBe('/home/basti/new-file.txt');
  });

  test('returns null for header lines', () => {
    expect(parseOpensnoopLine('TIME(s) UID PID COMM FD ERR FLAGS MODE PATH')).toBeNull();
    expect(parseOpensnoopLine('TIME(s) UID PID COMM FD ERR FLAGS PATH')).toBeNull();
    expect(parseOpensnoopLine('TIME(s)       UID   PID    COMM               FD ERR PATH')).toBeNull();
    expect(parseOpensnoopLine('---')).toBeNull();
    expect(parseOpensnoopLine('')).toBeNull();
  });

  test('returns null for malformed lines', () => {
    expect(parseOpensnoopLine('not valid')).toBeNull();
  });
});

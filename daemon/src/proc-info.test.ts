import { describe, expect, test } from 'bun:test';
import { formatCmdline } from './proc-info';

describe('formatCmdline', () => {
  test('joins null-separated argv', () => {
    expect(formatCmdline('/usr/bin/firefox\0--new-window\0')).toBe(
      '/usr/bin/firefox --new-window',
    );
  });

  test('returns undefined for empty cmdline', () => {
    expect(formatCmdline('\0\0')).toBeUndefined();
    expect(formatCmdline('')).toBeUndefined();
  });

  test('handles single argv element', () => {
    expect(formatCmdline('/nix/store/abc-firefox/bin/firefox\0')).toBe(
      '/nix/store/abc-firefox/bin/firefox',
    );
  });
});

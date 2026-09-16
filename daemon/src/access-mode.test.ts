import { describe, expect, test } from 'bun:test';
import { accessModeFromFlags } from './access-mode';

describe('accessModeFromFlags', () => {
  test('maps O_RDONLY to read', () => {
    expect(accessModeFromFlags('O_RDONLY')).toBe('read');
  });

  test('maps O_WRONLY to write', () => {
    expect(accessModeFromFlags('O_WRONLY|O_CREAT')).toBe('write');
  });

  test('maps O_RDWR to readwrite', () => {
    expect(accessModeFromFlags('O_RDWR')).toBe('readwrite');
  });

  test('returns undefined for empty flags', () => {
    expect(accessModeFromFlags('')).toBeUndefined();
    expect(accessModeFromFlags(undefined)).toBeUndefined();
  });

  test('maps octal O_RDONLY (02204000) to read', () => {
    expect(accessModeFromFlags('02204000')).toBe('read');
  });

  test('maps octal O_WRONLY|O_CREAT (00000101) to write', () => {
    expect(accessModeFromFlags('00000101')).toBe('write');
  });

  test('maps octal O_RDWR (00000002) to readwrite', () => {
    expect(accessModeFromFlags('00000002')).toBe('readwrite');
  });
});

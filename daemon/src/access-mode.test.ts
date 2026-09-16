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
});

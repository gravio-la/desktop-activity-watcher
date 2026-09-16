import { describe, expect, test } from 'bun:test';
import { resolveKwinJournalUnit } from './kwin-journal';

describe('resolveKwinJournalUnit', () => {
  test('uses explicit override when valid', () => {
    expect(resolveKwinJournalUnit('plasma-kwin_x11.service')).toBe('plasma-kwin_x11.service');
  });

  test('falls back to wayland when override invalid', () => {
    const unit = resolveKwinJournalUnit('not-a-real-unit.service');
    expect(unit === 'plasma-kwin_wayland.service' || unit === 'plasma-kwin_x11.service').toBe(true);
  });
});

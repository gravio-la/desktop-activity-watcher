/**
 * Detect which systemd user unit carries KWin journal output.
 */

import { spawnSync } from 'child_process';

export const KWIN_JOURNAL_UNITS = [
  'plasma-kwin_wayland.service',
  'plasma-kwin_x11.service',
] as const;

export type KwinJournalUnit = (typeof KWIN_JOURNAL_UNITS)[number];

function isUnitActive(unit: string): boolean {
  const result = spawnSync('systemctl', ['--user', 'is-active', unit], {
    encoding: 'utf8',
  });
  return result.stdout.trim() === 'active';
}

/**
 * Resolve the KWin journal unit to tail.
 * Prefers an explicit override, then the first active known unit, then Wayland default.
 */
export function resolveKwinJournalUnit(override?: string): KwinJournalUnit {
  if (override && KWIN_JOURNAL_UNITS.includes(override as KwinJournalUnit)) {
    return override as KwinJournalUnit;
  }

  for (const unit of KWIN_JOURNAL_UNITS) {
    if (isUnitActive(unit)) {
      return unit;
    }
  }

  return 'plasma-kwin_wayland.service';
}

/**
 * Check whether the KWin window-tracker script is loaded.
 */

import { spawnSync } from 'child_process';
import { logger } from './logger';

const QDBUS_CANDIDATES = ['qdbus6', 'qdbus'];

function findQdbus(): string | null {
  for (const cmd of QDBUS_CANDIDATES) {
    const result = spawnSync('which', [cmd], { encoding: 'utf8' });
    if (result.status === 0 && result.stdout.trim()) {
      return cmd;
    }
  }
  return null;
}

/**
 * Warn if the window-tracker KWin script is not loaded.
 */
export function warnIfKwinScriptNotLoaded(): void {
  const qdbus = findQdbus();
  if (!qdbus) {
    logger.warn('⚠️  qdbus not found — cannot verify KWin window-tracker script');
    return;
  }

  const result = spawnSync(
    qdbus,
    ['org.kde.KWin', '/Scripting', 'isScriptLoaded', 'window-tracker'],
    { encoding: 'utf8' }
  );

  const loaded = result.stdout.trim().toLowerCase();
  if (loaded === 'true') {
    logger.info('✓ KWin window-tracker script is loaded');
    return;
  }

  logger.warn('⚠️  KWin window-tracker script is NOT loaded');
  logger.warn('   Enable in System Settings → Window Management → KWin Scripts');
  logger.warn('   Or set services.desktopAgent.kwinScript.autoEnable = true in Home Manager');
}

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import {
  expandConfigPath,
  getConfigSearchPaths,
  shouldMonitorFile,
  matchesPatterns,
  type Config,
} from './config-loader';

describe('expandConfigPath', () => {
  test('expands %h to HOME', () => {
    const home = process.env.HOME || '/home/test';
    expect(expandConfigPath('%h/.config/desktop-agent/config.json')).toBe(
      `${home}/.config/desktop-agent/config.json`
    );
  });
});

describe('getConfigSearchPaths', () => {
  const originalConfigPath = process.env.CONFIG_PATH;
  const originalDesktopConfig = process.env.DESKTOP_AGENT_CONFIG;

  afterEach(() => {
    if (originalConfigPath === undefined) delete process.env.CONFIG_PATH;
    else process.env.CONFIG_PATH = originalConfigPath;
    if (originalDesktopConfig === undefined) delete process.env.DESKTOP_AGENT_CONFIG;
    else process.env.DESKTOP_AGENT_CONFIG = originalDesktopConfig;
  });

  test('includes CONFIG_PATH and DESKTOP_AGENT_CONFIG', () => {
    process.env.CONFIG_PATH = '%h/.config/desktop-agent/config.json';
    process.env.DESKTOP_AGENT_CONFIG = '/etc/custom.json';

    const paths = getConfigSearchPaths();
    const home = process.env.HOME || '/home/test';

    expect(paths[0]).toContain(`${home}/.config/desktop-agent/config.json`);
    expect(paths).toContain('/etc/custom.json');
  });
});

describe('shouldMonitorFile', () => {
  const home = process.env.HOME || '/home/basti';

  const baseConfig: Config = {
    monitoring: {
      enabled: true,
      homeDirectory: '$HOME',
      fileFilters: {
        enabled: true,
        mode: 'include',
        patterns: [`${home}/daten/**`],
        excludePatterns: ['**/target/**'],
        minFileSize: 0,
        extensions: [],
      },
    },
  };

  test('includes paths under ~/daten', () => {
    expect(shouldMonitorFile(`${home}/daten/project/main.rs`, baseConfig)).toBe(true);
  });

  test('excludes paths outside include patterns', () => {
    expect(shouldMonitorFile(`${home}/.mozilla/firefox/profiles`, baseConfig)).toBe(false);
  });

  test('excludePatterns take precedence', () => {
    expect(shouldMonitorFile(`${home}/daten/foo/target/bar.o`, baseConfig)).toBe(false);
  });

  test('matchesPatterns with ** glob', () => {
    expect(matchesPatterns(`${home}/daten/a/b/c.txt`, [`${home}/daten/**`])).toBe(true);
    expect(matchesPatterns(`${home}/Downloads/x`, [`${home}/daten/**`])).toBe(false);
  });
});

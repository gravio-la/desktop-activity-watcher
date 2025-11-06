/**
 * Configuration Loader
 * 
 * Loads and validates configuration from JSON file
 */

import { z } from 'zod';
import { existsSync } from 'fs';
import { resolve, join } from 'path';

// Zod schema for configuration
const ConfigSchema = z.object({
  monitoring: z.object({
    enabled: z.boolean().default(true),
    homeDirectory: z.string().default('$HOME'),
    fileFilters: z.object({
      enabled: z.boolean().default(false),
      mode: z.enum(['include', 'exclude']).default('include'),
      patterns: z.array(z.string()).default([]),
      excludePatterns: z.array(z.string()).default([]),
      minFileSize: z.number().default(0),
      extensions: z.array(z.string()).default([]),
    }).optional(),
    processFilters: z.object({
      enabled: z.boolean().default(false),
      includeProcesses: z.array(z.string()).default([]),
      excludeProcesses: z.array(z.string()).default([]),
    }).optional(),
  }),
  correlation: z.object({
    enabled: z.boolean().default(true),
    correlateByPid: z.boolean().default(true),
  }).optional(),
  databases: z.object({
    influxdb: z.object({
      enabled: z.boolean().default(true),
      url: z.string().default('http://localhost:8086'),
      token: z.string().default('desktop-agent-token-123'),
      org: z.string().default('desktop-agent'),
      bucket: z.string().default('file-access'),
    }).optional(),
    timescaledb: z.object({
      enabled: z.boolean().default(true),
      connectionString: z.string().default('postgresql://desktopagent:desktopagent123@localhost:5432/desktop_agent'),
    }).optional(),
    redis: z.object({
      enabled: z.boolean().default(true),
      url: z.string().default('redis://localhost:6379'),
    }).optional(),
    jsonl: z.object({
      enabled: z.boolean().default(true),
      path: z.string().default('/tmp/desktop-agent-events.jsonl'),
    }).optional(),
  }).optional(),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    pretty: z.boolean().default(true),
  }).optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Load configuration from file
 */
export async function loadConfig(configPath?: string): Promise<Config> {
  // Default config path
  const defaultPaths = [
    process.env.DESKTOP_AGENT_CONFIG,
    join(process.cwd(), 'config.json'),
    join(process.cwd(), 'daemon', 'config.json'),
    '/etc/desktop-agent/config.json',
  ].filter(Boolean) as string[];

  const searchPaths = configPath ? [configPath, ...defaultPaths] : defaultPaths;

  // Find first existing config file
  let configFile: string | null = null;
  for (const path of searchPaths) {
    if (existsSync(path)) {
      configFile = resolve(path);
      break;
    }
  }

  if (!configFile) {
    console.warn('⚠️  No config file found, using defaults');
    return ConfigSchema.parse({
      monitoring: { enabled: true, homeDirectory: '$HOME' },
    });
  }

  try {
    const configData = await Bun.file(configFile).json();
    const config = ConfigSchema.parse(configData);
    
    console.log(`✅ Loaded config from: ${configFile}`);
    return config;
  } catch (error) {
    console.error(`❌ Failed to load config from ${configFile}:`, error);
    throw error;
  }
}

/**
 * Expand environment variables in string
 */
export function expandEnvVars(str: string): string {
  return str.replace(/\$\{?([A-Z_][A-Z0-9_]*)\}?/gi, (match, varName) => {
    return process.env[varName] || match;
  }).replace('~', process.env.HOME || '~');
}

/**
 * Convert glob pattern to regex
 */
export function globToRegex(pattern: string): RegExp {
  // Expand environment variables and home directory
  const expanded = expandEnvVars(pattern);
  
  // Escape special regex characters except * and ?
  let regexStr = expanded
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '___DOUBLESTAR___')
    .replace(/\*/g, '[^/]*')
    .replace(/___DOUBLESTAR___/g, '.*')
    .replace(/\?/g, '.');
  
  return new RegExp(`^${regexStr}$`);
}

/**
 * Check if path matches any pattern
 */
export function matchesPatterns(path: string, patterns: string[]): boolean {
  const expandedPath = expandEnvVars(path);
  
  return patterns.some(pattern => {
    const regex = globToRegex(pattern);
    return regex.test(expandedPath);
  });
}

/**
 * Check if file path should be monitored based on filters
 */
export function shouldMonitorFile(
  filePath: string,
  config: Config
): boolean {
  const filters = config.monitoring.fileFilters;
  
  if (!filters || !filters.enabled) {
    return true; // No filters, monitor everything
  }

  const expandedPath = expandEnvVars(filePath);

  // Check exclude patterns first (they take precedence)
  if (filters.excludePatterns && filters.excludePatterns.length > 0) {
    if (matchesPatterns(expandedPath, filters.excludePatterns)) {
      return false;
    }
  }

  // Check include patterns
  if (filters.mode === 'include' && filters.patterns && filters.patterns.length > 0) {
    return matchesPatterns(expandedPath, filters.patterns);
  }

  // Check extensions if specified
  if (filters.extensions && filters.extensions.length > 0) {
    const ext = filePath.split('.').pop()?.toLowerCase();
    if (ext && !filters.extensions.includes(`.${ext}`) && !filters.extensions.includes(ext)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if process should be monitored based on filters
 */
export function shouldMonitorProcess(
  processName: string,
  config: Config
): boolean {
  const filters = config.monitoring.processFilters;
  
  if (!filters || !filters.enabled) {
    return true; // No filters, monitor everything
  }

  // Check exclude list
  if (filters.excludeProcesses && filters.excludeProcesses.length > 0) {
    if (filters.excludeProcesses.includes(processName)) {
      return false;
    }
  }

  // Check include list
  if (filters.includeProcesses && filters.includeProcesses.length > 0) {
    return filters.includeProcesses.includes(processName);
  }

  return true;
}


/**
 * Window Tracker
 *
 * Monitors KWin journal output for window activation events
 */

import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { logger } from './logger';
import type { WindowEvent } from './types';
import { resolveKwinJournalUnit, type KwinJournalUnit } from './kwin-journal';

const HEALTH_CHECK_MS = 60_000;

export class WindowTracker extends EventEmitter {
  private process: ChildProcess | null = null;
  private running = false;
  private lastPid: number | null = null;
  private lastApp: string | null = null;
  private journalUnit: KwinJournalUnit;
  private linesReceived = 0;
  private healthTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(journalUnit?: string) {
    super();
    this.journalUnit = resolveKwinJournalUnit(journalUnit);
  }

  async start(): Promise<void> {
    if (this.running) {
      logger.warn('Window tracker already running');
      return;
    }

    this.running = true;
    this.linesReceived = 0;

    const realUser = process.env.SUDO_USER;
    const isRoot = process.getuid?.() === 0;

    const args = [
      '--user',
      '-u', this.journalUnit,
      '-f',
      '-o', 'cat',
      '-n', '0',
    ];

    if (isRoot && realUser) {
      logger.info(`Running journalctl as user: ${realUser}`);
      this.process = spawn('sudo', ['-u', realUser, 'journalctl', ...args]);
    } else {
      this.process = spawn('journalctl', args);
    }

    if (!this.process.stdout || !this.process.stderr) {
      throw new Error('Failed to capture process streams');
    }

    let buffer = '';
    this.process.stdout.on('data', (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        this.parseLine(line);
      }
    });

    this.process.stderr.on('data', (data: Buffer) => {
      logger.debug(`journalctl stderr: ${data.toString().trim()}`);
    });

    this.process.on('close', (code) => {
      if (this.running) {
        logger.error(`Window tracker process exited with code ${code}`);
        this.running = false;
      }
      this.clearHealthTimer();
    });

    this.process.on('error', (error) => {
      logger.error('Window tracker process error:', error);
      this.running = false;
      this.clearHealthTimer();
    });

    this.scheduleHealthCheck();
    logger.info(`✓ Window tracker started (journal unit: ${this.journalUnit})`);
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.clearHealthTimer();

    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    logger.info('✓ Window tracker stopped');
  }

  /** Exposed for unit tests. */
  parseLineForTest(line: string): WindowEvent | null {
    return this.parseLineInternal(line);
  }

  private parseLine(line: string): void {
    const event = this.parseLineInternal(line);
    if (event) {
      this.linesReceived++;
      this.emit('window-activated', event);
    }
  }

  private parseLineInternal(line: string): WindowEvent | null {
    // Match "Window Activity Tracker:" with optional "js: " journal prefix
    if (!/Window Activity Tracker:/.test(line)) {
      return null;
    }

    try {
      const jsonStart = line.indexOf('{');
      if (jsonStart === -1) return null;

      const jsonStr = line.substring(jsonStart);
      const raw = JSON.parse(jsonStr) as Record<string, unknown>;

      const pid = typeof raw.pid === 'number' ? raw.pid : -1;

      const event: WindowEvent = {
        type: 'window_activated',
        timestamp: String(raw.timestamp ?? new Date().toISOString()),
        windowTitle: String(raw.windowTitle ?? 'Unknown'),
        resourceClass: String(raw.resourceClass ?? 'Unknown'),
        resourceName: String(raw.resourceName ?? 'Unknown'),
        pid,
        windowId: Number(raw.windowId ?? 0),
        desktop: Number(raw.desktop ?? -1),
        screen: Number(raw.screen ?? 0),
        activities: Array.isArray(raw.activities) ? raw.activities.map(String) : [],
        geometry: (raw.geometry as WindowEvent['geometry']) ?? {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        },
      };

      if (event.pid !== this.lastPid || event.resourceClass !== this.lastApp) {
        logger.info(
          `🪟  Switched to: ${event.windowTitle} [${event.resourceClass}] (PID: ${event.pid})`
        );
        this.lastPid = event.pid;
        this.lastApp = event.resourceClass;
      }

      return event;
    } catch {
      logger.debug('Failed to parse window event:', line);
      return null;
    }
  }

  private scheduleHealthCheck(): void {
    this.clearHealthTimer();
    this.healthTimer = setTimeout(() => {
      if (this.running && this.linesReceived === 0) {
        logger.warn(
          `⚠️  No window events received in ${HEALTH_CHECK_MS / 1000}s from ${this.journalUnit}`
        );
        logger.warn('   Check: qdbus6 org.kde.KWin /Scripting isScriptLoaded window-tracker');
        logger.warn(
          `   Or: journalctl --user -f -u ${this.journalUnit} | grep 'Window Activity Tracker'`
        );
      }
    }, HEALTH_CHECK_MS);
  }

  private clearHealthTimer(): void {
    if (this.healthTimer) {
      clearTimeout(this.healthTimer);
      this.healthTimer = null;
    }
  }
}

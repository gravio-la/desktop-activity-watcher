/**
 * Window Tracker
 * 
 * Monitors KWin journal output for window activation events
 */

import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { logger } from './logger';
import type { WindowEvent } from './types';

export class WindowTracker extends EventEmitter {
  private process: ChildProcess | null = null;
  private running = false;
  private lastPid: number | null = null;
  private lastApp: string | null = null;

  async start(): Promise<void> {
    if (this.running) {
      logger.warn('Window tracker already running');
      return;
    }

    this.running = true;

    // If running as root via sudo, we need to run journalctl as the real user
    const realUser = process.env.SUDO_USER;
    const isRoot = process.getuid?.() === 0;
    
    const args = [
      '--user',
      '-u', 'plasma-kwin_wayland.service',
      '-f',
      '-o', 'cat',
      '-n', '0',
    ];

    // If we're root but there's a SUDO_USER, run journalctl as that user
    if (isRoot && realUser) {
      logger.info(`Running journalctl as user: ${realUser}`);
      this.process = spawn('sudo', ['-u', realUser, 'journalctl', ...args]);
    } else {
      this.process = spawn('journalctl', args);
    }

    if (!this.process.stdout || !this.process.stderr) {
      throw new Error('Failed to capture process streams');
    }

    // Parse output line by line
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
    });

    this.process.on('error', (error) => {
      logger.error('Window tracker process error:', error);
      this.running = false;
    });

    logger.info('✓ Window tracker started');
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;

    if (this.process) {
      this.process.kill();
      this.process = null;
    }

    logger.info('✓ Window tracker stopped');
  }

  private parseLine(line: string): void {
    // Look for our KWin script output
    if (!line.includes('Window Activity Tracker:')) {
      return;
    }

    try {
      // Extract JSON from the line
      const jsonStart = line.indexOf('{');
      if (jsonStart === -1) return;

      const jsonStr = line.substring(jsonStart);
      const event = JSON.parse(jsonStr) as WindowEvent;

      // Add type field
      event.type = 'window_activated';

      // Check if this is a new window/app
      if (event.pid !== this.lastPid || event.resourceClass !== this.lastApp) {
        // Log the switch
        logger.info(
          `🪟  Switched to: ${event.windowTitle} [${event.resourceClass}] (PID: ${event.pid})`
        );

        this.lastPid = event.pid;
        this.lastApp = event.resourceClass;
      }

      // Emit the event
      this.emit('window-activated', event);

    } catch (error) {
      logger.debug('Failed to parse window event:', line);
    }
  }
}


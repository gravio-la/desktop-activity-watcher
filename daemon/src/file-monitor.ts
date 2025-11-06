/**
 * File Monitor
 * 
 * Monitors file access in the home directory using opensnoop
 */

import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { logger } from './logger';
import type { FileEvent } from './types';

export class FileMonitor extends EventEmitter {
  private process: ChildProcess | null = null;
  private running = false;
  private homeDir: string;
  private eventCount = 0;
  private lastLog = Date.now();
  private opensnoopCmd: string = '';

  constructor(homeDir: string) {
    super();
    this.homeDir = homeDir;
  }

  async start(): Promise<void> {
    if (this.running) {
      logger.warn('File monitor already running');
      return;
    }

    // Check if opensnoop is available
    this.opensnoopCmd = await this.findOpensnoop() || '';
    if (!this.opensnoopCmd) {
      throw new Error(
        'opensnoop not found. Install with: nix-shell or sudo apt install bpfcc-tools'
      );
    }

    this.running = true;

    // Start opensnoop with useful flags
    // -T = timestamps
    // -U = include UID
    // Note: -F (full paths) causes crashes in BCC, so we skip it
    // Output format: TIME(s) UID PID COMM FD ERR PATH
    const args = ['-T', '-U'];

    logger.info(`Using opensnoop: ${this.opensnoopCmd}`);
    
    // Check if we're already root
    const isRoot = process.getuid?.() === 0;
    
    if (isRoot) {
      // Already root, just run it
      this.process = spawn(this.opensnoopCmd, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
    } else {
      // Not root, try to run with sudo
      logger.warn('Not running as root, attempting to use sudo for opensnoop');
      this.process = spawn('sudo', [this.opensnoopCmd, ...args], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
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
      const msg = data.toString().trim();
      if (msg) {
        // Log stderr output, but filter out noise
        if (msg.includes('Tracing') || msg.includes('PID')) {
          logger.debug(`opensnoop: ${msg}`);
        } else if (msg.includes('Possibly lost')) {
          // Lost samples warnings are normal under load, just debug log them
          logger.debug(`opensnoop: ${msg}`);
        } else if (msg.includes('error') || msg.includes('Error') || msg.includes('TypeError')) {
          logger.error(`opensnoop error: ${msg}`);
        } else if (msg.includes('Exception') || msg.includes('Traceback')) {
          // Suppress Python tracebacks to avoid log spam
          logger.debug(`opensnoop exception: ${msg}`);
        } else {
          logger.debug(`opensnoop: ${msg}`);
        }
      }
    });

    this.process.on('close', (code) => {
      if (this.running) {
        if (code === 0) {
          logger.info(`File monitor stopped cleanly`);
        } else if (code === 2) {
          logger.error(`File monitor exited with code 2 (likely argument or permission issue)`);
          logger.error(`This can happen if:`);
          logger.error(`  - eBPF is not enabled in your kernel`);
          logger.error(`  - Missing kernel debug symbols`);
          logger.error(`  - BCC tools not properly installed`);
          logger.error(`Try running manually to see error: sudo ${this.opensnoopCmd} -T -U`);
        } else {
          logger.error(`File monitor process exited with code ${code}`);
        }
        this.running = false;
      }
    });

    this.process.on('error', (error) => {
      logger.error('File monitor process error:', error);
      this.running = false;
    });

    logger.info('✓ File monitor started (filtering for home directory)');
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

    logger.info(`✓ File monitor stopped (captured ${this.eventCount} events)`);
  }

  private async findOpensnoop(): Promise<string | null> {
    const candidates = [
      'opensnoop',                      // Should work in Nix shell
      'opensnoop-bpfcc',                // Debian/Ubuntu name
      '/usr/share/bcc/tools/opensnoop', // BCC tools location
      '/usr/sbin/opensnoop',            // System location
    ];

    // Try which command first
    for (const cmd of candidates) {
      try {
        const result = await Bun.spawn(['which', cmd], {
          stdout: 'pipe',
          stderr: 'ignore',
        });
        const output = await new Response(result.stdout).text();
        if (output.trim()) {
          const path = output.trim();
          logger.debug(`Found opensnoop via 'which': ${path}`);
          return cmd;
        }
      } catch {
        continue;
      }
    }

    // If that fails, try to find in Nix store
    try {
      const result = await Bun.spawn(
        ['find', '/nix/store', '-name', 'opensnoop', '-type', 'f', '-executable'],
        {
          stdout: 'pipe',
          stderr: 'ignore',
        }
      );
      const output = await new Response(result.stdout).text();
      const paths = output.trim().split('\n').filter(p => p && p.includes('/bin/'));
      if (paths.length > 0) {
        const path = paths[0];
        logger.debug(`Found opensnoop in Nix store: ${path}`);
        return path;
      }
    } catch (error) {
      logger.debug('Failed to search Nix store:', error);
    }

    return null;
  }

  private parseLine(line: string): void {
    // Skip header lines
    if (line.startsWith('TIME') || line.startsWith('UID') || line.startsWith('---') || !line.trim()) {
      return;
    }

    try {
      // Parse opensnoop output with -T -U -F flags
      // Format: TIME(s) UID PID COMM FD ERR PATH
      const parts = line.trim().split(/\s+/);
      if (parts.length < 7) return;

      const timeStr = parts[0];
      const uid = parseInt(parts[1]);
      const pid = parseInt(parts[2]);
      const processName = parts[3];
      const fd = parseInt(parts[4]);
      const err = parts[5];
      const filePath = parts.slice(6).join(' ');
      
      // Use current timestamp (timeStr is relative seconds since start)
      const timestamp = new Date().toISOString();

      // Filter: only home directory
      if (!filePath.startsWith(this.homeDir)) {
        return;
      }

      // Skip errors
      if (err !== '0') {
        return;
      }

      // Skip some noisy files
      if (
        filePath.includes('/.cache/') ||
        filePath.includes('/.local/share/baloo/') ||
        filePath.includes('/socket')
      ) {
        return;
      }

      const event: FileEvent = {
        type: 'file_accessed',
        timestamp,
        operation: 'open',
        filePath,
        processName,
        pid,
        uid,
        fd,
        flags: undefined,
      };

      this.eventCount++;

      // Log rate limiting (every 2 seconds max)
      const now = Date.now();
      if (now - this.lastLog > 2000) {
        logger.info(
          `📂 File access: ${filePath} by ${processName} (PID: ${pid})`
        );
        this.lastLog = now;
      } else {
        logger.debug(
          `📂 File access: ${filePath} by ${processName} (PID: ${pid})`
        );
      }

      // Emit the event
      this.emit('file-accessed', event);

    } catch (error) {
      logger.debug('Failed to parse file event:', line);
    }
  }
}


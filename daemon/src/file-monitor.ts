/**
 * File Monitor
 *
 * Monitors file access in the home directory using opensnoop
 */

import { spawn, type ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { logger } from './logger';
import type { FileEvent } from './types';
import { parseOpensnoopLine } from './opensnoop-parser';
import { accessModeFromFlags } from './access-mode';
import { resolveProcessInfo, type ProcessResolveOptions } from './proc-info';

export class FileMonitor extends EventEmitter {
  private process: ChildProcess | null = null;
  private running = false;
  private homeDir: string;
  private processResolveOptions: ProcessResolveOptions;
  private eventCount = 0;
  private opensnoopCmd: string = '';

  constructor(homeDir: string, processResolveOptions: ProcessResolveOptions = {}) {
    super();
    this.homeDir = homeDir;
    this.processResolveOptions = processResolveOptions;
  }

  async start(): Promise<void> {
    if (this.running) {
      logger.warn('File monitor already running');
      return;
    }

    const customCmd = process.env.OPENSNOOP_CMD;

    if (customCmd) {
      this.opensnoopCmd = customCmd;
      logger.info(`Using custom opensnoop command: ${customCmd}`);
    } else {
      this.opensnoopCmd = (await this.findOpensnoop()) || '';
      if (!this.opensnoopCmd) {
        throw new Error(
          'opensnoop not found. Please ensure it is installed and in PATH, or set OPENSNOOP_CMD environment variable.'
        );
      }
    }

    this.running = true;

    // -T timestamps, -U UID. Omit -F (--full-path): that code path includes kernel-internal
    // headers (fs_struct.h, dcache.h) and fails when bcc only has uapi headers (common on NixOS
    // with pkgs.bcc). Basename in PATH is enough for our include filters under ~/daten/**.
    // Open flags need -e (not -F, which is full-path and breaks on NixOS bcc builds).
    const args = ['-T', '-U', '-e'];

    logger.info(`Using opensnoop: ${this.opensnoopCmd}`);

    const cmdParts = this.opensnoopCmd.split(' ');
    const cmd = cmdParts[0];
    const cmdArgs = cmdParts.slice(1);
    const fullArgs = [...cmdArgs, ...args];

    logger.info(`Spawning: ${cmd} ${fullArgs.join(' ')}`);

    this.process = spawn(cmd, fullArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

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
      const msg = data.toString().trim();
      if (msg) {
        if (msg.includes('Tracing') || msg.includes('PID')) {
          logger.debug(`opensnoop: ${msg}`);
        } else if (msg.includes('Possibly lost')) {
          logger.debug(`opensnoop: ${msg}`);
        } else if (msg.includes('error') || msg.includes('Error') || msg.includes('TypeError')) {
          logger.error(`opensnoop error: ${msg}`);
        } else if (msg.includes('Exception') || msg.includes('Traceback')) {
          logger.debug(`opensnoop exception: ${msg}`);
        } else {
          logger.debug(`opensnoop: ${msg}`);
        }
      }
    });

    this.process.on('close', (code) => {
      if (this.running) {
        if (code === 0) {
          logger.info('File monitor stopped cleanly');
        } else if (code === 2) {
          logger.error('File monitor exited with code 2 (likely argument or permission issue)');
          logger.error('Try running manually: sudo ' + this.opensnoopCmd + ' -T -U');
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

    logger.info('✓ File monitor started (home directory pre-filter only; path filters in correlator)');
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
      'opensnoop',
      'opensnoop-bpfcc',
      '/usr/share/bcc/tools/opensnoop',
      '/usr/sbin/opensnoop',
    ];

    for (const cmd of candidates) {
      try {
        const result = await Bun.spawn(['which', cmd], {
          stdout: 'pipe',
          stderr: 'ignore',
        });
        const output = await new Response(result.stdout).text();
        if (output.trim()) {
          logger.debug(`Found opensnoop via 'which': ${output.trim()}`);
          return cmd;
        }
      } catch {
        continue;
      }
    }

    try {
      const result = await Bun.spawn(
        ['find', '/nix/store', '-name', 'opensnoop', '-type', 'f', '-executable'],
        { stdout: 'pipe', stderr: 'ignore' }
      );
      const output = await new Response(result.stdout).text();
      const paths = output.trim().split('\n').filter((p) => p && p.includes('/bin/'));
      if (paths.length > 0) {
        logger.debug(`Found opensnoop in Nix store: ${paths[0]}`);
        return paths[0];
      }
    } catch (error) {
      logger.debug('Failed to search Nix store:', error);
    }

    return null;
  }

  /** Exposed for unit tests. */
  parseLineForTest(line: string): FileEvent | null {
    return this.parseLineInternal(line);
  }

  private parseLine(line: string): void {
    const event = this.parseLineInternal(line);
    if (event) {
      this.emit('file-accessed', event);
    }
  }

  private parseLineInternal(line: string): FileEvent | null {
    const parsed = parseOpensnoopLine(line);
    if (!parsed) {
      return null;
    }

    const { uid, threadPid, comm, fd, err, flags, filePath } = parsed;

    if (!filePath.startsWith(this.homeDir)) {
      return null;
    }

    if (err !== '0') {
      return null;
    }

    if (
      filePath.includes('/.cache/') ||
      filePath.includes('/.local/share/baloo/') ||
      filePath.includes('/socket')
    ) {
      return null;
    }

    const proc = resolveProcessInfo(threadPid, comm, this.processResolveOptions);

    const accessMode = accessModeFromFlags(flags);

    const event: FileEvent = {
      type: 'file_accessed',
      timestamp: new Date().toISOString(),
      operation: 'open',
      filePath,
      processName: proc.processName,
      processExecutablePath: proc.processExecutablePath,
      processCommandLine: proc.processCommandLine,
      pid: proc.tgid,
      threadPid,
      threadComm: proc.threadComm,
      uid,
      fd,
      flags,
      accessMode,
    };

    this.eventCount++;
    logger.debug(
      `📂 File access: ${filePath} by ${proc.processName}` +
        (proc.processExecutablePath ? ` (${proc.processExecutablePath})` : '') +
        ` (TGID: ${proc.tgid}, thread: ${threadPid})`
    );

    return event;
  }
}

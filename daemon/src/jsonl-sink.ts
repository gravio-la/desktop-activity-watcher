/**
 * Append-only JSONL event sink.
 */

import { appendFile, mkdir } from 'fs/promises';
import { dirname } from 'path';

export class JsonlSink {
  private readonly path: string;
  private ready = false;

  constructor(path: string) {
    this.path = path;
  }

  async open(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    this.ready = true;
  }

  async write(event: unknown): Promise<void> {
    if (!this.ready) {
      throw new Error('JsonlSink not opened');
    }
    await appendFile(this.path, JSON.stringify(event) + '\n', 'utf8');
  }

  async close(): Promise<void> {
    this.ready = false;
  }
}

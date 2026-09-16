import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { readFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { JsonlSink } from './jsonl-sink';

describe('JsonlSink', () => {
  let path: string;

  beforeEach(async () => {
    const dir = join(tmpdir(), `desktop-agent-test-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    path = join(dir, 'events.jsonl');
  });

  afterEach(async () => {
    try {
      await unlink(path);
    } catch {
      // ignore
    }
  });

  test('appends multiple lines without truncating', async () => {
    const sink = new JsonlSink(path);
    await sink.open();
    await sink.write({ type: 'file_accessed', n: 1 });
    await sink.write({ type: 'file_accessed', n: 2 });
    await sink.close();

    const content = await readFile(path, 'utf8');
    const lines = content.trim().split('\n');
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).n).toBe(1);
    expect(JSON.parse(lines[1]).n).toBe(2);
  });
});

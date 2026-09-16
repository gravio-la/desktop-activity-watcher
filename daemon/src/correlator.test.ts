import { describe, expect, test } from 'bun:test';
import { EventCorrelator } from './correlator';
import type { WindowEvent } from './types';

describe('EventCorrelator.handleWindowEvent', () => {
  test('persists window events even when pid is -1', async () => {
    const written: unknown[] = [];
    const correlator = new EventCorrelator(
      '/tmp/test-events.jsonl',
      {
        writeEvent: async (event) => {
          written.push(event);
        },
      } as never,
      false,
      {
        monitoring: { enabled: true, homeDirectory: '$HOME' },
      },
    );

    const event: WindowEvent = {
      type: 'window_activated',
      timestamp: new Date().toISOString(),
      windowTitle: 'Test',
      resourceClass: 'test',
      resourceName: 'test',
      pid: -1,
      windowId: 1,
      desktop: 1,
      screen: 0,
      activities: [],
      geometry: { x: 0, y: 0, width: 100, height: 100 },
    };

    correlator.handleWindowEvent(event);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(written.length).toBe(1);
    expect((written[0] as WindowEvent).type).toBe('window_activated');
    expect((written[0] as WindowEvent).pid).toBe(-1);
  });
});

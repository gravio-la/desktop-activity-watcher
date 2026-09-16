import { describe, expect, test } from 'bun:test';
import { WindowTracker } from './window-tracker';

describe('WindowTracker.parseLineForTest', () => {
  const tracker = new WindowTracker();

  const samplePayload = {
    event_type: 'window_activated',
    timestamp: '2025-11-06T13:45:25.234Z',
    windowTitle: 'Cursor',
    resourceClass: 'cursor',
    resourceName: 'cursor',
    pid: 6695,
    windowId: 123,
    desktop: 1,
    screen: 0,
    activities: ['activity-uuid-1'],
    geometry: { x: 0, y: 0, width: 1920, height: 1080 },
  };

  test('parses plain journal line', () => {
    const line = `Window Activity Tracker: ${JSON.stringify(samplePayload)}`;
    const event = tracker.parseLineForTest(line);
    expect(event?.windowTitle).toBe('Cursor');
    expect(event?.pid).toBe(6695);
    expect(event?.activities).toEqual(['activity-uuid-1']);
  });

  test('parses js-prefixed journal line', () => {
    const line = `js: Window Activity Tracker: ${JSON.stringify(samplePayload)}`;
    const event = tracker.parseLineForTest(line);
    expect(event?.resourceClass).toBe('cursor');
  });

  test('returns null for unrelated lines', () => {
    expect(tracker.parseLineForTest('some other kwin log line')).toBeNull();
  });

  test('returns event even when pid is -1', () => {
    const line = `Window Activity Tracker: ${JSON.stringify({ ...samplePayload, pid: -1 })}`;
    const event = tracker.parseLineForTest(line);
    expect(event?.pid).toBe(-1);
    expect(event?.windowTitle).toBe('Cursor');
  });
});

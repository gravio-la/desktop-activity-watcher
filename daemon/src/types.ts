/**
 * Type definitions for desktop agent events
 */

export interface WindowEvent {
  type: 'window_activated';
  timestamp: string;
  windowTitle: string;
  resourceClass: string;
  resourceName: string;
  pid: number;
  windowId: number;
  desktop: number;
  screen: number;
  activities: string[];
  geometry: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface FileEvent {
  type: 'file_accessed';
  timestamp: string;
  operation: 'open' | 'read' | 'write' | 'close';
  filePath: string;
  processName: string;
  pid: number;
  uid: number;
  fd?: number;
  flags?: string;
}

export interface CorrelatedEvent {
  timestamp: string;
  activeWindow?: {
    title: string;
    application: string;
    pid: number;
  };
  fileAccess?: {
    path: string;
    operation: string;
    process: string;
    pid: number;
  };
}


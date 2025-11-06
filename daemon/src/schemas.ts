/**
 * Zod schemas for desktop agent events
 * 
 * Type inference is used to derive TypeScript types from Zod schemas
 * This ensures validation and types are always in sync
 */

import { z } from 'zod';

// Base geometry schema for window positioning
export const GeometrySchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

// Window activation event
export const WindowEventSchema = z.object({
  type: z.literal('window_activated'),
  timestamp: z.string().datetime(),
  windowTitle: z.string(),
  resourceClass: z.string(),
  resourceName: z.string(),
  pid: z.number().int().nonnegative(),
  windowId: z.number().int(),
  desktop: z.number().int(),
  screen: z.number().int().nonnegative(),
  activities: z.array(z.string()),
  geometry: GeometrySchema,
});

// File access event
export const FileEventSchema = z.object({
  type: z.literal('file_accessed'),
  timestamp: z.string().datetime(),
  operation: z.enum(['open', 'read', 'write', 'close']),
  filePath: z.string(),
  processName: z.string(),
  pid: z.number().int().nonnegative(),
  uid: z.number().int().nonnegative(),
  fd: z.number().int().nonnegative().optional(),
  flags: z.string().optional(),
});

// Correlated event (window + file access)
export const CorrelatedEventSchema = z.object({
  type: z.literal('correlated'),
  timestamp: z.string().datetime(),
  activeWindow: z.object({
    title: z.string(),
    application: z.string(),
    pid: z.number().int().nonnegative(),
  }).optional(),
  fileAccess: z.object({
    path: z.string(),
    operation: z.string(),
    process: z.string(),
    pid: z.number().int().nonnegative(),
  }).optional(),
});

// Union type for all events
export const EventSchema = z.discriminatedUnion('type', [
  WindowEventSchema,
  FileEventSchema,
  CorrelatedEventSchema,
]);

// TypeScript types inferred from Zod schemas
export type Geometry = z.infer<typeof GeometrySchema>;
export type WindowEvent = z.infer<typeof WindowEventSchema>;
export type FileEvent = z.infer<typeof FileEventSchema>;
export type CorrelatedEvent = z.infer<typeof CorrelatedEventSchema>;
export type Event = z.infer<typeof EventSchema>;


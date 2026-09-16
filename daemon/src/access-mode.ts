/**
 * Derive coarse access mode from opensnoop open() flags.
 * Opensnoop traces open() only — not subsequent read/write syscalls.
 */

export type AccessMode = 'read' | 'write' | 'readwrite';

export function accessModeFromFlags(flags: string | undefined): AccessMode | undefined {
  if (!flags) {
    return undefined;
  }

  const hasWrite = flags.includes('O_WRONLY') || flags.includes('O_RDWR');
  const hasRead =
    flags.includes('O_RDONLY') || flags.includes('O_RDWR') || (!hasWrite && flags.length > 0);

  if (hasWrite && hasRead) {
    return 'readwrite';
  }
  if (hasWrite) {
    return 'write';
  }
  if (hasRead) {
    return 'read';
  }

  return undefined;
}

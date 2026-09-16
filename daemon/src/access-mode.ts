/**
 * Derive coarse access mode from opensnoop open() flags.
 * Opensnoop traces open() only — not subsequent read/write syscalls.
 */

export type AccessMode = 'read' | 'write' | 'readwrite';

/** Linux open(2) O_ACCMODE mask (fcntl.h). */
const O_ACCMODE = 3;
const O_RDONLY = 0;
const O_WRONLY = 1;
const O_RDWR = 2;

function accessModeFromNumericFlags(flags: string): AccessMode | undefined {
  const value = parseInt(flags, 8);
  if (Number.isNaN(value)) {
    return undefined;
  }

  switch (value & O_ACCMODE) {
    case O_RDONLY:
      return 'read';
    case O_WRONLY:
      return 'write';
    case O_RDWR:
      return 'readwrite';
    default:
      return undefined;
  }
}

function accessModeFromSymbolicFlags(flags: string): AccessMode | undefined {
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

export function accessModeFromFlags(flags: string | undefined): AccessMode | undefined {
  if (!flags) {
    return undefined;
  }

  if (/^0[0-7]+$/.test(flags)) {
    return accessModeFromNumericFlags(flags);
  }

  return accessModeFromSymbolicFlags(flags);
}

import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';

const HANDLE_REGEX = /^[a-z0-9._]{3,30}$/;

export function sanitizePrediktHandle(input: string | null | undefined) {
  if (input === null || input === undefined) return null;
  const trimmed = input.trim().replace(/^@+/, '').toLowerCase();
  return trimmed === '' ? null : trimmed;
}

export function validatePrediktHandle(handle: string | null) {
  if (handle === null) return;
  if (!HANDLE_REGEX.test(handle)) {
    throw new BadRequestException(
      'Prediktion handle must be 3-30 characters and use only lowercase letters, numbers, underscores, and dots.',
    );
  }
}

export function assertHandleAvailable(isTaken: boolean) {
  if (isTaken) {
    throw new ConflictException('Prediktion handle is already taken.');
  }
}

export function displayIdentity(user: {
  prediktHandle?: string | null;
  name?: string | null;
  email?: string | null;
}) {
  if (user.prediktHandle) return `@${user.prediktHandle}`;
  if (user.name) return user.name;
  if (user.email) return user.email.split('@')[0];
  return 'My Prediktion User';
}

export function buildHandleSuggestions(name: string, existingHandles: Set<string>) {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s._]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  const first = base[0] ?? 'predikt';
  const last = base[1] ?? '';
  const rawSuggestions = [
    first,
    last ? `${first}.${last}` : '',
    last ? `${first}_${last[0]}` : '',
    last ? `${first[0]}${last}` : '',
    `${first}${Math.floor(Math.random() * 90) + 10}`,
  ]
    .map((candidate) => sanitizePrediktHandle(candidate))
    .filter((candidate): candidate is string => !!candidate && HANDLE_REGEX.test(candidate));

  const unique = Array.from(new Set(rawSuggestions));
  return unique.slice(0, 5).map((handle) => ({
    handle,
    available: !existingHandles.has(handle),
  }));
}

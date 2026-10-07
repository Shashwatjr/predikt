import { UnauthorizedException } from '@nestjs/common';

/**
 * Product accounts use User.status, a string that defaults to "active".
 * Admin writes the other existing values: "disabled", "suspended", and "review".
 * Only "active" may authenticate. The check matches AdminAuthGuard (status !== 'active')
 * without naming the blocked status.
 */
export function assertActiveAccount(status: string | null | undefined, message: string) {
  if (status !== 'active') {
    throw new UnauthorizedException(message);
  }
}

type SessionRevoker = {
  userSession: {
    updateMany: (args: {
      where: { userId: string; revokedAt: null };
      data: { revokedAt: Date };
    }) => Promise<unknown>;
  };
};

/** Marks every still-open refresh session revoked. Same write logout and refresh rotation use. */
export async function revokeLiveUserSessions(prisma: SessionRevoker, userId: string) {
  if (!userId) return;
  await prisma.userSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function blocksLiveSessions(status: string | null | undefined) {
  return status === 'disabled' || status === 'suspended';
}

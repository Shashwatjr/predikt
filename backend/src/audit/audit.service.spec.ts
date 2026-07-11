import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('creates audit log records without throwing', async () => {
    const prisma = {
      auditLog: { create: jest.fn().mockResolvedValue({ auditLogId: 'a1' }) },
    } as any;

    const service = new AuditService(prisma);
    await service.log({
      actorType: 'system',
      action: 'test.audit',
      targetType: 'test',
      targetId: '1',
    });

    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});

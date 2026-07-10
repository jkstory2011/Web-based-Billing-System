import { ConflictException } from '@nestjs/common';
import { InvoiceIssueService } from './invoice-issue.service';

describe('InvoiceIssueService', () => {
  const draftInvoice = {
    id: 'invoice-1',
    status: 'DRAFT',
    totalAmount: { toString: () => '150000' },
    dueDate: new Date('2026-08-14'),
    lineItems: [],
    contract: { customer: { email: 'cust@example.com' } },
  };

  function buildService(overrides: any = {}) {
    const prisma = {
      invoice: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(draftInvoice),
        update: jest.fn().mockResolvedValue({ ...draftInvoice, status: 'SENT' }),
      },
      ...overrides,
    } as any;
    const pdfService = { render: jest.fn().mockResolvedValue(Buffer.from('pdf-bytes')) } as any;
    const pdfStorage = { save: jest.fn().mockResolvedValue({ id: 'pdf-1', invoiceId: 'invoice-1', version: 1 }) } as any;
    const mailer = { sendInvoice: jest.fn().mockResolvedValue(undefined) } as any;

    return { service: new InvoiceIssueService(prisma, pdfService, pdfStorage, mailer), prisma, pdfService, pdfStorage, mailer };
  }

  it('renders the PDF, stores it, emails the customer, and marks the invoice SENT', async () => {
    const { service, mailer, pdfStorage } = buildService();

    const result = await service.issueInvoice('invoice-1');

    expect(pdfStorage.save).toHaveBeenCalledWith('invoice-1', Buffer.from('pdf-bytes'));
    expect(mailer.sendInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ toEmail: 'cust@example.com', invoiceId: 'invoice-1', pdfFileName: 'invoice-invoice-1-v1.pdf' }),
    );
    expect(result.status).toBe('SENT');
  });

  it('throws ConflictException when the invoice was already sent', async () => {
    const { service, prisma, pdfService, pdfStorage, mailer } = buildService();
    prisma.invoice.findUniqueOrThrow.mockResolvedValue({ ...draftInvoice, status: 'SENT' });

    await expect(service.issueInvoice('invoice-1')).rejects.toThrow(ConflictException);

    expect(pdfService.render).not.toHaveBeenCalled();
    expect(pdfStorage.save).not.toHaveBeenCalled();
    expect(mailer.sendInvoice).not.toHaveBeenCalled();
  });
});

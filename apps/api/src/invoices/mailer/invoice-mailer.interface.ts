export interface SendInvoiceParams {
  toEmail: string;
  invoiceId: string;
  totalAmount: string;
  dueDate: Date;
  pdfBuffer: Buffer;
  pdfFileName: string;
}

export interface SendOverdueReminderParams {
  toEmail: string;
  invoiceId: string;
  totalAmount: string;
  dueDate: Date;
}

export interface InvoiceMailer {
  sendInvoice(params: SendInvoiceParams): Promise<void>;
  sendOverdueReminder(params: SendOverdueReminderParams): Promise<void>;
}

export const INVOICE_MAILER = Symbol('INVOICE_MAILER');

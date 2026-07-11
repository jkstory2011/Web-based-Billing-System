export interface SendInvoiceParams {
  toEmail: string;
  invoiceId: string;
  totalAmount: string;
  dueDate: Date;
  pdfBuffer: Buffer;
  pdfFileName: string;
}

export interface InvoiceMailer {
  sendInvoice(params: SendInvoiceParams): Promise<void>;
}

export const INVOICE_MAILER = Symbol('INVOICE_MAILER');

export type InvoiceStatus = 'DRAFT' | 'SENT';
export type LineItemSource = 'RECURRING' | 'ADHOC';

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: string;
  amount: string;
  source: LineItemSource;
}

export interface Invoice {
  id: string;
  contractId: string;
  periodStart: string;
  periodEnd: string;
  issueDate: string | null;
  dueDate: string;
  status: InvoiceStatus;
  totalAmount: string;
  lineItems: InvoiceLineItem[];
}

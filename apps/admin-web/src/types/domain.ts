export type CustomerType = 'INDIVIDUAL' | 'COMPANY';
export type ContractStatus = 'ACTIVE' | 'TERMINATED';
export type RecurringPeriod = 'MONTHLY' | 'QUARTERLY';
export type InvoiceStatus = 'DRAFT' | 'SENT';
export type LineItemSource = 'RECURRING' | 'ADHOC';
export type AdminRole = 'SALES' | 'ACCOUNTING' | 'ADMIN';

export interface Customer {
  id: string;
  type: CustomerType;
  name: string;
  businessRegNo: string | null;
  email: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractRecurringItem {
  id: string;
  contractId: string;
  description: string;
  period: RecurringPeriod;
  amount: string;
  startDate: string;
  endDate: string | null;
}

export interface AdhocCharge {
  id: string;
  contractId: string;
  description: string;
  amount: string;
  occurredOn: string;
  createdByAdminUserId: string;
}

export interface Contract {
  id: string;
  customerId: string;
  startDate: string;
  endDate: string | null;
  status: ContractStatus;
  recurringItems: ContractRecurringItem[];
  adhocCharges: AdhocCharge[];
}

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
  lineItems?: InvoiceLineItem[];
  contract?: { customer: Customer };
}

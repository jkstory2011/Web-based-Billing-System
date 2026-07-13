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
  collectionOwnerId: string | null;
  collectionOwner: AdminUserSummary | null;
  autoReminderOverride: boolean | null;
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

export interface ContractInvoicePreview {
  contractId: string;
  recurringItems: ContractRecurringItem[];
  adhocCharges: AdhocCharge[];
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export type ReminderStage = 'FIRST' | 'SECOND' | 'FINAL';
export type ReminderTrigger = 'MANUAL' | 'AUTO';

export interface AdminUserSummary {
  id: string;
  email: string;
  role: AdminRole;
}

export interface CollectionReminder {
  id: string;
  invoiceId: string;
  stage: ReminderStage;
  triggeredBy: ReminderTrigger;
  sentAt: string;
  sentByAdminUserId: string | null;
  sentByAdminUser: AdminUserSummary | null;
}

export interface CollectionNote {
  id: string;
  customerId: string;
  invoiceId: string | null;
  authorAdminUserId: string;
  authorAdminUser: AdminUserSummary;
  body: string;
  createdAt: string;
}

export interface SystemSettings {
  autoReminderEnabled: boolean;
}

export interface AgingBuckets {
  d0to30: string;
  d31to60: string;
  d61to90: string;
  d90plus: string;
}

export interface CustomerAgingSummary {
  customerId: string;
  customerName: string;
  buckets: AgingBuckets;
  totalOverdue: string;
  invoiceCount: number;
}

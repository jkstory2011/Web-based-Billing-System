import { AdhocCharge, ContractRecurringItem } from '@prisma/client';

export interface ContractInvoicePreview {
  contractId: string;
  recurringItems: ContractRecurringItem[];
  adhocCharges: AdhocCharge[];
}

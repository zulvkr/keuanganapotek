export type SourceModule =
  | "GENERAL"
  | "OPENING_BALANCE"
  | "POS_CLEARING"
  | "PBF_INVOICE"
  | "CONSIGNMENT"
  | "CASH_BANK";

export type PaymentTerms = "TUNAI" | "TEMPO_14" | "TEMPO_30" | "TEMPO_45" | "TEMPO_60";
export type TransactionType = "DEPOSIT" | "BANK_TRANSFER" | "EXPENSE" | "OTHER";

export type HealthResponse = {
  status: "ok";
  service: "api";
  timestamp: string;
};

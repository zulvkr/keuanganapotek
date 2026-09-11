export type SourceModule =
  | "GENERAL"
  | "POS_CLEARING"
  | "PBF_INVOICE"
  | "CONSIGNMENT"
  | "CASH_BANK";

export type HealthResponse = {
  status: "ok";
  service: "api";
  timestamp: string;
};

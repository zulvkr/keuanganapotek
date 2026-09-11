export type StressJournal = { id: string; journalNo: string; entryDate: string; sourceModule: string; debit: number; credit: number };
export type StressInvoice = { id: string; invoiceNumber: string; pbfName: string; dppAmount: number; ppnAmount: number; totalAmount: number };

export function generateStressJournals(count = 5_000): StressJournal[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `stress-journal-${index + 1}`, journalNo: `JU-STRESS-${String(index + 1).padStart(5, "0")}`,
    entryDate: `2026-${String((index % 12) + 1).padStart(2, "0")}-${String((index % 28) + 1).padStart(2, "0")}`,
    sourceModule: index % 2 ? "POS_CLEARING" : "GENERAL", debit: 100_000 + index, credit: 100_000 + index,
  }));
}

export function generateStressInvoices(count = 2_000): StressInvoice[] {
  return Array.from({ length: count }, (_, index) => {
    const dppAmount = 250_000 + index;
    const ppnAmount = Math.round(dppAmount * 0.11);
    return { id: `stress-invoice-${index + 1}`, invoiceNumber: `INV-STRESS-${String(index + 1).padStart(5, "0")}`, pbfName: index % 2 ? "Kimia Farma" : "PBF Nusantara", dppAmount, ppnAmount, totalAmount: dppAmount + ppnAmount };
  });
}

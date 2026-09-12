import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createApiApp } from "../app.js";
import { createSqliteClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedAccounts } from "../db/seed.js";
import {
  consignmentItems,
  journalLines,
  journals,
  pbfInvoices,
  posClearings,
} from "../db/schema/index.js";

const clients: Array<ReturnType<typeof createSqliteClient>> = [];
afterEach(() => {
  for (const client of clients.splice(0)) client.sqlite.close();
});
function setup() {
  const client = createSqliteClient(":memory:");
  clients.push(client);
  runMigrations(client.sqlite);
  seedAccounts(client);
  return { client, api: createApiApp(client) };
}
const json = { "content-type": "application/json" };

describe("Phase 3 operational transaction modules", () => {
  it("generates POS clearing and records a negative physical cash difference in 6106", async () => {
    const { api, client } = setup();
    const created = await api.request("http://localhost/api/pos-clearings", {
      method: "POST",
      headers: json,
      body: JSON.stringify({
        clearingDate: "2026-09-10",
        totalPosOmzet: "100.000",
        cashReceived: "95.000",
        nonCashReceived: "0",
        cogsAmount: "20.000",
      }),
    });
    expect(created.status).toBe(201);
    const id = ((await created.json()) as { data: { clearing: { id: string } } }).data.clearing.id;
    const generated = await api.request(
      `http://localhost/api/pos-clearings/${id}/generate-journal`,
      { method: "POST" },
    );
    expect(generated.status).toBe(200);
    const journal = client.db
      .select()
      .from(journals)
      .where(eq(journals.sourceModule, "POS_CLEARING"))
      .get()!;
    const lines = client.db
      .select()
      .from(journalLines)
      .where(eq(journalLines.journalId, journal.id))
      .all();
    expect(lines.reduce((sum, line) => sum + line.debit, 0)).toBe(
      lines.reduce((sum, line) => sum + line.credit, 0),
    );
    expect(lines.find((line) => line.accountId === "coa-6106")?.debit).toBe(500_000);
    expect(client.db.select().from(posClearings).get()?.status).toBe("POSTED");
  });

  it("posts POS receipts to the configured cash accounts", async () => {
    const { api, client } = setup();
    const created = await api.request("http://localhost/api/pos-clearings", {
      method: "POST",
      headers: json,
      body: JSON.stringify({
        clearingDate: "2026-09-10",
        totalPosOmzet: "100.000",
        cashReceived: "60.000",
        nonCashReceived: "40.000",
        cogsAmount: "0",
        cashAccountId: "coa-1102",
        nonCashAccountId: "coa-1111",
      }),
    });
    expect(created.status).toBe(201);
    const id = ((await created.json()) as { data: { clearing: { id: string } } }).data.clearing.id;
    expect(
      (
        await api.request(`http://localhost/api/pos-clearings/${id}/generate-journal`, {
          method: "POST",
        })
      ).status,
    ).toBe(200);
    const journal = client.db
      .select()
      .from(journals)
      .where(eq(journals.sourceModule, "POS_CLEARING"))
      .get()!;
    const lines = client.db
      .select()
      .from(journalLines)
      .where(eq(journalLines.journalId, journal.id))
      .all();
    expect(lines.find((line) => line.accountId === "coa-1102")?.debit).toBe(6_000_000);
    expect(lines.find((line) => line.accountId === "coa-1111")?.debit).toBe(4_000_000);
  });

  it("supports a dynamic marketplace receivable payment method", async () => {
    const { api, client } = setup();
    const methodResponse = await api.request("http://localhost/api/pos-payment-methods", {
      method: "POST",
      headers: json,
      body: JSON.stringify({
        name: "Marketplace",
        accountId: "coa-1201",
        isCash: false,
        isActive: true,
        sortOrder: 30,
      }),
    });
    expect(methodResponse.status).toBe(200);
    const marketplaceId = ((await methodResponse.json()) as { data: { id: string } }).data.id;
    const methods = await api.request("http://localhost/api/pos-payment-methods");
    const cashId = (
      (await methods.json()) as { data: Array<{ id: string; code: string }> }
    ).data.find((method) => method.code === "TUNAI")!.id;
    const created = await api.request("http://localhost/api/pos-clearings", {
      method: "POST",
      headers: json,
      body: JSON.stringify({
        clearingDate: "2026-09-10",
        totalPosOmzet: "100.000",
        cogsAmount: "0",
        payments: [
          { paymentMethodId: cashId, amount: "60.000" },
          { paymentMethodId: marketplaceId, amount: "40.000" },
        ],
      }),
    });
    expect(created.status).toBe(201);
    const id = ((await created.json()) as { data: { clearing: { id: string } } }).data.clearing.id;
    expect(
      (
        await api.request(`http://localhost/api/pos-clearings/${id}/generate-journal`, {
          method: "POST",
        })
      ).status,
    ).toBe(200);
    const journal = client.db
      .select()
      .from(journals)
      .where(eq(journals.sourceModule, "POS_CLEARING"))
      .get()!;
    const lines = client.db
      .select()
      .from(journalLines)
      .where(eq(journalLines.journalId, journal.id))
      .all();
    expect(lines.find((line) => line.accountId === "coa-1201")?.debit).toBe(4_000_000);
  });

  it("calculates 11% PPN, posts the PBF journal, and rejects duplicate supplier invoice numbers", async () => {
    const { api, client } = setup();
    const body = {
      invoiceDate: "2026-09-10",
      dueDate: "2026-10-10",
      pbfName: "Enseval",
      invoiceNumber: "INV-001",
      dppAmount: "100.000",
      paymentTerms: "TEMPO_30",
    };
    const created = await api.request("http://localhost/api/pbf-invoices", {
      method: "POST",
      headers: json,
      body: JSON.stringify(body),
    });
    expect(created.status).toBe(201);
    const invoice = client.db.select().from(pbfInvoices).get()!;
    expect(invoice.ppnAmount).toBe(1_100_000);
    expect(invoice.totalAmount).toBe(11_100_000);
    expect(
      (
        await api.request("http://localhost/api/pbf-invoices", {
          method: "POST",
          headers: json,
          body: JSON.stringify(body),
        })
      ).status,
    ).toBe(400);
  });

  it("settles multiple consignment items and marks them PAID with a cash journal", async () => {
    const { api, client } = setup();
    const vendor = await api.request("http://localhost/api/consignment/vendors", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ vendorName: "Vendor Madu" }),
    });
    const vendorId = ((await vendor.json()) as { data: { id: string } }).data.id;
    const itemIds: string[] = [];
    for (const product of ["Madu A", "Herbal B"]) {
      const response = await api.request("http://localhost/api/consignment/items", {
        method: "POST",
        headers: json,
        body: JSON.stringify({
          vendorId,
          productName: product,
          qtySold: 2,
          agreedCostPrice: "25.000",
        }),
      });
      itemIds.push(((await response.json()) as { data: { id: string } }).data.id);
    }
    const settled = await api.request("http://localhost/api/consignment/settlements", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ itemIds, settlementDate: "2026-09-10", paymentAccountId: "coa-1101" }),
    });
    expect(settled.status).toBe(201);
    expect(
      client.db
        .select()
        .from(consignmentItems)
        .all()
        .every((item) => item.status === "PAID"),
    ).toBe(true);
    expect(
      client.db.select().from(journals).where(eq(journals.sourceModule, "CONSIGNMENT")).all(),
    ).toHaveLength(1);
  });

  it("posts a cash-bank transfer with a separate bank-admin debit", async () => {
    const { api, client } = setup();
    const response = await api.request("http://localhost/api/cash-bank/transfers", {
      method: "POST",
      headers: json,
      body: JSON.stringify({
        transactionTime: "2026-09-10T09:00",
        transactionType: "DEPOSIT",
        sourceAccountId: "coa-1101",
        targetAccountId: "coa-1111",
        netAmount: "100.000",
        adminFee: "2.500",
      }),
    });
    expect(response.status).toBe(201);
    const journal = client.db
      .select()
      .from(journals)
      .where(eq(journals.sourceModule, "CASH_BANK"))
      .get()!;
    const lines = client.db
      .select()
      .from(journalLines)
      .where(eq(journalLines.journalId, journal.id))
      .all();
    expect(lines.find((line) => line.accountId === "coa-6201")?.debit).toBe(250_000);
    expect(lines.reduce((sum, line) => sum + line.debit, 0)).toBe(
      lines.reduce((sum, line) => sum + line.credit, 0),
    );
  });
});

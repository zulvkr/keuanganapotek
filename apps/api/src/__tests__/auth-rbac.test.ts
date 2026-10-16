import { afterEach, describe, expect, it } from "vitest";
import { createApiApp } from "../app.js";
import { createSqliteClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import {
  seedAccounts,
  seedOpeningBalances,
  seedSampleTransactions,
  seedTransactionTypes,
  seedUsers,
} from "../db/seed.js";
import { createToken, listUsers } from "../services/auth.service.js";

const clients: Array<ReturnType<typeof createSqliteClient>> = [];

afterEach(() => {
  for (const client of clients.splice(0)) client.sqlite.close();
});

async function setup() {
  const client = createSqliteClient(":memory:");
  clients.push(client);
  runMigrations(client.sqlite);
  seedAccounts(client);
  await seedOpeningBalances(client);
  seedTransactionTypes(client);
  seedSampleTransactions(client);
  const { admin, asisten } = seedUsers(client);
  const api = createApiApp(client);
  return { client, api, admin, asisten };
}

describe("Authentication & RBAC with CoA-level Access Control", () => {
  it("seeds admin and asisten users properly", async () => {
    const { client, admin, asisten } = await setup();

    expect(admin.role).toBe("admin");
    expect(admin.username).toBe("admin");

    expect(asisten.role).toBe("asisten");
    expect(asisten.username).toBe("asisten");
    expect(asisten.allowedCoaCodes).toContain("1102"); // Tunai Kasir
    expect(asisten.allowedCoaCodes).toContain("4101"); // Omset
    expect(asisten.allowedCoaCodes).not.toContain("6102"); // Beban Gaji (Sensitif)
    expect(asisten.allowedCoaCodes).not.toContain("1108"); // Saving Gaji (Sensitif)

    const allUsers = listUsers(client.db);
    expect(allUsers.length).toBeGreaterThanOrEqual(2);
  });

  it("handles initial setup wizard when no users exist", async () => {
    const client = createSqliteClient(":memory:");
    clients.push(client);
    runMigrations(client.sqlite);
    seedAccounts(client);
    const api = createApiApp(client);

    // 1. Setup status when 0 users exist
    const statusBefore = await api.request("http://localhost/api/auth/setup-status");
    expect(statusBefore.status).toBe(200);
    const statusBeforeJson = await statusBefore.json();
    expect(statusBeforeJson.data.isSetupRequired).toBe(true);
    expect(statusBeforeJson.data.userCount).toBe(0);

    // 2. Perform initial setup
    const setupRes = await api.request("http://localhost/api/auth/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        pharmacyName: "Apotek Sehat Baru",
        admin: {
          name: "Apt. Jane Doe",
          username: "janedoe",
          password: "securepassword",
        },
        createAssistant: true,
        assistant: {
          name: "Kasir Sarah",
          username: "sarah",
          password: "assistantpassword",
        },
      }),
    });
    expect(setupRes.status).toBe(201);
    const setupJson = await setupRes.json();
    expect(setupJson.data.token).toBeDefined();
    expect(setupJson.data.user.username).toBe("janedoe");
    expect(setupJson.data.user.role).toBe("admin");

    // 3. Setup status now shows setup is completed
    const statusAfter = await api.request("http://localhost/api/auth/setup-status");
    expect(statusAfter.status).toBe(200);
    const statusAfterJson = await statusAfter.json();
    expect(statusAfterJson.data.isSetupRequired).toBe(false);
    expect(statusAfterJson.data.userCount).toBe(2);

    // 4. Repeated call to setup endpoint is blocked
    const repeatSetup = await api.request("http://localhost/api/auth/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        admin: {
          name: "Attacker",
          username: "attacker",
          password: "password123",
        },
      }),
    });
    expect(repeatSetup.status).toBe(409);

    // 5. Login with new credentials succeeds
    const loginRes = await api.request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "janedoe", password: "securepassword" }),
    });
    expect(loginRes.status).toBe(200);

    const asistenLogin = await api.request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "sarah", password: "assistantpassword" }),
    });
    expect(asistenLogin.status).toBe(200);
  });

  it("handles authentication login endpoint", async () => {
    const { api } = await setup();

    // 1. Invalid credentials
    const badLogin = await api.request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "wrongpassword" }),
    });
    expect(badLogin.status).toBe(400);

    // 2. Successful admin login
    const adminLogin = await api.request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" }),
    });
    expect(adminLogin.status).toBe(200);
    const adminData = await adminLogin.json();
    expect(adminData.data.token).toBeDefined();
    expect(adminData.data.user.role).toBe("admin");

    // 3. Successful asisten login
    const asistenLogin = await api.request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "asisten", password: "asisten123" }),
    });
    expect(asistenLogin.status).toBe(200);
    const asistenData = await asistenLogin.json();
    expect(asistenData.data.token).toBeDefined();
    expect(asistenData.data.user.role).toBe("asisten");
  });

  it("restricts asisten from seeing transactions with sensitive CoA (such as Gaji)", async () => {
    const { api, asisten } = await setup();
    const token = createToken({
      id: asisten.id,
      username: asisten.username,
      role: asisten.role,
    });

    // Request transactions as Asisten
    const asistenRes = await api.request("http://localhost/api/transactions", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(asistenRes.status).toBe(200);
    const asistenJson = await asistenRes.json();
    const asistenTransactions = asistenJson.data;

    // Verify NO transaction has debit or credit account of 6102 (Beban Gaji) or 1108 (Saving Gaji)
    for (const tx of asistenTransactions) {
      expect(tx.debitAccountCode).not.toBe("6102");
      expect(tx.creditAccountCode).not.toBe("6102");
      expect(tx.debitAccountCode).not.toBe("1108");
      expect(tx.creditAccountCode).not.toBe("1108");
    }

    // Verify non-sensitive operational transactions ARE present
    expect(asistenTransactions.some((tx: any) => tx.debitAccountCode === "1102")).toBe(true); // Penjualan kasir
    expect(asistenTransactions.some((tx: any) => tx.debitAccountCode === "6103")).toBe(true); // Listrik

    // Request transactions as Admin
    const adminRes = await api.request("http://localhost/api/transactions", {
      headers: { "x-user-role": "admin" },
    });
    expect(adminRes.status).toBe(200);
    const adminJson = await adminRes.json();
    const adminTransactions = adminJson.data;

    // Admin DOES see saving gaji transaction (TRX-19)
    const hasSalaryTx = adminTransactions.some(
      (tx: any) => tx.debitAccountCode === "1108" || tx.creditAccountCode === "1108",
    );
    expect(hasSalaryTx).toBe(true);

    // Asisten sees strictly fewer transactions than Admin
    expect(asistenTransactions.length).toBeLessThan(adminTransactions.length);
  });

  it("restricts asisten from seeing sensitive accounts in transactions summary", async () => {
    const { api, asisten } = await setup();
    const token = createToken({
      id: asisten.id,
      username: asisten.username,
      role: asisten.role,
    });

    // Request summary as Asisten
    const asistenRes = await api.request("http://localhost/api/transactions/summary", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const asistenJson = await asistenRes.json();
    const asistenAccounts = asistenJson.data.accounts;

    // Account 1108 (Saving Gaji) must NOT be present in asisten summary
    expect(asistenAccounts.some((acc: any) => acc.code === "1108")).toBe(false);
    expect(asistenAccounts.some((acc: any) => acc.code === "1102")).toBe(true); // Tunai Kasir is present

    // Admin DOES see 1108 Saving Gaji
    const adminRes = await api.request("http://localhost/api/transactions/summary", {
      headers: { "x-user-role": "admin" },
    });
    const adminJson = await adminRes.json();
    expect(adminJson.data.accounts.some((acc: any) => acc.code === "1108")).toBe(true);
  });

  it("filters transaction types for asisten to exclude sensitive accounts", async () => {
    const { api, asisten } = await setup();
    const token = createToken({
      id: asisten.id,
      username: asisten.username,
      role: asisten.role,
    });

    const res = await api.request("http://localhost/api/transaction-types", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    const types = json.data;

    // None of the types should be for Gaji (TRX-19, TRX-21, TRX-23, TRX-24)
    const gajiTypeCodes = ["TRX-19", "TRX-21", "TRX-23", "TRX-24"];
    for (const code of gajiTypeCodes) {
      expect(types.some((t: any) => t.code === code)).toBe(false);
    }

    // Operational sales types are present
    expect(types.some((t: any) => t.code === "TRX-01")).toBe(true);
  });

  it("rejects asisten attempting to create transactions with sensitive CoA", async () => {
    const { api, asisten } = await setup();
    const token = createToken({
      id: asisten.id,
      username: asisten.username,
      role: asisten.role,
    });

    // Find TRX-23 (Pembayaran Gaji via Bank Jago)
    const salaryType = (await api.request("http://localhost/api/transaction-types")).json();
    const allTypes = (await salaryType).data;
    const trx23 = allTypes.find((t: any) => t.code === "TRX-23");
    expect(trx23).toBeDefined();

    // Asisten tries to post a transaction with TRX-23
    const forbiddenPost = await api.request("http://localhost/api/transactions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        transactionDate: "2026-08-25",
        transactionTypeId: trx23.id,
        amount: "5000000",
        memo: "Percobaan input gaji oleh asisten",
      }),
    });

    expect(forbiddenPost.status).toBe(403);
    const errJson = await forbiddenPost.json();
    expect(errJson.error).toMatch(/akses ditolak/i);
  });

  it("blocks asisten from accessing financial reports and general journal", async () => {
    const { api, asisten } = await setup();
    const token = createToken({
      id: asisten.id,
      username: asisten.username,
      role: asisten.role,
    });

    const reportRes = await api.request(
      "http://localhost/api/reports/income-statement?startDate=2026-08-01&endDate=2026-08-31",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    expect(reportRes.status).toBe(403);

    const journalRes = await api.request("http://localhost/api/journals", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(journalRes.status).toBe(403);
  });
});

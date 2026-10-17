import { afterEach, describe, expect, it } from "vitest";
import { createApiApp } from "../app.js";
import { createSqliteClient } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedAccounts, seedTransactionTypes, seedUsers } from "../db/seed.js";
import { generateApiKey, revokeApiKey, verifyApiKey } from "../services/api-key.service.js";

const clients: Array<ReturnType<typeof createSqliteClient>> = [];

afterEach(() => {
  for (const client of clients.splice(0)) client.sqlite.close();
});

describe("API Key Management, Authentication & Documentation", () => {
  function setupTestApp() {
    const client = createSqliteClient(":memory:");
    clients.push(client);
    runMigrations(client.sqlite);
    seedAccounts(client);
    seedTransactionTypes(client);
    const users = seedUsers(client);
    const app = createApiApp(client);
    return { client, app, users };
  }

  it("generates, lists, verifies, and revokes API keys correctly", () => {
    const { client, users } = setupTestApp();

    const created = generateApiKey(client.db, {
      userId: users.admin.id,
      name: "Kasir Test Key",
    });

    expect(created.key).toMatch(/^ka_live_[a-f0-9]{48}$/);
    expect(created.keyPrefix).toMatch(/^ka_live_[a-f0-9]{4}\.\.\.[a-f0-9]{4}$/);
    expect(created.name).toBe("Kasir Test Key");
    expect(created.isActive).toBe(true);

    // Verify key
    const verifiedUser = verifyApiKey(client.db, created.key);
    expect(verifiedUser).toBeDefined();
    expect(verifiedUser?.role).toBe("admin");

    // Invalid key should return null
    expect(
      verifyApiKey(client.db, "ka_live_000000000000000000000000000000000000000000000000"),
    ).toBeNull();

    // Revoke key
    revokeApiKey(client.db, created.id);
    expect(verifyApiKey(client.db, created.key)).toBeNull();
  });

  it("authenticates requests using X-API-Key and Authorization Bearer ka_live_", async () => {
    const { client, app, users } = setupTestApp();

    const apiKey = generateApiKey(client.db, {
      userId: users.admin.id,
      name: "Admin Integration Key",
    });

    // Request via X-API-Key
    const resXApiKey = await app.request("/api/auth/me", {
      headers: { "X-API-Key": apiKey.key },
    });
    expect(resXApiKey.status).toBe(200);
    const jsonX = (await resXApiKey.json()) as { data: { user: { role: string } } };
    expect(jsonX.data.user.role).toBe("admin");

    // Request via Authorization: Bearer ka_live_...
    const resBearer = await app.request("/api/auth/me", {
      headers: { Authorization: `Bearer ${apiKey.key}` },
    });
    expect(resBearer.status).toBe(200);
    const jsonBearer = (await resBearer.json()) as { data: { user: { role: string } } };
    expect(jsonBearer.data.user.role).toBe("admin");
  });

  it("rejects invalid or revoked API keys with 401 Unauthorized", async () => {
    const { client, app, users } = setupTestApp();

    // Invalid X-API-Key
    const resInvalid = await app.request("/api/accounts/tree", {
      headers: { "X-API-Key": "ka_live_invalidkey123456789012345678901234567890" },
    });
    expect(resInvalid.status).toBe(401);
    const jsonInvalid = (await resInvalid.json()) as { error: string };
    expect(jsonInvalid.error).toContain("API Key tidak valid");

    // Invalid Bearer key
    const resInvalidBearer = await app.request("/api/accounts/tree", {
      headers: { Authorization: "Bearer ka_live_wrongkey123" },
    });
    expect(resInvalidBearer.status).toBe(401);

    // Create and revoke key
    const key = generateApiKey(client.db, {
      userId: users.admin.id,
      name: "Revoked Key",
    });
    revokeApiKey(client.db, key.id);

    const resRevoked = await app.request("/api/accounts/tree", {
      headers: { "X-API-Key": key.key },
    });
    expect(resRevoked.status).toBe(401);
  });

  it("enforces RBAC through API keys created for Asisten", async () => {
    const { client, app, users } = setupTestApp();

    // Create key for asisten user
    const asistenKey = generateApiKey(client.db, {
      userId: users.asisten.id,
      name: "Kasir POS Asisten",
    });

    // Asisten using API Key cannot access reports (403)
    const reportRes = await app.request(
      "/api/reports/income-statement?startDate=2026-10-01&endDate=2026-10-17",
      {
        headers: { "X-API-Key": asistenKey.key },
      },
    );
    expect(reportRes.status).toBe(403);

    // Asisten using API Key does NOT see sensitive accounts (6102 Beban Gaji, 1108 Saving Gaji)
    const coaRes = await app.request("/api/accounts/tree", {
      headers: { "X-API-Key": asistenKey.key },
    });
    expect(coaRes.status).toBe(200);
    const coaJson = (await coaRes.json()) as { data: Array<{ code: string }> };
    const codes = coaJson.data.map((a) => a.code);
    expect(codes).not.toContain("6102");
    expect(codes).not.toContain("1108");
    expect(codes).toContain("1101");
    expect(codes).toContain("4101");
  });

  it("supports API Key CRUD endpoints (/api/api-keys)", async () => {
    const { client, app, users } = setupTestApp();

    const adminKey = generateApiKey(client.db, {
      userId: users.admin.id,
      name: "Master Admin Key",
    });

    // 1. Create API Key via POST
    const createRes = await app.request("/api/api-keys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": adminKey.key,
      },
      body: JSON.stringify({
        name: "Agen AI External",
        expiresAt: "2027-12-31",
      }),
    });

    expect(createRes.status).toBe(201);
    const createJson = (await createRes.json()) as {
      data: { id: string; key: string; name: string };
    };
    expect(createJson.data.name).toBe("Agen AI External");
    expect(createJson.data.key).toMatch(/^ka_live_/);
    const newKeyId = createJson.data.id;
    const newRawKey = createJson.data.key;

    // Verify newly created key works immediately
    const checkRes = await app.request("/api/auth/me", {
      headers: { "X-API-Key": newRawKey },
    });
    expect(checkRes.status).toBe(200);

    // 2. List API Keys via GET
    const listRes = await app.request("/api/api-keys", {
      headers: { "X-API-Key": adminKey.key },
    });
    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as { data: Array<{ id: string; name: string }> };
    expect(listJson.data.some((k) => k.id === newKeyId)).toBe(true);

    // 3. Delete / Revoke API Key via DELETE
    const deleteRes = await app.request(`/api/api-keys/${newKeyId}`, {
      method: "DELETE",
      headers: { "X-API-Key": adminKey.key },
    });
    expect(deleteRes.status).toBe(204);

    // After deletion, the revoked key is 401
    const testDeleted = await app.request("/api/auth/me", {
      headers: { "X-API-Key": newRawKey },
    });
    expect(testDeleted.status).toBe(401);
  });

  it("serves OpenAPI 3.1.0 specifications and Swagger UI HTML", async () => {
    const { app } = setupTestApp();

    // 1. /openapi.json
    const openapiRes = await app.request("/openapi.json");
    expect(openapiRes.status).toBe(200);
    const spec = (await openapiRes.json()) as {
      openapi: string;
      info: { title: string };
      paths: Record<string, unknown>;
    };
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info.title).toContain("Keuangan Apotek");
    expect(spec.paths["/api-keys"]).toBeDefined();
    expect(spec.paths["/accounts/tree"]).toBeDefined();
    expect(spec.paths["/transactions"]).toBeDefined();

    // 2. /api/openapi.json
    const apiOpenapiRes = await app.request("/api/openapi.json");
    expect(apiOpenapiRes.status).toBe(200);

    // 3. /docs (Swagger UI)
    const docsRes = await app.request("/docs");
    expect(docsRes.status).toBe(200);
    const html = await docsRes.text();
    expect(html).toContain("SwaggerUIBundle");
    expect(html).toContain("Keuangan Apotek API Reference");

    // 4. /api/docs
    const apiDocsRes = await app.request("/api/docs");
    expect(apiDocsRes.status).toBe(200);
  });

  it("serves LLM documentation (llms.txt and llms-full.txt)", async () => {
    const { app } = setupTestApp();

    // 1. /llms.txt
    const llmsRes = await app.request("/llms.txt");
    expect(llmsRes.status).toBe(200);
    const text = await llmsRes.text();
    expect(text).toContain("# Keuangan Apotek API");
    expect(text).toContain("Double-Entry");
    expect(text).toContain("X-API-Key");

    // 2. /.well-known/llms.txt
    const wellKnownRes = await app.request("/.well-known/llms.txt");
    expect(wellKnownRes.status).toBe(200);

    // 3. /api/docs/llms.txt
    const apiLlmsRes = await app.request("/api/docs/llms.txt");
    expect(apiLlmsRes.status).toBe(200);

    // 4. /llms-full.txt
    const llmsFullRes = await app.request("/llms-full.txt");
    expect(llmsFullRes.status).toBe(200);
    const fullText = await llmsFullRes.text();
    expect(fullText).toContain("Taksonomi Bagan Akun");
    expect(fullText).toContain("1101");
    expect(fullText).toContain("6102");
  });
});

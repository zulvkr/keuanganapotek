export function getOpenApiSpec(baseUrl = ""): Record<string, unknown> {
  return {
    openapi: "3.1.0",
    info: {
      title: "Keuangan Apotek API",
      version: "1.0.0",
      description:
        "REST API & Accounting Engine untuk Praktik Apotek Mandiri (Keuangan Apotek). Dilengkapi sistem akuntansi berpasangan (Double-Entry), Bagan Akun (Chart of Accounts), transaksi kas/bank harian, pelaporan keuangan komprehensif (Neraca, Laba Rugi, Arus Kas), serta autentikasi berbasis RBAC dan API Key.",
      contact: {
        name: "Pengembang Keuangan Apotek",
      },
    },
    servers: [
      {
        url: baseUrl ? `${baseUrl}/api` : "/api",
        description: "API Base URL",
      },
    ],
    security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
          description: "API Key rahasia yang dibuat di halaman Pengaturan (format: ka_live_...)",
        },
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT atau API Key (ka_live_...)",
          description: "Gunakan token JWT sesi login atau API Key dengan awalan Bearer",
        },
      },
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Pesan kesalahan atau detail validasi",
            },
          },
          required: ["error"],
        },
        Account: {
          type: "object",
          properties: {
            id: { type: "string" },
            code: { type: "string", example: "1101" },
            name: { type: "string", example: "Kas Kasir Utama" },
            parentId: { type: "string", nullable: true },
            classification: {
              type: "string",
              enum: [
                "ASET_LANCAR",
                "ASET_TIDAK_LANCAR",
                "KEWAJIBAN_LANCAR",
                "KEWAJIBAN_JANGKA_PANJANG",
                "EKUITAS",
                "PENDAPATAN",
                "BEBAN_POKOK",
                "BEBAN_OPERASIONAL",
                "BEBAN_NON_OPERASIONAL",
              ],
            },
            normalBalance: { type: "string", enum: ["DEBIT", "KREDIT"] },
            level: { type: "integer", default: 1 },
            isGroup: { type: "boolean", default: false },
            isActive: { type: "boolean", default: true },
          },
          required: ["code", "name", "classification", "normalBalance"],
        },
        CreateApiKeyInput: {
          type: "object",
          properties: {
            name: { type: "string", example: "Integrasi POS Kasir / AI Assistant" },
            expiresAt: { type: "string", format: "date", nullable: true, example: "2027-12-31" },
          },
          required: ["name"],
        },
        ApiKeyItem: {
          type: "object",
          properties: {
            id: { type: "string" },
            userId: { type: "string" },
            userName: { type: "string" },
            userRole: { type: "string", enum: ["admin", "asisten"] },
            name: { type: "string" },
            keyPrefix: { type: "string", example: "ka_live_a1b2...9f8e" },
            scopes: { type: "array", items: { type: "string" } },
            isActive: { type: "boolean" },
            lastUsedAt: { type: "string", nullable: true },
            expiresAt: { type: "string", nullable: true },
            createdAt: { type: "string" },
            updatedAt: { type: "string" },
          },
          required: ["id", "userId", "name", "keyPrefix", "isActive", "createdAt"],
        },
        CreatedApiKeyResult: {
          allOf: [
            { $ref: "#/components/schemas/ApiKeyItem" },
            {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description: "Kunci API mentah lengkap. HANYA ditampilkan SEKALI saat pembuatan.",
                  example: "ka_live_4a8f9c12b7e510839218d6e321894bfa2910483c1894beef",
                },
              },
              required: ["key"],
            },
          ],
        },
        TransactionEntryInput: {
          type: "object",
          properties: {
            transactionDate: { type: "string", format: "date", example: "2026-10-17" },
            transactionTypeId: { type: "string", example: "type-sales-cash" },
            amount: { type: "number", example: 150000 },
            pic: { type: "string", maxLength: 10, example: "KASIR" },
            metadata: {
              type: "object",
              additionalProperties: true,
              example: { shift: "Pagi" },
            },
          },
          required: ["transactionDate", "transactionTypeId", "amount"],
        },
        JournalEntryInput: {
          type: "object",
          properties: {
            entryDate: { type: "string", format: "date", example: "2026-10-17" },
            referenceNo: { type: "string", example: "JU/2026/10/001" },
            memo: { type: "string", example: "Penyesuaian persediaan rusak" },
            lines: {
              type: "array",
              minItems: 2,
              items: {
                type: "object",
                properties: {
                  accountId: { type: "string" },
                  description: { type: "string" },
                  debit: { type: "number", default: 0 },
                  credit: { type: "number", default: 0 },
                },
                required: ["accountId"],
              },
            },
          },
          required: ["entryDate", "lines"],
        },
      },
    },
    paths: {
      "/health": {
        get: {
          summary: "Pemeriksaan Kesehatan Layanan",
          description: "Mengembalikan status operasional API server dan timestamp saat ini.",
          security: [],
          responses: {
            "200": {
              description: "Layanan aktif",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      status: { type: "string", example: "ok" },
                      service: { type: "string", example: "api" },
                      timestamp: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api-keys": {
        get: {
          summary: "Daftar API Key",
          description:
            "Melihat daftar API Key aktif. Admin dapat melihat semua key, Asisten hanya melihat miliknya.",
          tags: ["API Keys"],
          responses: {
            "200": {
              description: "Daftar API Key berhasil diambil",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: { $ref: "#/components/schemas/ApiKeyItem" },
                      },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
        post: {
          summary: "Buat API Key Baru",
          description:
            "Membuat API Key rahasia baru. Token mentah (`key`) hanya akan ditampilkan satu kali pada respons ini.",
          tags: ["API Keys"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateApiKeyInput" },
              },
            },
          },
          responses: {
            "201": {
              description: "API Key berhasil dibuat",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: { $ref: "#/components/schemas/CreatedApiKeyResult" },
                    },
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/api-keys/{id}": {
        delete: {
          summary: "Cabut (Revoke) API Key",
          description:
            "Menghapus / mencabut hak akses API Key tertentu sehingga tidak dapat digunakan lagi.",
          tags: ["API Keys"],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description: "ID API Key yang akan dicabut",
            },
          ],
          responses: {
            "204": { description: "API Key berhasil dicabut" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { $ref: "#/components/responses/NotFound" },
          },
        },
      },
      "/accounts/tree": {
        get: {
          summary: "Daftar Bagan Akun (Chart of Accounts)",
          description:
            "Mengambil seluruh struktur akun buku besar. Jika diakses dengan hak Asisten, akun sensitif (Beban Gaji 6102 & Saving Gaji 1108) otomatis disaring.",
          tags: ["Chart of Accounts"],
          responses: {
            "200": {
              description: "Daftar akun CoA",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      data: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Account" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/transactions": {
        get: {
          summary: "Daftar Transaksi Harian",
          description: "Mengambil riwayat transaksi harian dengan filter rentang tanggal.",
          tags: ["Transaksi"],
          parameters: [
            { name: "startDate", in: "query", schema: { type: "string", format: "date" } },
            { name: "endDate", in: "query", schema: { type: "string", format: "date" } },
          ],
          responses: {
            "200": { description: "Daftar transaksi harian" },
          },
        },
        post: {
          summary: "Catat Transaksi Harian Baru",
          description:
            "Mencatat transaksi keuangan kas/bank apotek dan otomatis membukukan jurnal umum berpasangan.",
          tags: ["Transaksi"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/TransactionEntryInput" },
              },
            },
          },
          responses: {
            "201": { description: "Transaksi berhasil dibukukan" },
            "400": { $ref: "#/components/responses/BadRequest" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },
      "/transactions/summary": {
        get: {
          summary: "Ringkasan Saldo Kas & Mutasi Harian",
          description:
            "Mengambil posisi running balance untuk 9 akun kas/bank operasional dan total transaksi hari ini.",
          tags: ["Transaksi"],
          responses: {
            "200": { description: "Ringkasan saldo kas dan bank" },
          },
        },
      },
      "/transactions/bulk-delete": {
        post: {
          summary: "Hapus Masal Transaksi",
          description:
            "Menghapus beberapa transaksi terpilih sekaligus secara atomik beserta jurnal terkait.",
          tags: ["Transaksi"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ids: {
                      type: "array",
                      items: { type: "string" },
                      description: "Daftar ID transaksi yang akan dihapus",
                    },
                  },
                  required: ["ids"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Transaksi berhasil dihapus secara masal" },
            "400": { $ref: "#/components/responses/BadRequest" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },
      "/transactions/bulk-update": {
        post: {
          summary: "Ubah Masal Transaksi",
          description:
            "Memperbarui tanggal, PIC, atau tipe transaksi untuk beberapa transaksi terpilih sekaligus secara atomik.",
          tags: ["Transaksi"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ids: {
                      type: "array",
                      items: { type: "string" },
                      description: "Daftar ID transaksi yang akan diubah",
                    },
                    updates: {
                      type: "object",
                      properties: {
                        transactionDate: { type: "string", example: "2026-08-20" },
                        pic: { type: "string", example: "KSR-1" },
                        transactionTypeId: { type: "string" },
                      },
                    },
                  },
                  required: ["ids", "updates"],
                },
              },
            },
          },
          responses: {
            "200": { description: "Transaksi berhasil diperbarui secara masal" },
            "400": { $ref: "#/components/responses/BadRequest" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },
      "/transaction-types": {
        get: {
          summary: "Daftar Master Tipe Transaksi",
          description:
            "Melihat daftar template tipe transaksi (misal: Penjualan Shift, Pembelian COD/Tempo, Biaya Operasional).",
          tags: ["Transaksi"],
          responses: {
            "200": { description: "Daftar master tipe transaksi" },
          },
        },
      },
      "/journals": {
        get: {
          summary: "Daftar Jurnal Umum",
          description: "Menampilkan entri jurnal umum double-entry. Khusus Admin.",
          tags: ["Jurnal Umum"],
          responses: {
            "200": { description: "Daftar jurnal umum" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },
      "/journals/general": {
        post: {
          summary: "Buat Jurnal Umum Manual",
          description:
            "Membuat entri jurnal penyesuaian atau transaksi manual dengan debit dan kredit seimbang. Khusus Admin.",
          tags: ["Jurnal Umum"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/JournalEntryInput" },
              },
            },
          },
          responses: {
            "201": { description: "Jurnal berhasil dibuat" },
            "400": { $ref: "#/components/responses/BadRequest" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },
      "/reports/income-statement": {
        get: {
          summary: "Laporan Laba Rugi (Income Statement)",
          description:
            "Menghitung Pendapatan, HPP, Laba Kotor, Beban Operasional, dan Laba Bersih untuk periode tertentu. Khusus Admin.",
          tags: ["Laporan Keuangan"],
          parameters: [
            {
              name: "startDate",
              in: "query",
              required: true,
              schema: { type: "string", format: "date" },
            },
            {
              name: "endDate",
              in: "query",
              required: true,
              schema: { type: "string", format: "date" },
            },
            { name: "compareStartDate", in: "query", schema: { type: "string", format: "date" } },
            { name: "compareEndDate", in: "query", schema: { type: "string", format: "date" } },
          ],
          responses: {
            "200": { description: "Laporan laba rugi apotek" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },
      "/reports/balance-sheet": {
        get: {
          summary: "Laporan Neraca (Balance Sheet)",
          description:
            "Posisi Aset, Kewajiban, dan Ekuitas apotek per tanggal tertentu. Khusus Admin.",
          tags: ["Laporan Keuangan"],
          parameters: [
            {
              name: "asOfDate",
              in: "query",
              required: true,
              schema: { type: "string", format: "date" },
            },
          ],
          responses: {
            "200": { description: "Laporan neraca apotek" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },
      "/reports/cash-flow": {
        get: {
          summary: "Laporan Arus Kas (Cash Flow Statement)",
          description:
            "Laporan arus kas masuk dan keluar dari aktivitas operasi, investasi, dan pendanaan. Khusus Admin.",
          tags: ["Laporan Keuangan"],
          parameters: [
            {
              name: "startDate",
              in: "query",
              required: true,
              schema: { type: "string", format: "date" },
            },
            {
              name: "endDate",
              in: "query",
              required: true,
              schema: { type: "string", format: "date" },
            },
          ],
          responses: {
            "200": { description: "Laporan arus kas apotek" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },
      "/reports/trial-balance": {
        get: {
          summary: "Neraca Saldo (Trial Balance)",
          description:
            "Neraca saldo debit dan kredit untuk seluruh akun aktif dalam periode tertentu. Khusus Admin.",
          tags: ["Laporan Keuangan"],
          parameters: [
            {
              name: "startDate",
              in: "query",
              required: true,
              schema: { type: "string", format: "date" },
            },
            {
              name: "endDate",
              in: "query",
              required: true,
              schema: { type: "string", format: "date" },
            },
          ],
          responses: {
            "200": { description: "Neraca saldo" },
            "403": { $ref: "#/components/responses/Forbidden" },
          },
        },
      },
      "/audit-logs": {
        get: {
          summary: "Riwayat Audit Log",
          description: "Audit trail setiap aksi perubahan data penting pada sistem.",
          tags: ["Audit"],
          parameters: [
            { name: "entityType", in: "query", schema: { type: "string" } },
            { name: "entityId", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Daftar entri log audit" },
          },
        },
      },
    },
    components_responses: {
      responses: {
        BadRequest: {
          description: "Permintaan tidak valid atau data input tidak sesuai skema",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        Unauthorized: {
          description: "Autentikasi gagal: API Key atau token tidak valid",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        Forbidden: {
          description: "Akses ditolak: Pengguna tidak memiliki izin untuk rute ini",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
        NotFound: {
          description: "Sumber daya tidak ditemukan",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ErrorResponse" },
            },
          },
        },
      },
    },
  };
}

export function getSwaggerHtml(specUrl = "/api/openapi.json"): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Dokumentasi API - Keuangan Apotek</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%230284c7' stroke-width='2'><path d='M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'/></svg>">
  <style>
    body { margin: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    .topbar { background-color: #0f172a !important; padding: 10px 0; border-bottom: 2px solid #0284c7; }
    .topbar-wrapper .link { display: flex; align-items: center; gap: 8px; color: #fff; font-weight: 700; text-decoration: none; }
    .custom-header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #fff; padding: 18px 24px; border-bottom: 1px solid #334155; }
    .custom-header h1 { margin: 0; font-size: 20px; font-weight: 700; display: flex; align-items: center; gap: 10px; }
    .custom-header p { margin: 6px 0 0; font-size: 13px; color: #94a3b8; }
    .custom-badges { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }
    .custom-badge { font-size: 11px; background: rgba(2, 132, 199, 0.2); border: 1px solid rgba(2, 132, 199, 0.4); color: #38bdf8; padding: 2px 8px; border-radius: 4px; font-weight: 600; text-decoration: none; }
    .custom-badge:hover { background: rgba(2, 132, 199, 0.3); }
    .swagger-ui .info { margin: 20px 0; }
  </style>
</head>
<body>
  <div class="custom-header">
    <h1>💊 Keuangan Apotek API Reference</h1>
    <p>Dokumentasi REST API interaktif untuk sistem pembukuan & akuntansi apotek mandiri.</p>
    <div class="custom-badges">
      <a href="/openapi.json" target="_blank" class="custom-badge">📄 Raw OpenAPI (openapi.json)</a>
      <a href="/llms.txt" target="_blank" class="custom-badge">🤖 LLM Context (llms.txt)</a>
      <a href="/llms-full.txt" target="_blank" class="custom-badge">📚 Comprehensive (llms-full.txt)</a>
    </div>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '${specUrl}',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        docExpansion: "list",
        filter: true
      });
    };
  </script>
</body>
</html>`;
}

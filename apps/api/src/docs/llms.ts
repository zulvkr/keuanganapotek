export function getLlmsTxt(): string {
  return `# Keuangan Apotek API

> REST API dan Mesin Akuntansi Terintegrasi untuk Praktik Apotek Mandiri di Indonesia.

Sistem ini mengelola pembukuan apotek berbasis sistem berpasangan (Double-Entry Bookkeeping), bagan akun (Chart of Accounts), transaksi kas/bank harian (shift kasir, pembelian obat dari PBF/distributor, biaya operasional), serta laporan keuangan standar SAK/akuntansi apotek (Laba Rugi, Neraca, Arus Kas).

## Format Data & Aturan Akuntansi
- **Mata Uang**: Rupiah Indonesia (IDR).
- **Format Tanggal**: ISO 8601 YYYY-MM-DD (contoh: 2026-10-17).
- **Prinsip Jurnal**: Setiap transaksi dicatat secara berpasangan dengan total Debit = total Kredit.
- **Isolasi Privasi (RBAC)**: Role Asisten tidak dapat melihat akun sensitif Beban Gaji (6102) dan Saving Gaji (1108). Role Admin memiliki akses penuh ke seluruh akun dan laporan.

## Autentikasi
Kirim API Key pada header permintaan HTTP:
\`\`\`http
X-API-Key: ka_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
\`\`\`
atau
\`\`\`http
Authorization: Bearer ka_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
\`\`\`

## Endpoint Utama untuk LLM Agent
- \`GET /api/accounts/tree\`: Mengambil seluruh daftar bagan akun (CoA) aktif.
- \`GET /api/transactions/summary\`: Ringkasan saldo 7 akun kas/bank operasional dan mutasi hari ini.
- \`GET /api/transactions\`: Mengambil riwayat transaksi harian apotek (filter \`startDate\`, \`endDate\`).
- \`POST /api/transactions\`: Mencatat transaksi keuangan apotek (penjualan obat, pembelian tempo/COD, biaya operasional).
- \`GET /api/reports/income-statement\`: Laporan Laba Rugi (Pendapatan, HPP, Laba Kotor, Beban, Laba Bersih).
- \`GET /api/reports/balance-sheet\`: Laporan Neraca posisi keuangan apotek per tanggal tertentu.
- \`GET /api/reports/cash-flow\`: Laporan Arus Kas (Operasi, Investasi, Pendanaan).
- \`GET /api/api-keys\`: Mengelola API key.

## Tautan Dokumentasi
- [OpenAPI Specification](/openapi.json): Spesifikasi OpenAPI 3.1 lengkap.
- [Dokumentasi Interaktif](/docs): Swagger UI untuk eksplorasi dan uji coba endpoint.
- [Dokumentasi Lengkap LLM](/llms-full.txt): Konteks detail skema JSON, panduan CoA, dan contoh curl.
`;
}

export function getLlmsFullTxt(): string {
  return `# Keuangan Apotek API - Dokumentasi Lengkap untuk LLM & Agen AI

## Ikhtisar Arsitektur
Keuangan Apotek adalah sistem akuntansi independen yang dirancang khusus untuk operasional apotek di Indonesia.
Sistem ini menggunakan SQLite dengan WAL mode, Hono HTTP server, dan Drizzle ORM.

### Taksonomi Bagan Akun (Chart of Accounts - CoA)
Bagan akun apotek dikelompokkan ke dalam struktur kode 4 digit:

1. **Aset (1xxx)**
   - \`1101\`: Uang tukaran kasir permanen
   - \`1102\`: Tunai Kasir (penerimaan tunai harian shift)
   - \`1103\`: Bank Jago Syariah (rekening operasional apotek)
   - \`1106\`: Saldo Grab Merchant
   - \`1107\`: Saldo QRIS DANA
   - \`1108\`: Saving Gaji (SENSITIF: Khusus Admin)
   - \`1109\`: Saving Sewa Gedung
   - \`1201\` - \`1205\`: Dana pending + saldo marketplace, piutang pelanggan, piutang supplier
   - \`1301\`: Persediaan / Stok Barang Obat
   - \`1401\`: Sewa dibayar dimuka
   - \`1601\` / \`1699\`: Aset tetap dan akumulasi penyusutan

2. **Kewajiban (2xxx)**
   - \`2102\`: Hutang Dagang (faktur tempo ke PBF distributor obat)
   - \`2104\`: Hutang Konsinyasi obat/alkes

3. **Ekuitas (3xxx)**
   - \`3101\`: Akun Modal Apoteker / Pemilik
   - \`3201\`: Laba Ditahan

4. **Pendapatan (4xxx)**
   - \`4101\`: Omset Penjualan Obat (Resep & OTC)
   - \`4201\`: Pendapatan Lain-lain (jasa peracikan, dll)

5. **Beban Pokok Penjualan / HPP (5xxx)**
   - \`5101\`: HPP Penjualan Obat
   - \`5102\`: HPP Obat Konsinyasi

6. **Beban Operasional & Administrasi (6xxx)**
   - \`6101\`: Beban admin transaksi (biaya transfer, MDR QRIS, komisi marketplace)
   - \`6102\`: Beban Gaji Karyawan (SENSITIF: Khusus Admin)
   - \`6103\`: Beban Listrik, Air, & Internet
   - \`6104\`: Beban Perlengkapan Apotek (plastik klip, etiket obat, kertas struk)
   - \`6105\`: Beban Promosi & Brosur
   - \`6106\`: Amortisasi sewa bangunan bulanan
   - \`6107\`: Beban operasional lain-lain
   - \`6201\`: Beban Penyusutan Aset Tetap
   - \`6301\`: Beban Pajak Apotek

---

## Panduan Autentikasi & Otorisasi

### Cara Membuat API Key
Pengguna Admin dapat membuat API Key melalui:
\`\`\`http
POST /api/api-keys
Content-Type: application/json
Authorization: Bearer <token_admin>

{
  "name": "Agen AI Akuntansi",
  "expiresAt": "2027-12-31"
}
\`\`\`

Respons akan mengembalikan kunci mentah sekali saja:
\`\`\`json
{
  "data": {
    "id": "uuid-v4",
    "name": "Agen AI Akuntansi",
    "keyPrefix": "ka_live_4a8f...9f8e",
    "key": "ka_live_4a8f9c12b7e510839218d6e321894bfa2910483c1894beef",
    "isActive": true,
    "createdAt": "2026-10-17T07:40:00.000Z"
  }
}
\`\`\`

### Menggunakan API Key
Tambahkan header berikut pada setiap panggilan:
\`\`\`bash
curl -X GET "http://localhost:3000/api/transactions/summary" \\
  -H "X-API-Key: ka_live_4a8f9c12b7e510839218d6e321894bfa2910483c1894beef"
\`\`\`

---

## Contoh Permintaan & Format JSON

### 1. Mencatat Transaksi Penjualan Shift Kasir
\`\`\`http
POST /api/transactions
Content-Type: application/json
X-API-Key: ka_live_...

{
  "transactionDate": "2026-10-17",
  "transactionTypeId": "<id_tipe_penjualan_tunai>",
  "amount": 2450000,
  "memo": "Penjualan shift pagi kasir apotek",
  "metadata": {
    "shift": "Pagi"
  }
}
\`\`\`

### 2. Mengambil Laporan Laba Rugi
\`\`\`http
GET /api/reports/income-statement?startDate=2026-10-01&endDate=2026-10-17
X-API-Key: ka_live_...
\`\`\`

Format Respons:
\`\`\`json
{
  "data": {
    "period": { "startDate": "2026-10-01", "endDate": "2026-10-17" },
    "revenues": 45200000,
    "cogs": 31640000,
    "grossProfit": 13560000,
    "operatingExpenses": 4200000,
    "operatingIncome": 9360000,
    "netIncome": 9360000
  }
}
\`\`\`

### 3. Mengambil Posisi Neraca
\`\`\`http
GET /api/reports/balance-sheet?asOfDate=2026-10-17
X-API-Key: ka_live_...
\`\`\`

---

## Model Context Protocol (MCP) Integration
Aplikasi ini mendukung Model Context Protocol sehingga agen AI dapat memanggil perkakas langsung:
- \`list_accounts\`: Menelusuri bagan akun
- \`get_financial_summary\`: Melihat saldo kas & ringkasan keuangan terkini
- \`get_income_statement\`: Menghasilkan analisis laba rugi
- \`get_balance_sheet\`: Memeriksa solvabilitas & neraca
- \`create_transaction\`: Membukukan transaksi apotek
`;
}

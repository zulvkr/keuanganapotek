# Sistem Keuangan Apotek (Pharmacy Financial Application)

Aplikasi manajemen finansial dan akuntansi modern yang dirancang khusus untuk operasional apotek. Sistem ini mengadopsi prinsip double-entry accounting otomatis, pencatatan batch faktur PBF, integrasi POS clearing & pengakuan HPP harian, pengelolaan konsinyasi, rekonsiliasi bank dual-pane, dan penyusunan laporan keuangan interaktif dengan kemampuan drill-down.

---

## 📁 Struktur Dokumentasi & Proyek

```text
KeuanganApotek/
├── docs/
│   ├── 01_PRD.md                     # Product Requirements Document (Kebutuhan & Lingkup Sistem)
│   ├── 02_UI_UX_SPECIFICATION.md     # Spesifikasi Desain Antarmuka & Panduan Interaksi Keyboard
│   ├── 03_ACCOUNTING_LOGIC_AND_COA.md# Bagan Akun Standar (CoA), Saldo Awal, & Logika Jurnal
│   ├── 04_DATABASE_SCHEMA.md         # Rancangan Skema Relasi Database & Integritas Data
│   ├── 05_DEVELOPMENT_ROADMAP.md     # Rencana Arsitektur Teknologi & Tahapan Implementasi
│   ├── 06_AI_PHASED_DEVELOPMENT_GOALS.md # Panduan Master & Sasaran Pengembangan AI Berkelanjutan
│   └── 07_TESTING_STRATEGY_AND_TEST_SUITES.md # Strategi Pengujian, Test Runner & Spesifikasi Suite
└── README.md                         # Ringkasan Proyek & Panduan Memulai
```

---

## 🧭 Ringkasan Modul Aplikasi

1. **Bagan Akun (Chart of Accounts - CoA) & Saldo Awal**
   - Manajemen hierarki tree-grid akun finansial.
   - Dual-mode: *Mode Struktur Akun* & *Mode Input Saldo Awal*.
   - Auto-Balancing Equity & Jurnal Pembuka otomatis.
2. **Jurnal Umum (General Journal Entry Grid)**
   - Entri debit-kredit berpasangan multi-baris berbasis grid cepat.
   - Live Sticky Balance Validation Bar (merah jika selisih ≠ Rp 0).
3. **Ringkasan Penjualan & Pengakuan HPP Harian (POS Clearing)**
   - Rekap omzet POS harian, penerimaan tunai/non-tunai (QRIS/EDC), selisih kas fisik.
   - Pengakuan HPP / COGS obat harian & auto-generate jurnal.
4. **Faktur Pembelian PBF & Utang Usaha (AP Batch Ledger)**
   - Entri tumpukan faktur Pedagang Besar Farmasi (PBF) beruntun.
   - Dukungan *copy-paste* tabular langsung dari Excel (`Ctrl + V`).
   - Kalkulasi otomatis DPP, PPN 11%, dan jatuh tempo.
5. **Konsinyasi & Bagi Hasil (Consignment Ledger)**
   - Perhitungan bagi hasil produk titip jual (suplemen, madu, alkes).
   - Multi-select settlement dengan floating batch action bar.
6. **Kas, Bank & Mutasi Rekening (Cash & Bank Register)**
   - Pencatatan mutasi kas toko, setoran tunai harian, transfer antar bank, dan biaya admin.
   - Otomatisasi mutasi ganda buku besar tanpa jurnal manual.
7. **Rekonsiliasi Bank (Dual Pane Split-Grid)**
   - Perbandingan berdampingan: Mutasi Internal Sistem vs Rekening Koran Bank.
   - Fitur *Auto-Match* tanggal ±1 hari & nominal identik serta pencocokan manual satu-klik.
8. **Laporan Keuangan Dinamis & Drill-Down**
   - Laba Rugi Komparatif, Neraca, Neraca Saldo.
   - Interaktif: Mengklik nominal membuka slide-over drawer rincian jurnal pembentuk.

---

## 📐 Standar Desain & UX

- **Tipografi Angka:** Wajib Monospaced/Tabular Figures (`tabular-nums`) untuk kode, nominal, dan tanggal.
- **Alignment:** Teks (kiri), Angka/Nominal/Qty (kanan), Tanggal/Badge/Aksi (tengah).
- **Data Grid:** Sticky Header, Frozen Key Column, Zebra Striping (`#FAFAFA`), Hover (`#F0F4F8`), Active Cell Outline (2px biru).
- **Keyboard Mastery:** Navigasi cepat tanpa mouse (`Tab`, `Shift+Tab`, `Enter`, `F2`, `Esc`, `Ctrl+Z`, `Ctrl+V`).

---

## 🛠️ Arsitektur Teknologi (Tech Stack)

- **Frontend:** Vite + React 18/19 (TypeScript), TanStack Table v8, TanStack Query, Tailwind CSS.
- **Backend:** Node.js + tRPC / Hono Server (End-to-End Type Safety).
- **Database:** SQLite (WAL Mode, synchronous NORMAL, Foreign Keys ON, Busy Timeout 5s).
- **ORM:** Drizzle ORM.
- **Financial Precision:** `decimal.js` / `dinero.js` (Integer minor units / sen di database).
- **Validation:** Zod (Shared schemas antara backend DTO & frontend form/grid).

---

Silakan eksplorasi folder `docs/` untuk membaca rincian spesifikasi lengkap.

## 🚀 Menjalankan Banyak Dev Instance

`pnpm dev` otomatis memilih port kosong untuk API dan web, sehingga beberapa worktree dapat dijalankan bersamaan pada mesin yang sama. URL yang terpilih akan dicetak di terminal.

Untuk port yang konsisten pada worktree tertentu, set `API_PORT` dan `WEB_PORT` sebelum menjalankan perintah. `VITE_API_URL` akan mengikuti port API secara otomatis:

```powershell
$env:API_PORT = "3101"
$env:WEB_PORT = "5274"
pnpm dev
```

Variabel yang tersedia:

- `API_PORT`: port server API, default mulai dari `3000` dan otomatis mencari port berikutnya yang kosong.
- `WEB_PORT`: port Vite, default mulai dari `5173` dan otomatis mencari port berikutnya yang kosong.
- `VITE_API_URL`: URL API eksplisit jika API dijalankan di host/port berbeda.
- `DATABASE_PATH`: lokasi database SQLite per instance/worktree jika diperlukan.


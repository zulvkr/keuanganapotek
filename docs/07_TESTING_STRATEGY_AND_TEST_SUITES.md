# Strategi Pengujian & Spesifikasi Test Suite (Testing Strategy & Test Specs)
## Sistem Keuangan Apotek (Full-Stack TypeScript & SQLite)

---

## 🎯 1. Filosofi & Piramida Pengujian (Testing Philosophy)

Aplikasi finansial dan akuntansi menuntut **tingkat akurasi nol toleransi kesalahan (zero-tolerance for financial errors)**. Oleh karena itu, pengujian pada sistem ini dibagi ke dalam 4 lapisan piramida:

```text
               / \
              /   \
             / E2E \          (Playwright: Keyboard Nav, Grid, Excel Paste, Drill-Down)
            /-------\
           / Integr. \        (Vitest + SQLite in-memory / WAL: Double-Entry ACID, Routers)
          /-----------\
         / Unit Testing\      (Vitest: Math Engine, Decimal.js, Zod Schemas, Auto-Match)
        /---------------\
       / Performance/Load\    (Stress Test: 5.000 - 10.000 Baris Data Grid < 100ms)
      ---------------------
```

---

## 🛠️ 2. Tooling & Test Runner Stack

- **Unit & Integration Test Runner:** [Vitest](https://vitest.dev/) (Cepat, native ESM & TypeScript support).
- **In-Memory / Isolation DB for Integration Tests:** SQLite in-memory (`:memory:`) atau file SQLite temporer per test suite dengan Drizzle ORM.
- **End-to-End (E2E) & UI Interaction Testing:** [Playwright](https://playwright.dev/) (Menguji navigasi keyboard `Tab`, `Enter`, `F2`, shortcut `Ctrl+V` paste Excel, dan Slide-over Drawer).
- **Assertion & Math Verification:** `decimal.js` exact precision assertions (`.equals()`, `.isZero()`).

---

## 🧪 3. Spesifikasi Test Suite Per Lapisan

---

### 3.1 Unit Testing (`packages/shared/src/__tests__/`)

Fokus: Menguji rumus finansial, validasi skema Zod, dan fungsi utilitas tanpa dependensi database.

#### 📁 Test Suite: `financial-math.test.ts`
- **Kalkulasi DPP & PPN 11%:**
  - Uji DPP Rp 1.000.000 $\rightarrow$ PPN 11% = Rp 110.000, Total = Rp 1.110.000.
  - Uji pembulatan sen pada nominal ganjil (misal DPP Rp 12.345) $\rightarrow$ Tidak boleh ada deviasi floating point (`0.1 + 0.2` issue).
- **Validasi Keseimbangan Debit vs Kredit:**
  - Uji daftar baris dengan $\sum \text{Debit} == \sum \text{Kredit} \rightarrow \text{isBalanced} = \text{true}$, selisih = 0.
  - Uji selisih $\text{Debit} > \text{Kredit} \rightarrow \text{isBalanced} = \text{false}$, selisih positif.
- **Konversi Mata Uang & Sen Integer:**
  - Uji konversi input tampilan Rupiah (`"Rp 1.500.000,00"`) ke integer sen (`150000000`).

#### 📁 Test Suite: `zod-schemas.test.ts`
- Validasi kode akun (harus format angka string 4 digit unik).
- Validasi baris jurnal: `debit` dan `credit` tidak boleh keduanya nol, tidak boleh negatif.
- Validasi faktur PBF: `invoiceNumber` tidak boleh kosong, tanggal jatuh tempo $\ge$ tanggal faktur.

---

### 3.2 Integration Testing (`apps/api/src/__tests__/`)

Fokus: Menguji logika bisnis akuntansi, relasi database SQLite, transaksi ACID, dan API Routers.

#### 📁 Test Suite: `double-entry-ledger.test.ts`
- **ACID Transaction Rollback:**
  - Kirim entri jurnal tidak seimbang (Debit: Rp 500.000, Kredit: Rp 400.000) $\rightarrow$ Verifikasi transaksi dibatalkan (rollback), tidak ada data yang masuk ke `journals` maupun `journal_lines`.
- **Opening Balance & Auto-Balancing Equity:**
  - Masukkan saldo awal beberapa akun dengan selisih Rp 25.000.000.
  - Jalankan fungsi `saveOpeningBalances` dengan flag auto-balance $\rightarrow$ Verifikasi akun `3101 - Ekuitas Saldo Awal` otomatis terisi kredit Rp 25.000.000 dan Jurnal Pembuka otomatis terbentuk dengan status seimbang.
- **Lock Period Protection:**
  - Kunci periode per tanggal 31 Desember 2025.
  - Coba buat atau update jurnal bertanggal 15 Desember 2025 $\rightarrow$ API wajib melempar error `PERIOD_LOCKED` (HTTP 403/400).

#### 📁 Test Suite: `pos-clearing-journal.test.ts`
- Input omzet Rp 10.000.000, Tunai Rp 6.000.000, QRIS Rp 3.950.000, Kas Fisik Rp 5.950.000 (Selisih Kurang Rp 50.000), HPP Rp 7.000.000.
- Trigger `generatePOSJournal`:
  - Verifikasi baris Debit: Kas Toko Rp 5.950.000, Kliring QRIS Rp 3.950.000, Beban Selisih Kasir Rp 50.000.
  - Verifikasi baris Kredit: Pendapatan Penjualan Rp 10.000.000.
  - Verifikasi baris HPP: Debit HPP Rp 7.000.000, Kredit Persediaan Rp 7.000.000.
  - Verifikasi total debit == total kredit.

#### 📁 Test Suite: `pbf-batch-ledger.test.ts`
- Simpan faktur PBF "Kimia Farma" dengan nomor `INV-001`.
- Coba simpan faktur kedua dengan vendor yang sama "Kimia Farma" dan nomor `INV-001` $\rightarrow$ Verifikasi ditolak karena duplikasi (`UNIQUE constraint failed: pbf_invoices.pbf_name, pbf_invoices.invoice_number`).

#### 📁 Test Suite: `bank-reconciliation-engine.test.ts`
- Siapkan 5 mutasi internal dan 5 baris rekening koran bank.
- Uji skenario Auto-Match:
  - Transaksi A: internal tgl 10 Sept Rp 1.500.000 vs bank tgl 11 Sept Rp 1.500.000 ($\Delta \text{tgl} = 1\text{ hari}$) $\rightarrow$ Harus `MATCHED`.
  - Transaksi B: internal tgl 10 Sept Rp 2.000.000 vs bank tgl 14 Sept Rp 2.000.000 ($\Delta \text{tgl} = 4\text{ hari}$) $\rightarrow$ Harus tetap `UNMATCHED` (menunggu manual match).

#### 📁 Test Suite: `financial-reports-drilldown.test.ts`
- Seeding data transaksi selama 2 bulan.
- Hitung Laba Rugi Komparatif $\rightarrow$ Verifikasi formula: $\text{Laba Bersih} = \text{Pendapatan} - \text{HPP} - \text{Beban Operasional}$.
- Hitung Neraca $\rightarrow$ Verifikasi persamaan: $\text{Aset} = \text{Kewajiban} + \text{Ekuitas}$.
- Panggil `getAccountJournalDrillDown(akunId, period)` $\rightarrow$ Verifikasi daftar jurnal yang dikembalikan persis membentuk total saldo akun tersebut.

---

### 3.3 End-to-End (E2E) UI Testing (`apps/web/e2e/`)

Fokus: Menguji interaksi antarmuka pengguna nyata di browser headless menggunakan Playwright.

#### 📁 E2E Suite: `keyboard-navigation-grid.spec.ts`
- Buka halaman Jurnal Umum.
- Klik sel pertama $\rightarrow$ Tekan `Tab` berulang kali $\rightarrow$ Pastikan fokus sel berpindah ke kanan secara mulus.
- Tekan `Enter` $\rightarrow$ Pastikan nilai sel tersimpan dan fokus berpindah ke sel di bawahnya.
- Pada baris terakhir kolom Kredit, tekan `Tab` $\rightarrow$ Pastikan baris kosong baru otomatis ditambahkan ke grid.

#### 📁 E2E Suite: `pbf-excel-paste.spec.ts`
- Buka halaman Faktur PBF.
- Simulasikan event clipboard paste (`Ctrl + V`) berisi data tabular 5 baris faktur dari clipboard Excel.
- Verifikasi 5 baris baru muncul di grid, DPP dan PPN 11% terhitung otomatis, dan format rupiah ditampilkan dalam `tabular-nums`.

#### 📁 E2E Suite: `financial-report-drilldown.spec.ts`
- Buka halaman Laporan Keuangan $\rightarrow$ Pilih Laba Rugi.
- Klik angka nominal pada baris "Pendapatan Penjualan".
- Verifikasi Slide-Over Drawer muncul dari sisi kanan layar dan memuat tabel riwayat jurnal transaksi.

---

### 3.4 Performance & Stress Testing (`apps/web/src/__tests__/perf/`)

Fokus: Memastikan performa data grid tetap responsif pada skala volume data riil apotek.

#### 📁 Stress Suite: `grid-virtualization-benchmark.spec.ts`
- Render TanStack Table dengan **5.000 baris data jurnal**.
- Ukur waktu initial render: Target $< 100\text{ ms}$.
- Simulasikan fast vertical scroll (1.000 baris/detik) $\rightarrow$ Pastikan frame rate $\ge 55\text{ FPS}$ tanpa blank screen / lag.

---

## 📋 4. Matriks Perintah Pengujian (Test Commands Matrix)

| Lingkup Pengujian | Perintah Eksekusi | Keterangan |
| :--- | :--- | :--- |
| **All Unit & Integration Tests** | `pnpm test` | Menjalankan seluruh test suite Vitest di semua package/apps |
| **Shared Math & Schema Tests** | `pnpm --filter shared test` | Menguji presisi decimal.js & validasi skema Zod |
| **Backend API & Service Tests** | `pnpm --filter api test` | Menguji ACID double-entry, SQLite Drizzle, & Router endpoints |
| **E2E Playwright Tests** | `pnpm --filter web test:e2e` | Menguji navigasi keyboard grid, Excel paste, dan drawer |
| **Grid Performance Benchmark** | `pnpm --filter web test:perf` | Menguji rendering virtualized grid 5.000 baris data |
| **Test Coverage Report** | `pnpm test:coverage` | Menghasilkan laporan code coverage (Target: $\ge 85\%$ untuk core accounting logic) |

---

## 🛡️ 5. Standar Definition of Done (DoD) Pengujian per Fase

Sebelum sebuah fase dinyatakan selesai (`[x]`):
1. Seluruh test unit & integration pada modul terkait wajib **Passing (100% lulus)** tanpa error.
2. Tidak ada regresi pada modul yang telah dibangun di fase sebelumnya.
3. Test coverage untuk modul core accounting (`math`, `ledger.service`, `recon.service`, `reports.service`) minimal **85%**.

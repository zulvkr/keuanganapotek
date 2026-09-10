# Product Requirements Document (PRD)
## Sistem Akuntansi & Manajemen Keuangan Apotek

---

## 1. Latar Belakang & Masalah Bisnis
Operasional apotek memiliki karakteristik finansial yang unik dan memiliki volume transaksi harian yang tinggi:
- **Transaksi Kasir Berskala Besar:** Ratusan hingga ribuan struk penjualan harian dengan beragam metode pembayaran (Tunai, QRIS, EDC Debit/Kredit).
- **HPP & Modal Obat Berfluktuasi:** Fluktuasi harga beli obat, diskon prinsipal/PBF, dan kebutuhan pengakuan HPP (Harga Pokok Penjualan) secara berkala tanpa membebani kasir.
- **Faktur PBF dalam Jumlah Banyak:** Ratusan faktur beruntun dari Pedagang Besar Farmasi (PBF) dengan pajak PPN 11%, termin jatuh tempo bervariasi (14, 30, 45 hari), dan perlunya pencegahan duplikasi nomor faktur.
- **Barang Konsinyasi (Titip Jual):** Pengelolaan barang titip jual (suplemen kesehatan, madu herbal, alkes) yang menuntut pencatatan bagi hasil dan utang konsinyasi yang transparan.
- **Rekonsiliasi Bank:** Perbedaan antara uang kas fisik, pencatatan kasir, dan dana yang masuk ke rekening bank / settlement QRIS/EDC.

Aplikasi ini dibangun untuk menyederhanakan, mengotomatisasi, dan mempercepat pencatatan akuntansi apotek menggunakan pendekatan **High-Speed Data Grid** dengan prinsip *double-entry accounting* otomatis.

---

## 2. Tujuan Sistem (System Objectives)
1. **Kecepatan Input (Speed & Ergonomics):** Mengadopsi pengalaman grid mirip spreadsheet dengan navigasi keyboard penuh, multi-row copy-paste dari Excel, dan auto-completion cepat.
2. **Otomatisasi Jurnal Ganda:** Mengeliminasi kebutuhan staf akuntansi membuat jurnal manual untuk transaksi standar (Penjualan POS, Pembelian PBF, Mutasi Kas/Bank, Bagi Hasil Konsinyasi).
3. **Pencegahan Human Error (Error Prevention):** Validasi keseimbangan debit-kredit secara visual real-time (*sticky bottom bar*), deteksi duplikasi nomor faktur PBF, dan peringatan selisih kas fisik.
4. **Visibilitas Finansial Real-Time (Drill-Down Financial Insights):** Laporan Laba Rugi, Neraca Saldo, dan Neraca yang dapat dieksplorasi hingga ke tingkat jurnal transaksi pembentuknya.
5. **Integritas Saldo Awal:** Fitur cut-off saldo awal dengan validasi keseimbangan dan opsi alokasi selisih otomatis ke ekuitas (*Auto-Balancing Equity*).

---

## 3. Lingkup Modul Fungsional

### Modul 1: Bagan Akun (Chart of Accounts - CoA) & Saldo Awal
- Manajemen master hierarki akun keuangan (Aset, Kewajiban, Ekuitas, Pendapatan, Beban).
- Tree-grid inline editing dengan auto-indentation berdasarkan level akun.
- Mode Saldo Awal (*Opening Balance*) dengan validasi Total Debit = Total Kredit per tanggal cut-off.
- Auto-generate Jurnal Pembuka (*Opening Balance Journal*) dan sistem penguncian periode (*Lock State*).

### Modul 2: Jurnal Umum (General Journal Entry Grid)
- Entri jurnal berpasangan manual (penyesuaian, penyusutan aset, amortisasi).
- Autocomplete akun, format pemisah ribuan otomatis, shortcut navigasi keyboard.
- Live Bottom Sticky Balance Bar (Tombol Posting disabled bila out-of-balance).

### Modul 3: Ringkasan Penjualan & Pengakuan HPP Harian (POS Clearing)
- Rekapitulasi omzet POS harian, penerimaan tunai, dan QRIS/EDC per shift.
- Perhitungan otomatis selisih kas fisik terhadap data POS.
- Input nilai modal obat (HPP/COGS) harian dan 1-click *Generate Jurnal Penjualan & HPP*.

### Modul 4: Faktur Pembelian PBF & Utang Usaha (AP Batch Ledger)
- Entri faktur distributor/PBF beruntun dengan deteksi duplikasi nomor faktur.
- Fitur *Paste from Excel* (`Ctrl + V`) multi-baris.
- Otomatisasi kalkulasi DPP, PPN 11%, dan Total Tagihan dengan fleksibilitas edit manual untuk penyesuaian pembulatan cetak faktur fisik.
- Tracking termin pembayaran (Tunai, 14, 30, 45 hari) dan tanggal jatuh tempo.

### Modul 5: Konsinyasi & Pembayaran Bagi Hasil (Consignment Ledger)
- Pencatatan barang titip jual, kuantitas terjual, dan harga kesepakatan bagi hasil.
- Penghitungan utang konsinyasi otomatis.
- Batch multi-select settlement melalui floating action bar.

### Modul 6: Kas, Bank & Mutasi Antar Rekening (Cash & Bank Register)
- Monitoring saldo real-time: Kas Toko, Rekening Operasional Bank 1, Bank 2.
- Pencatatan setoran tunai kasir ke bank, pemindahan dana antar bank, dan pembebanan biaya administrasi.
- Pembentukan mutasi ganda otomatis di buku besar.

### Modul 7: Rekonsiliasi Bank (Bank Reconciliation Split-Grid)
- Tampilan dua panel berdampingan (*Dual Pane Split View*): Mutasi Internal Sistem vs Rekening Koran Bank.
- Tombol *Auto-Match* berbasis tanggal (±1 hari) dan nominal identik.
- Manual link matching dengan status keselarasan visual real-time.

### Modul 8: Laporan Keuangan Dinamis & Drill-Down (Financial Statements)
- Laporan Laba Rugi Komparatif (Bulan Berjalan vs Bulan Sebelumnya, varians nominal & persentase).
- Laporan Neraca (Balance Sheet) & Neraca Saldo (Trial Balance).
- Fitur interaktif *Drill-down*: Mengklik nilai akun membuka slide-over drawer berisi daftar jurnal pembentuk.

---

## 4. Kebutuhan Non-Fungsional (Non-Functional Requirements)
1. **Performa:** Waktu respons grid < 100ms untuk manipulasi hingga 5.000 baris data lokal.
2. **Reliabilitas Akuntansi:** Menerapkan kaidah integritas ACID pada database transaksi buku besar; saldo debit dan kredit wajib balance di level database constraint.
3. **Ergonomi Pengguna:** Aksesibilitas keyboard 100% untuk operasi entri data berulang tanpa ketergantungan mouse.
4. **Keamanan & Audit Trail:** Pencatatan log perubahan, pembuat transaksi, dan penguncian transaksi pasca tutup buku.

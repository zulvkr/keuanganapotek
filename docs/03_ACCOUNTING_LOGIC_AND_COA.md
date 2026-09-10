# Standar Akuntansi & Logika Jurnal Apotek (Accounting Logic & CoA)

Dokumen ini mendefinisikan struktur standar Bagan Akun (*Chart of Accounts*), saldo normal, mekanisme jurnal pembuka, serta formula pembentukan jurnal otomatis pada operasional apotek.

---

## 1. Master Bagan Akun Standar (Standard Pharmacy CoA)

Sistem menggunakan penomoran 4-digit hierarkis standar:

| Kode Akun | Nama Akun | Klasifikasi | Saldo Normal | Deskripsi & Kegunaan |
| :--- | :--- | :--- | :--- | :--- |
| **1000** | **ASET** | **Header** | **Debit** | Induk Akun Aset |
| 1100 | Kas & Setara Kas | Aset Lancar | Debit | Kas toko dan rekening bank |
| 1101 | Kas Toko / Kasir | Aset Lancar | Debit | Kas fisik di laci kasir apotek |
| 1102 | Kas Kecil (Petty Cash) | Aset Lancar | Debit | Operasional harian minor |
| 1111 | Bank BCA Operasional | Aset Lancar | Debit | Rekening penerimaan & operasional |
| 1112 | Bank Mandiri Operasional | Aset Lancar | Debit | Rekening operasional 2 |
| 1120 | Kliring QRIS & EDC | Aset Lancar | Debit | Penampung mutasi settlement pending |
| 1200 | Piutang Usaha | Aset Lancar | Debit | Tagihan ke instansi/resep kredit |
| 1300 | Persediaan Barang Dagang | Aset Lancar | Debit | Nilai persediaan obat & alkes |
| 1301 | Persediaan Obat Resep (Etikal) | Aset Lancar | Debit | Obat ethical |
| 1302 | Persediaan Obat Bebas (OTC) & Herbal | Aset Lancar | Debit | Obat bebas & suplemen |
| 1303 | Persediaan Alat Kesehatan | Aset Lancar | Debit | Alkes & consumable medis |
| 1400 | Pajak Dibayar Dimuka (PPN Masukan) | Aset Lancar | Debit | PPN 11% dari faktur pembelian PBF |
| 1600 | Aset Tetap | Aset Tidak Lancar | Debit | Inventaris & peralatan apotek |
| 1601 | Peralatan & Rak Apotek | Aset Tetap | Debit | Rak display, etalase kaca, POS hardware |
| 1602 | Kendaraan Operasional | Aset Tetap | Debit | Sepeda motor pengantaran obat |
| 1699 | Akumulasi Penyusutan Aset Tetap | Kontra Aset | Kredit | Penyusutan akumulatif |
| **2000** | **KEWAJIBAN / UTANG** | **Header** | **Kredit** | Induk Akun Kewajiban |
| 2100 | Utang Usaha PBF | Kewajiban Lancar | Kredit | Utang faktur distributor farmasi |
| 2110 | Utang Konsinyasi | Kewajiban Lancar | Kredit | Kewajiban bagi hasil barang titip |
| 2200 | Beban Akrual / Masih Harus Dibayar | Kewajiban Lancar | Kredit | Gaji staf & tagihan utilitas tertunda |
| 2300 | Utang Pajak (PPN Keluaran / PPh 21) | Kewajiban Lancar | Kredit | Kewajiban pajak bulanan |
| **3000** | **EKUITAS / MODAL** | **Header** | **Kredit** | Induk Modal |
| 3100 | Modal Disetor / Modal Pemilik | Ekuitas | Kredit | Modal pendirian apotek |
| 3101 | Ekuitas Saldo Awal (Opening Balance Equity) | Ekuitas | Kredit | Akun penyeimbang saldo awal migrasi |
| 3200 | Saldo Laba Ditahan (Retained Earnings) | Ekuitas | Kredit | Akumulasi laba tahun-tahun sebelumnya |
| 3300 | Prive / Penarikan Pemilik | Kontra Ekuitas | Debit | Pengambilan dana oleh pemilik |
| **4000** | **PENDAPATAN** | **Header** | **Kredit** | Induk Pendapatan |
| 4101 | Pendapatan Penjualan Obat Bebas (OTC) | Pendapatan Usaha | Kredit | Omzet penjualan non-resep |
| 4102 | Pendapatan Penjualan Obat Resep | Pendapatan Usaha | Kredit | Omzet penjualan resep dokter |
| 4103 | Pendapatan Jasa Embalase & Tuslah | Pendapatan Usaha | Kredit | Jasa peracikan resep |
| 4200 | Pendapatan Konsinyasi (Margin Bagi Hasil) | Pendapatan Usaha | Kredit | Komisi penjualan titip jual |
| 4900 | Pendapatan Lain-lain (Selisih Kasir Plus) | Pendapatan Non-Op | Kredit | Kelebihan kas fisik kasir |
| **5000** | **BEBAN POKOK PENJUALAN (HPP)** | **Header** | **Debit** | Induk HPP |
| 5101 | HPP Obat Resep | Beban Pokok | Debit | Nilai modal obat resep |
| 5102 | HPP Obat Bebas & Alkes | Beban Pokok | Debit | Nilai modal obat bebas & alkes |
| 5200 | Potongan Pembelian / Diskon PBF | Kontra HPP | Kredit | Diskon faktur distributor |
| **6000** | **BEBAN OPERASIONAL & UMUM** | **Header** | **Debit** | Induk Beban Operasional |
| 6101 | Beban Gaji Apoteker (APA/APING) & Asisten (TTK)| Beban Operasional | Debit | Payroll tenaga kefarmasian |
| 6102 | Beban Listrik, Air, Internet & Telepon | Beban Operasional | Debit | Biaya utilitas outlet |
| 6103 | Beban Sewa Ruko / Bangunan Apotek | Beban Operasional | Debit | Amortisasi/sewa tempat usaha |
| 6104 | Beban Plastik, Klip Obat & Perlengkapan | Beban Operasional | Debit | Kemasan & ATK kasir |
| 6105 | Beban Pembuangan / Kerusakan Obat Kadaluarsa | Beban Operasional | Debit | Kerugian obat expired / rusak |
| 6106 | Beban Selisih Kasir Minus | Beban Operasional | Debit | Kekurangan fisik kas kasir |
| 6201 | Beban Administrasi Bank & EDC Merchant | Beban Non-Op | Debit | Biaya admin transfer / MDR EDC |

---

## 2. Logika Saldo Awal (*Opening Balance Engine*)

### 2.1 Mekanisme Cut-Off & Keseimbangan
1. Saldo Awal diinput per tanggal cut-off tertentu (misal: 31 Desember 2025).
2. Sistem mengecek keseimbangan secara real-time:
   $$\text{Total Debit} = \text{Total Kredit}$$
3. **Auto-Balancing Equity:** Jika terjadi selisih $S = \text{Total Debit} - \text{Total Kredit}$:
   - Jika $S > 0$ (Debit lebih besar), sistem mengalokasikan kredit sebesar $S$ ke `3101 - Ekuitas Saldo Awal`.
   - Jika $S < 0$ (Kredit lebih besar), sistem mengalokasikan debit sebesar $|S|$ ke `3101 - Ekuitas Saldo Awal`.
4. Setelah divalidasi dan disimpan, sistem otomatis mengunci (*Lock Period*) dan membentuk **Jurnal Pembuka**.

---

## 3. Logika & Formula Jurnal Otomatis Per Modul

### 3.1 Modul POS Clearing & Pengakuan HPP Harian
Ketika tombol *"Generate Jurnal"* diklik pada baris rekap harian:

**Jurnal Penerimaan Omzet Kasir:**
- `(D) 1101 - Kas Toko / Kasir` = Nominal Uang Tunai Riil
- `(D) 1120 - Kliring QRIS & EDC` = Nominal Penerimaan Non-Tunai
- `(D) 6106 - Beban Selisih Kasir Minus` = (Jika Selisih Kas < 0)
- `(K) 4900 - Pendapatan Lain (Selisih Kasir Plus)` = (Jika Selisih Kas > 0)
- `(K) 4101 / 4102 - Pendapatan Penjualan` = Total Omzet POS

**Jurnal Pengakuan HPP & Pengurangan Persediaan:**
- `(D) 5101 / 5102 - HPP Penjualan Obat` = Nilai HPP Harian
- `(K) 1301 / 1302 - Persediaan Barang Dagang` = Nilai HPP Harian

---

### 3.2 Modul Faktur Pembelian PBF (AP Batch Ledger)
Ketika faktur PBF diverifikasi/disimpan:

**Formula Perhitungan:**
- $\text{DPP} = \text{Nilai Bersih Barang}$
- $\text{PPN 11\%} = \text{DPP} \times 0.11$ (atau penyesuaian nominal faktur fisik)
- $\text{Total Tagihan} = \text{DPP} + \text{PPN}$

**Jurnal Akuntansi:**
- `(D) 1301 / 1302 - Persediaan Barang Dagang` = DPP
- `(D) 1400 - PPN Masukan (Pajak Dibayar Dimuka)` = PPN 11%
- `(K) 2100 - Utang Usaha PBF` (atau `1101/1111` jika Tunai) = Total Tagihan

---

### 3.3 Modul Konsinyasi & Pembayaran Bagi Hasil
Ketika produk konsinyasi terjual dan dieksekusi pembayarannya:

**Saat Penjualan Terjadi:**
- `(D) Kas / Piutang` = Harga Jual Konsumen
- `(K) 2110 - Utang Konsinyasi` = Kewajiban Bagi Hasil Vendor
- `(K) 4200 - Pendapatan Konsinyasi (Margin)` = Selisih Harga Jual - Bagi Hasil

**Saat Pembayaran Utang Konsinyasi (Batch Settlement):**
- `(D) 2110 - Utang Konsinyasi` = Total Bagi Hasil Terpilih
- `(K) 1111 / 1112 / 1101 - Bank/Kas Akun Sumber` = Total Pembayaran

---

### 3.4 Modul Kas, Bank & Mutasi Rekening
Ketika terjadi setoran tunai kas toko ke bank atau transfer antar rekening:

**Contoh: Setoran Kas Toko ke Bank BCA via BI-FAST:**
- `(D) 1111 - Bank BCA Operasional` = Nominal Bersih Masuk Bank
- `(D) 6201 - Beban Administrasi Bank` = Biaya Admin (misal Rp 2.500)
- `(K) 1101 - Kas Toko / Kasir` = Nominal Bersih + Biaya Admin

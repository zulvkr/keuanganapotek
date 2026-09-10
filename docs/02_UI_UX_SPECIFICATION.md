# Spesifikasi Desain Antarmuka (UI/UX Design Specification)
## Sistem Keuangan Apotek

Dokumen ini adalah spesifikasi teknis antarmuka (*UI/UX Design Specification*) untuk tim pengembang front-end dan desainer produk.

---

## 1. Prinsip Fondasi Desain Global (Design System Rules)

Sebelum masuk ke detail per halaman, sistem antarmuka wajib mengadopsi standar berikut:

### 1.1 Tipografi & Format Angka
- **Monospaced/Tabular Figures:** Wajib menggunakan font dengan angka berjarak tetap (misalnya *Inter* dengan `font-variant-numeric: tabular-nums` atau *Roboto Mono* / *JetBrains Mono*) untuk seluruh kolom nominal rupiah, tanggal, persentase, nomor referensi, dan kode akun.
- **Pemisah Ribuan Otomatis:** Input nominal otomatis diformat dengan pemisah ribuan (titik `.` untuk format Indonesia) saat sel kehilangan fokus (*blur*).

### 1.2 Perataan Kolom (Alignment Rules)
- **Teks & Deskripsi:** Rata Kiri (*Left-aligned*).
- **Nominal Uang, Jumlah (Qty), & Persentase:** Rata Kanan (*Right-aligned*).
- **Tanggal, Status Badge, & Tombol Aksi:** Rata Tengah (*Center-aligned*).

### 1.3 Anatomi Kisi Data (Data Grid Anatomy)
- **Sticky Headers:** Header tabel tetap terkunci di posisi atas saat di-*scroll* vertikal.
- **Frozen Key Columns:** Kolom identitas utama (Kode Akun, Nama Akun, No. Faktur, No. Ref) terkunci di sisi kiri saat di-*scroll* horizontal.
- **Zebra Striping & Hover State:** Baris berselang warna lembut (`#FAFAFA` vs `#FFFFFF`) dengan warna *hover* tegas (`#F0F4F8`) untuk memandu pandangan mata horizontal.
- **Active Cell Outline:** Sel yang sedang aktif/fokus diberi border biru tegas berukuran `2px` (`#2563EB`).

### 1.4 Indikator Status & Pencegahan Error (Error Prevention)
- **Status Sinkronisasi:** Status *Saved / Draft / Syncing* ditampilkan di pojok kanan atas toolbar setiap tabel.
- **Notifikasi Kesalahan Inline:** Border merah pada sel bersangkutan (`#EF4444`) + tooltip instan saat kursor diarahkan, tanpa memunculkan alert dialog/modal yang memutus ritme pengetikan.

---

## 2. Panduan Interaksi Keyboard (Keyboard Navigation Map)

Semua komponen grid wajib mendukung navigasi keyboard penuh:

| Tombol Keyboard | Aksi di Dalam Sel Grid |
| :--- | :--- |
| `Tab` | Pindah ke sel sebelah kanan. Jika berada di kolom paling kanan pada baris terakhir, otomatis membuat baris baru. |
| `Shift + Tab` | Pindah ke sel sebelah kiri. |
| `Enter` | Menyimpan perubahan di sel dan memindahkan fokus ke sel di bawahnya. |
| `Panah (↑, ↓, ←, →)` | Navigasi antar sel tanpa mengaktifkan mode edit teks (selection mode). |
| `F2` / *Double Click* | Masuk ke mode edit teks di dalam sel yang sedang aktif. |
| `Escape (Esc)` | Membatalkan perubahan teks yang baru diketik dan mengembalikan nilai awal. |
| `Ctrl + Z` / `Ctrl + Y` | Membatalkan / mengulangi (*Undo / Redo*) riwayat input di tingkat tabel lokal sebelum disimpan. |
| `Ctrl + V` | Menempelkan data tabular dari clipboard Excel langsung memetakan baris dan kolom yang sesuai. |

---

## 3. Spesifikasi Detail Per Halaman

---

### Halaman 1: Bagan Akun (Chart of Accounts & Saldo Awal)

#### 1. Tujuan Pengguna
Mengelola daftar akun finansial apotek dengan struktur hierarki bertingkat serta melakukan pengisian & penguncian saldo awal (*Opening Balance*) tanpa membuka formulir terpisah.

#### 2. Kontrol Atas (Top Toolbar)
- **Pencarian Cepat:** Input search instan untuk kode dan nama akun.
- **Filter Klasifikasi:** Tombol pills (Semua, Aset, Kewajiban, Ekuitas, Pendapatan, Beban).
- **Tombol Impor:** Tombol "Impor Akun Excel".
- **Toggle Mode Input:**
  - `Mode Struktur Akun` (Mode standar untuk membuat/mengubah hierarki akun).
  - `Mode Input Saldo Awal` (Mode khusus pengisian nominal awal periode buku).
- **Field Tanggal Cut-off Saldo Awal:** Date picker di toolbar (misal: *Per 31 Desember 2025* atau *Per 01 Januari 2026*).
- **Tombol Kunci Saldo Awal (Lock/Finalize):** Ikon gembok untuk mengunci saldo awal agar tidak berubah saat transaksi berjalan sudah aktif.

#### 3. Kolom Tabel pada Mode Struktur Akun
1. `Kode Akun` (Text/Number, auto-indentation hierarki: misal `1101` menjorok ke dalam dibanding `1000`).
2. `Nama Akun` (Text input langsung di sel).
3. `Klasifikasi` (Dropdown: Aset Lancar, Aset Tidak Lancar, Kewajiban Jangka Pendek, Kewajiban Jangka Panjang, Ekuitas, Pendapatan, Beban Pokok Penjualan, Beban Operasional, Beban Non-Operasional).
4. `Saldo Normal` (Dropdown: Debit / Kredit).
5. `Saldo Berjalan` (Calculated, read-only, rata kanan).
6. `Status` (Toggle switch: Aktif / Non-aktif).
7. `Aksi` (Icon: Tambah Sub-Akun / Hapus).

*Perilaku UX:* Baris terakhir pada setiap grup klasifikasi adalah *placeholder row* bertuliskan `+ Tambah Akun Baru...`. Mengetik angka di kolom kode langsung mendaftarkannya sebagai baris baru.

#### 4. Kolom Tabel pada Mode Saldo Awal (Dual Balance Mode)
1. `Kode Akun` (Monospace, frozen left, auto-indent).
2. `Nama Akun` (Text, read-only).
3. `Klasifikasi` (Badge text).
4. `Saldo Normal` (Badge: Debit / Kredit).
5. **`Saldo Awal: Debit (Rp)`** (Numeric editable, rata kanan).
6. **`Saldo Awal: Kredit (Rp)`** (Numeric editable, rata kanan).
7. `Saldo Berjalan Saat Ini (Rp)` (Calculated: Saldo Awal + Mutasi).
8. `Catatan / Dokumen Asal` (Text optional, misal "Opname Akhir Tahun 2025").

#### 5. Panel Validasi Bawah (Bottom Sticky Balance Bar)
- **Metrik:** Total Debit Awal, Total Kredit Awal, Selisih (Out of Balance).
- **Indikator Visual:**
  - *Jika Seimbang (Selisih = 0):* Latar hijau lembut (`#ECFDF5`), badge `✓ Seimbang (Balanced)`, tombol **"Simpan & Terapkan Saldo Awal"** aktif.
  - *Jika Tidak Seimbang (Selisih ≠ 0):* Latar merah muda (`#FEF2F2`), label merah terang (`#DC2626`), tombol Simpan non-aktif.
- **Tombol Auto-Balancing Equity:** Tombol **"Alokasikan Selisih ke Modal / Ekuitas Pembuka"** otomatis memasukkan selisih ke akun `3100 - Ekuitas Saldo Awal`.
- **UX Tambahan:** Tekan `Enter` otomatis memindahkan kursor ke kolom sesuai saldo normal akun tersebut. Menyimpan saldo awal otomatis men-generate **Jurnal Pembuka** sistem.

---

### Halaman 2: Jurnal Umum (General Journal Entry Grid)

#### 1. Tujuan Pengguna
Memasukkan transaksi jurnal penyesuaian (*adjusting journal*), penyusutan aset, dan pencatatan manual secara berpasangan dengan kecepatan tinggi.

#### 2. Komponen Layout
- **Header Form:** Tanggal Jurnal (Date), Nomor Referensi/Bukti (Text/Auto), Memo Singkat (Text).
- **Main Grid:** Tabel entri Debit-Kredit multi-baris.
- **Bottom Fixed Sticky Bar:** Panel validasi keseimbangan debit vs kredit.

#### 3. Spesifikasi Kolom Tabel
1. `No.` (Auto-number baris: 1, 2, 3...).
2. `Akun (Kode/Nama)` (Autocomplete input: ketik kode atau nama akun langsung memunculkan suggestion dropdown).
3. `Keterangan / Uraian` (Text input).
4. `Debit (Rp)` (Numeric input, format ribuan otomatis).
5. `Kredit (Rp)` (Numeric input, format ribuan otomatis).
6. `Hapus` (Icon sampah / shortcut `Delete` baris).

#### 4. Perilaku UX & Validasi
- Menekan tombol `Tab` pada kolom Kredit otomatis menambah baris kosong baru di bawahnya.
- *Bottom Fixed Bar* menampilkan `Total Debit`, `Total Kredit`, dan `Selisih`. Jika selisih ≠ Rp 0, label merah menyala (`#DC2626`) dan tombol "Posting Jurnal" berstatus *disabled*.

---

### Halaman 3: Ringkasan Penjualan & Pengakuan HPP Harian (POS Clearing)

#### 1. Tujuan Pengguna
Membukukan rekapitulasi omzet kasir harian dan nilai modal obat (HPP) tanpa menyalin ribuan struk satu per satu.

#### 2. Komponen Layout
- **Top Filter:** Pemilih Bulan & Tahun, Filter Shift (Semua / Shift 1 / Shift 2 / Shift 3).
- **Main Area:** Tabel rekap harian berurutan tanggal 1 sampai akhir bulan.

#### 3. Spesifikasi Kolom Tabel
1. `Tanggal` (Date, read-only/auto-populate berurutan).
2. `Kasir / Shift` (Dropdown / Text).
3. `Total Omzet POS (Rp)` (Input nominal atau auto-sync dari sistem POS).
4. `Penerimaan Tunai (Rp)` (Input nominal uang fisik tunai).
5. `Penerimaan QRIS / EDC (Rp)` (Input nominal transaksi non-tunai).
6. `Selisih Kas Fisik (Rp)` (Kalkulasi otomatis: *Penerimaan Tunai - (Total Omzet - Penerimaan Non-Tunai)*).
7. `Nilai HPP / COGS (Rp)` (Input nilai modal obat terjual harian).
8. `Status Jurnal` (Badge: *Draft* abu-abu, *Posted* hijau).
9. `Aksi Cepat` (Tombol "Generate Jurnal").

#### 4. Perilaku UX
Jika terdapat selisih kas fisik (kurang atau lebih), sel menampilkan badge peringatan kuning dan sistem otomatis menyertakan akun penampung `Selisih Kasir (Beban/Pendapatan Lain)` saat jurnal di-posting.

---

### Halaman 4: Faktur Pembelian PBF & Utang Usaha (AP Batch Ledger)

#### 1. Tujuan Pengguna
Memasukkan tumpukan lembaran faktur pembelian dari Pedagang Besar Farmasi (PBF) dalam satu sesi kerja cepat.

#### 2. Komponen Layout
- **Toolbar:** Tombol "Paste from Excel", Filter Status (*Belum Bayar, Lewat Tempo, Lunas*).
- **Main Grid:** Tabel pendaftaran faktur beruntun.

#### 3. Spesifikasi Kolom Tabel
1. `Tgl Faktur` (Date picker inline: DD/MM/YYYY).
2. `Tgl Jatuh Tempo` (Date picker inline: kalkulasi default berdasarkan termin).
3. `Nama PBF / Distributor` (Autocomplete combobox: Kimia Farma, Enseval, Mensa, Parit Padang, dll.).
4. `No. Faktur PBF` (Text input, mendeteksi duplikasi secara instan).
5. `DPP / Nilai Bersih (Rp)` (Numeric input).
6. `PPN 11% (Rp)` (Calculated: `DPP × 11%`, sel tetap dapat diedit jika faktur fisik ada pembulatan sen).
7. `Total Tagihan (Rp)` (Calculated otomatis: `DPP + PPN`).
8. `Termin Pembayaran` (Dropdown: Tunai, Tempo 14 Hari, Tempo 30 Hari, Tempo 45 Hari, Tempo 60 Hari).
9. `Akun Kas/Utang` (Dropdown CoA default: Utang Usaha PBF).
10. `Status Verifikasi` (Checkbox verifikasi fisik faktur & cap apoteker).

#### 4. Perilaku UX
Mendukung *multi-row copy-paste*. Pengguna dapat menyorot data di Excel lalu menekan `Ctrl + V` pada sel tabel untuk memetakan puluhan faktur secara instan.

---

### Halaman 5: Konsinyasi & Pembayaran Bagi Hasil (Consignment Ledger)

#### 1. Tujuan Pengguna
Menghitung kewajiban utang dan eksekusi pembayaran bagi hasil kepada vendor pemilik barang titip jual (suplemen herbal, alkes, madu).

#### 2. Komponen Layout
- **Top Filter:** Dropdown Vendor Konsinyasi, Filter Periode Rekonsiliasi.
- **Main Area:** Tabel status barang titip jual dan nilai bagi hasil.

#### 3. Spesifikasi Kolom Tabel
1. `Checkbox` (Multi-select baris untuk pembayaran massal).
2. `Nama Vendor Pemilik` (Text / Grouping).
3. `Nama Produk` (Text).
4. `Qty Terjual` (Numeric input).
5. `Harga Kesepakatan Bagi Hasil (Rp)` (Numeric).
6. `Total Utang Konsinyasi (Rp)` (Calculated: `Qty × Harga Bagi Hasil`).
7. `Metode Bayar` (Dropdown CoA: Kas Toko, Bank BCA, Bank Mandiri).
8. `No. Referensi Transfer` (Text input).
9. `Status Bayar` (Badge: *Siap Bayar / Sudah Lunas*).

#### 4. Perilaku UX
Saat beberapa baris dicentang, muncul **Floating Action Bar** di bagian bawah layar:
`Selesaikan Tagihan Terpilih (X Item) — Total: Rp Y` dengan tombol 1-klik untuk menyelesaikan pembayaran dan membentuk jurnal kas keluar otomatis.

---

### Halaman 6: Kas, Bank & Mutasi Rekening (Cash & Bank Register)

#### 1. Tujuan Pengguna
Mencatat mutasi kas operasional, setoran tunai harian ke bank, penarikan tunai, dan transfer antar rekening bisnis beserta biaya admin.

#### 2. Komponen Layout
- **Header Summary:** Tiga kartu saldo berdampingan (Kas Toko, Bank Operasional 1, Bank Operasional 2).
- **Main Grid:** Tabel log mutasi dan pemindahan dana.

#### 3. Spesifikasi Kolom Tabel
1. `Tanggal & Jam` (Datetime picker).
2. `Tipe Transaksi` (Dropdown: Setoran Kas ke Bank, Transfer Antar Bank, Biaya Operasional, Pemasukan Lain).
3. `Akun Sumber (Kredit)` (Dropdown CoA: misal Kas Toko).
4. `Akun Tujuan (Debit)` (Dropdown CoA: misal Bank BCA).
5. `Nominal Bersih (Rp)` (Numeric input).
6. `Biaya Admin Bank (Rp)` (Numeric input, default: 0 atau 6.500 / 2.500 BI-FAST).
7. `Total Berkurang dari Sumber (Rp)` (Calculated: `Nominal + Biaya Admin`).
8. `Nomor Referensi Transaksi` (Text input mutasi bank).
9. `Catatan / Berita Transfer` (Text input).

#### 4. Perilaku UX
Pengisian baris langsung membentuk mutasi ganda (*double-entry*) di buku besar secara instan.

---

### Halaman 7: Rekonsiliasi Bank (Bank Reconciliation Split-Grid)

#### 1. Tujuan Pengguna
Mencocokkan mutasi rekening koran bank (*bank statement*) dengan pencatatan pembukuan internal sistem secara visual.

#### 2. Layout Komponen
- **Dual Pane Split View:**
  - *Pane Kiri (Buku Kas/Bank Internal):* Tanggal | Deskripsi | Masuk | Keluar | Checkbox Match.
  - *Pane Kanan (Rekening Koran Bank):* Tanggal | Keterangan Bank | Debit | Kredit | Checkbox Match.
- **Bottom Bar:** Status Keselarasan (Total Internal vs Total Bank, Selisih Belum Cocok).

#### 3. Perilaku UX
- Tombol **"Auto-Match"**: Sistem otomatis mencentang pasangan baris jika tanggal berada pada rentang ±1 hari dengan nominal identik.
- **Manual Link Matching**: Memilih satu baris di panel kiri dan satu baris di panel kanan lalu menekan tombol **"Cocokkan (Link)"** di tengah layar.

---

### Halaman 8: Laporan Keuangan Dinamis & Drill-Down

#### 1. Tujuan Pengguna
Menganalisis Laba Rugi Komparatif, Neraca Keuangan, dan Neraca Saldo dengan kemampuan inspeksi rincian transaksi hingga ke level jurnal.

#### 2. Komponen Layout
- **Top Control:** Tab Jenis Laporan (Laba Rugi, Neraca, Neraca Saldo), Rentang Tanggal, Filter Periode Komparasi (*Bulan Ini vs Bulan Lalu / Tahun Berjalan vs Tahun Lalu*).
- **Main Area:** Multi-level hierarchical tree table.

#### 3. Spesifikasi Kolom (Model Laba Rugi Komparatif)
1. `Deskripsi / Akun` (Tree list: Pendapatan Operasional, HPP Obat Resep, HPP Obat Bebas, Beban Operasional, dll.).
2. `Bulan Berjalan (Rp)` (Rata kanan, monospace).
3. `Bulan Sebelumnya (Rp)` (Rata kanan, monospace).
4. `Pertumbuhan / Varians (%)` (Rata kanan, teks hijau jika positif, merah jika negatif).

#### 4. Perilaku UX (Drill-Down Drawer)
Setiap angka nominal pada laporan bersifat interaktif (*clickable*). Mengklik angka akan membuka **Slide-over Drawer** dari sisi kanan layar yang menampilkan seluruh daftar entri jurnal dan transaksi asal pembentuk nominal tersebut.

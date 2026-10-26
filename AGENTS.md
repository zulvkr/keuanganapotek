# Petunjuk untuk agent

Proyek ini menggunakan `oxfmt` sebagai formatter dan `oxlint` sebagai linter.

Sebelum menyerahkan perubahan:

1. Jalankan `pnpm run fmt` untuk memformat file yang didukung.
2. Jalankan `pnpm run check` untuk memastikan format, lint, dan typecheck lulus.

Jika hanya ingin memeriksa tanpa mengubah file, gunakan `pnpm run fmt:check`.
Perbaiki temuan lint yang relevan dengan `pnpm run lint:fix`, lalu tinjau semua
perubahan otomatis sebelum melanjutkan. Jangan menonaktifkan aturan lint secara
global untuk menyembunyikan error; gunakan pengecualian lokal hanya jika memang
dibutuhkan dan beri alasan singkat.

## Aturan Tata Letak UI & Toolbar (Layout Rules)

- **Dilarang Menambah Extra Row Dinamis untuk Reset Filter/Sort:**
  Tombol reset filter dan sort **TIDAK BOLEH** diletakkan pada baris tambahan (_extra row_) terpisah yang muncul-hilang secara dinamis di bawah toolbar atau di atas tabel. Hal ini menyebabkan _layout shift_ yang menggeser tata letak tabel dan mengacaukan perhitungan tinggi dinamis (_viewport height_).
- **Penempatan Inline pada Toolbar Utama:**
  Kontrol filter, indikator aktif, dan tombol reset harus terintegrasi langsung secara _inline_ pada baris toolbar utama (_primary toolbar row_) atau di dalam popover masing-masing kolom.
- **Komentar Kode Wajib:**
  Setiap komponen toolbar atau kontrol filter/sort harus menyertakan komentar penjelasan terkait aturan _anti-extra-row_ ini.

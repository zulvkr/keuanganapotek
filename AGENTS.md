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

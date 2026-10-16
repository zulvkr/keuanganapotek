# Sistem Keuangan Apotek (Pharmacy Financial Application)

Aplikasi manajemen finansial dan akuntansi modern yang dirancang khusus untuk operasional apotek. Sistem ini mengadopsi prinsip _double-entry accounting_ otomatis, arsitektur Master Transaksi dengan skema metadata dinamis, pencatatan transaksi harian cepat, pengelolaan Bagan Akun (CoA) & Saldo Awal, Jurnal Umum, serta Laporan Keuangan interaktif dengan kemampuan _drill-down_.

---

## 📁 Struktur Proyek Monorepo

```text
KeuanganApotek/
├── apps/
│   ├── api/                           # Backend Server (Hono + SQLite + Drizzle ORM)
│   │   ├── src/
│   │   │   ├── db/                    # Client SQLite, Skema Drizzle, Migrasi, Seed & Backup
│   │   │   ├── services/              # Service Buku Besar, Transaksi, CoA, Laporan, Period Lock, Audit
│   │   │   ├── app.ts                 # Definisi REST API endpoints & route handlers
│   │   │   └── server.ts              # Bootstrap server Hono Node.js
│   │   └── package.json
│   │
│   └── web/                           # Frontend Client (Vite + React + Tailwind CSS + TanStack)
│       ├── src/
│       │   ├── components/            # Virtualized grid, Dynamic metadata form/builder, Drill-down drawer
│       │   ├── pages/                 # Halaman Buku Transaksi, Laporan, Advanced (Master Transaksi, Jurnal, CoA, Pengaturan)
│       │   ├── lib/                   # API client, React Query hooks & mutations
│       │   └── App.tsx                # Routing & layout aplikasi
│       └── package.json
│
├── packages/
│   └── shared/                        # Shared Types, Zod Schemas & Financial Math (decimal.js)
│       ├── src/
│       │   ├── schemas/               # Zod validation schemas
│       │   ├── types/                 # Inferred TypeScript types
│       │   └── math/                  # Kalkulasi presisi finansial & konversi sen
│       └── package.json
│
├── AGENTS.md                          # Pedoman kontribusi AI & standar kode (oxfmt & oxlint)
├── package.json                       # Root Workspace Configuration
└── pnpm-workspace.yaml                # Monorepo Workspace Definitions
```

---

## 🧭 Ringkasan Modul Aplikasi

1. **Buku Transaksi (`/transaksi`)**
   - Pencatatan transaksi harian operasional apotek secara cepat berdasarkan template Master Transaksi.
   - Formulir metadata dinamis (_Dynamic Metadata Form_) yang otomatis menyesuaikan field kustom per jenis transaksi.
   - Otomatisasi pembentukan jurnal ganda (_double-entry_) dan ringkasan Neraca harian.

2. **Laporan Keuangan Dinamis & Drill-Down (`/laporan-keuangan`)**
   - Laporan Laba Rugi Komparatif (dengan analisis pertumbuhan/varians), Neraca (_Balance Sheet_), dan Neraca Saldo (_Trial Balance_).
   - _Interactive Drill-Down Drawer_: Mengklik angka nominal akun membuka slide-over drawer berisi rincian jurnal transaksi pembentuknya.

3. **Advanced (`/advanced`)**
   - Modul pengaturan mendalam dan konfigurasi akuntansi tingkat lanjut yang terorganisasi dalam tab:
     - **Master Transaksi (`/master-transaksi`)**: Katalog tipe transaksi & _Metadata Schema Builder_ visual.
     - **Jurnal Umum (`/jurnal`)**: Entri jurnal berpasangan manual dengan sticky balance bar & navigasi keyboard.
     - **Bagan Akun (CoA) & Saldo Awal (`/coa`)**: Tata kelola hierarki akun, input saldo awal per cut-off, & auto-balancing equity.
     - **Pengaturan & Identitas (`/pengaturan`)**: Identitas apotek, buku kas/bank, status arsitektur akuntansi & keamanan.

---

## 🛠️ Arsitektur Teknologi (Tech Stack)

- **Frontend:** Vite + React 19 (TypeScript), TanStack Query, TanStack Virtual, Tailwind CSS, Lucide React.
- **Backend:** Node.js + Hono Server (REST API).
- **Database:** SQLite (Mode WAL, `PRAGMA synchronous = NORMAL`, `PRAGMA foreign_keys = ON`, `PRAGMA busy_timeout = 5000`).
- **ORM:** Drizzle ORM (`better-sqlite3`).
- **Financial Precision:** `decimal.js` (Penyimpanan integer sen/minor units di database untuk menjamin presisi tanpa pembulatan _floating point_).
- **Validation:** Zod (Shared schemas antara backend dan frontend di paket `@keuangan-apotek/shared`).
- **Code Quality:** `oxfmt` (formatter) & `oxlint` (linter).

---

## 🚀 Panduan Memulai (Getting Started)

### Prasyarat

- Node.js `^20.0.0` atau `^22.0.0`
- pnpm `^10.0.0`

### Instalasi & Menjalankan Aplikasi

1. **Install dependensi:**

   ```powershell
   pnpm install
   ```

2. **Inisialisasi Database (Migrasi & Seed):**

   ```powershell
   pnpm run db:migrate
   pnpm run db:seed
   ```

3. **Jalankan Aplikasi Mode Development:**
   ```powershell
   pnpm dev
   ```

### Menjalankan Banyak Dev Instance

`pnpm dev` otomatis mendeteksi dan memilih port kosong untuk API dan web, memungkinkan beberapa worktree dijalankan bersamaan pada mesin yang sama.

Untuk mengunci port tertentu pada worktree, set variabel lingkungan sebelum menjalankan:

```powershell
$env:API_PORT = "3101"
$env:WEB_PORT = "5274"
pnpm dev
```

Variabel lingkungan yang didukung:

- `API_PORT`: Port server API (default mulai dari `3000`).
- `WEB_PORT`: Port Vite client (default mulai dari `5173`).
- `VITE_API_URL`: URL API kustom jika backend dijalankan di host/port terpisah.
- `DATABASE_PATH`: Lokasi file database SQLite per instance jika diperlukan.

---

## 🐳 Deployment Menggunakan Docker Compose & Caddy Docker Proxy

Aplikasi ini siap dideploy dalam mode multi-instance pada 1 VPS menggunakan **caddy-docker-proxy** dan dikelola melalui **Dockhand** (atau Portainer / Docker Compose biasa).

### 🚀 Menjalankan Multi-Instance via Dockhand

Setiap instance aplikasi (misalnya Apotek Cabang 1 dan Cabang 2) didaftarkan sebagai **Stack terpisah** di Dockhand.

#### Stack 1 (Contoh: `apotek-cabang1`)

1. Di Dockhand, buat stack baru bernama `apotek-cabang1`.
2. Gunakan `docker-compose.yml` dari repositori ini.
3. Di tab **Environment Variables**, isi:
   ```env
   APP_URL=cabang1.apotek.com
   CADDY_NETWORK=caddy
   AUTH_SECRET=rahasia-unik-cabang-1-2026
   ```
4. Klik **Deploy**. Caddy Docker Proxy akan otomatis mendeteksi domain dan mengalihkan traffic HTTPS ke kontainer web cabang 1.
5. Buka `https://cabang1.apotek.com` di browser. Karena belum ada pengguna terdaftar, sistem akan otomatis menampilkan **Setup Wizard** untuk membuat akun Administrator (dan Asisten Kasir awal).

#### Stack 2 (Contoh: `apotek-cabang2`)

1. Buat stack baru kedua bernama `apotek-cabang2`.
2. Gunakan `docker-compose.yml` yang sama.
3. Di tab **Environment Variables**, isi:
   ```env
   APP_URL=cabang2.apotek.com
   CADDY_NETWORK=caddy
   AUTH_SECRET=rahasia-unik-cabang-2-2026
   ```
4. Klik **Deploy**.

### 🔒 Isolasi Antar-Instance

- **Volume Data Terpisah:** Docker Compose otomatis menamai volume data berdasarkan nama stack (`<project>_apotek_data`), sehingga database SQLite masing-masing instance terisolasi 100%.
- **Tanpa Konflik Port Host:** Kontainer tidak mengikat port 80/3000 host, melainkan berkomunikasi lewat jaringan internal Caddy (`caddy`).
- **SSL / HTTPS Otomatis:** Dikelola sepenuhnya oleh Caddy melalui label `caddy: ${APP_URL}`.

### 💻 Pengujian Lokal Tanpa Caddy Docker Proxy

Jika ingin menjalankan secara lokal di komputer pengembang:

```powershell
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

Aplikasi akan tersedia langsung di `http://localhost`.

---

## 🧪 Validasi & Pengujian

Sebelum mengajukan perubahan kode, pastikan seluruh pemeriksaan kualitas lulus:

```powershell
# Format kode
pnpm run fmt

# Periksa format, lint, dan typecheck
pnpm run check

# Jalankan automated tests
pnpm test
```

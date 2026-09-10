# Arsitektur & Rencana Pengembangan (Architecture & Roadmap)
## Sistem Keuangan Apotek (Full-Stack TypeScript & SQLite)

---

## 1. Arsitektur Teknologi Terpilih (Tech Stack)

Untuk memenuhi kriteria *high-speed data grid*, navigasi keyboard instan, *zero-loss financial math*, dan *end-to-end type safety* antara Backend dan Frontend:

### Frontend (SPA Client)
- **Framework:** React 18/19 + TypeScript (Vite).
- **Data Grid Engine:** TanStack Table (v8) + Virtualizer (untuk rendering ribuan baris instan).
- **State Management & Server Cache:** TanStack Query (React Query) + Zustand (untuk local grid dirty state & undo/redo).
- **Type-Safe RPC Client:** `@trpc/client` / `@trpc/react-query` (atau Hono RPC Client).
- **Styling & UI Kit:** Tailwind CSS + Radix UI / Lucide React.
- **Form & Input Validation:** Zod + React Hook Form.
- **Keyboard Shortcut Handling:** `react-hotkeys-hook` & custom cell keydown listener.

### Backend & API Layer
- **Runtime & Server:** Node.js / Bun + Hono / Fastify / tRPC Server.
- **Type-Safety Layer:** tRPC / Hono RPC + Zod (100% compile-time type safety tanpa generator eksternal).
- **Financial Math Engine:** `decimal.js` / `dinero.js` (perhitungan PPN 11%, DPP, bagi hasil konsinyasi, dan balancing journal).
- **Database:** SQLite (Mode WAL, `PRAGMA busy_timeout = 5000`, `PRAGMA foreign_keys = ON`).
- **ORM / Query Builder:** Drizzle ORM (`drizzle-orm/better-sqlite3` atau `drizzle-orm/libsql`).
- **Audit & Security:** JWT / Session Authentication, Role-Based Access Control (Apoteker Pengelola, Kasir, Akuntan, Owner).

---

## 2. Struktur Folder Proyek Monorepo (pnpm workspace)

```text
KeuanganApotek/
├── docs/                               # Dokumentasi Spesifikasi & Panduan
│   ├── 01_PRD.md
│   ├── 02_UI_UX_SPECIFICATION.md
│   ├── 03_ACCOUNTING_LOGIC_AND_COA.md
│   ├── 04_DATABASE_SCHEMA.md
│   ├── 05_DEVELOPMENT_ROADMAP.md
│   └── 06_AI_PHASED_DEVELOPMENT_GOALS.md
├── apps/
│   ├── api/                            # Backend Server (tRPC / Hono + Drizzle + SQLite)
│   │   ├── src/
│   │   │   ├── db/                     # Drizzle schema, client, migrations & seed
│   │   │   │   ├── schema/             # accounts, journals, invoices, clearings, etc.
│   │   │   │   └── client.ts           # SQLite connection & WAL PRAGMA setup
│   │   │   ├── routers/                # tRPC routers (coa, journal, pos, pbf, recon, reports)
│   │   │   ├── services/               # Core Accounting Services (Double-entry engine)
│   │   │   ├── context.ts              # Request context & Auth
│   │   │   └── server.ts               # Server bootstrap
│   │   └── package.json
│   │
│   └── web/                            # Frontend Client (Vite + React + Tailwind + TanStack)
│       ├── src/
│       │   ├── components/
│       │   │   ├── grid/               # High-speed data grid & sticky balance bar
│       │   │   ├── layout/             # Sidebar, Header, Breadcrumbs
│       │   │   └── ui/                 # Buttons, Badges, Modals, Drawers
│       │   ├── hooks/                  # useKeyboardNav, useUndoRedo, useExcelPaste
│       │   ├── pages/                  # CoA, General Journal, POS, PBF, Recon, Reports
│       │   ├── utils/                  # Format rupiah (tabular-nums), date helpers
│       │   ├── lib/                    # tRPC client provider & TanStack Query setup
│       │   └── App.tsx
│       └── package.json
│
├── packages/
│   └── shared/                         # Shared Types, Zod Schemas & Financial Calculations
│       ├── src/
│       │   ├── schemas/                # Zod schemas (AccountSchema, JournalEntrySchema, etc.)
│       │   ├── types/                  # Inferred TypeScript types
│       │   └── math/                   # Decimal.js calculations (PPN, DPP, balances)
│       └── package.json
│
├── drizzle.config.ts                   # Drizzle Kit Configuration
├── package.json                        # Root Workspace Configuration
└── pnpm-workspace.yaml                 # Monorepo Workspace Definitions
```

---

## 3. Rencana Tahapan Pengembangan (Milestones)

### Fase 1: Fondasi Inti & Master Akun (Minggu 1-2)
- [ ] Setup monorepo `pnpm`, Vite React, Tailwind CSS, tRPC backend, dan Drizzle ORM dengan SQLite.
- [ ] Implementasi Database Schema SQLite (Drizzle ORM) & Migrasi.
- [ ] Modul 1: Bagan Akun (CoA) Tree-Grid (tambah, edit inline, hapus sub-akun).
- [ ] Modul 1: Fitur Mode Saldo Awal, Sticky Balance Bar, dan Auto-Balancing Equity.

### Fase 2: Mesin Jurnal & Transaksi Operasional Kasir/PBF (Minggu 3-4)
- [ ] Modul 2: Jurnal Umum Multi-Row Grid dengan validasi keseimbangan real-time.
- [ ] Modul 3: POS Clearing (Rekap omzet kasir, penerimaan tunai/non-tunai, perhitungan selisih kas fisik, dan HPP).
- [ ] Modul 4: PBF Batch Ledger (Fitur paste Excel `Ctrl+V`, kalkulasi DPP + PPN 11%, deteksi duplikasi nomor faktur).

### Fase 3: Konsinyasi, Kas/Bank & Rekonsiliasi (Minggu 5-6)
- [ ] Modul 5: Konsinyasi (Perhitungan bagi hasil & batch settlement bar).
- [ ] Modul 6: Kas & Bank Register (Setoran kas toko, transfer bank, pencatatan mutasi ganda).
- [ ] Modul 7: Rekonsiliasi Bank Dual-Pane Split View & Algoritma *Auto-Match*.

### Fase 4: Laporan Keuangan Dinamis, Drill-Down & Finalisasi (Minggu 7-8)
- [ ] Modul 8: Laporan Laba Rugi Komparatif, Neraca, Neraca Saldo.
- [ ] Implementasi Slide-Over Drawer untuk drill-down jurnal pembentuk angka laporan.
- [ ] Pengujian performa data grid (> 5.000 baris) dan pengujian audit trail pembukuan.


export type MetadataFieldType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "date"
  | "select"
  | "multi-select"
  | "boolean";

export type MetadataFieldDefinition = {
  key: string;
  label: string;
  type: MetadataFieldType;
  required?: boolean;
  defaultValue?: any;
  placeholder?: string;
  options?: string[];
  width?: "full" | "half";
  helpText?: string;
};

export type CustomFieldDataType = "string" | "number" | "date" | "enum";

export type CustomFieldContract = {
  key: string;
  label: string;
  dataType: CustomFieldDataType;
  required: boolean;
  options?: string[];
};

export function toCustomFieldsContract(
  schema: ReadonlyArray<MetadataFieldDefinition> = [],
): CustomFieldContract[] {
  return schema.map((field) => {
    let dataType: CustomFieldDataType = "string";
    if (field.type === "number" || field.type === "currency") {
      dataType = "number";
    } else if (field.type === "date") {
      dataType = "date";
    } else if (
      (field.type === "select" || field.type === "multi-select") &&
      field.key !== "shift"
    ) {
      dataType = "enum";
    }

    const contract: CustomFieldContract = {
      key: field.key,
      label: field.label,
      dataType,
      required: Boolean(field.required),
    };
    if (dataType === "enum" && field.options && field.options.length > 0) {
      contract.options = field.options;
    }
    return contract;
  });
}

export const DEFAULT_SALES_METADATA_SCHEMA: MetadataFieldDefinition[] = [
  {
    key: "shift",
    label: "Shift",
    type: "select",
    options: ["Pagi", "Siang", "Malam"],
    required: true,
    width: "half",
  },
  {
    key: "nama_pelanggan",
    label: "Nama Pelanggan / Pasien",
    type: "text",
    required: false,
    placeholder: "Nama pelanggan / pasien (opsional)",
    width: "half",
  },
  {
    key: "jatuh_tempo",
    label: "Jatuh Tempo",
    type: "date",
    required: false,
    width: "half",
  },
];

export const DEFAULT_EXPENSE_METADATA_SCHEMA: MetadataFieldDefinition[] = [
  {
    key: "deskripsi",
    label: "Deskripsi",
    type: "text",
    required: true,
    placeholder: "Deskripsi keperluan / biaya operasional",
    width: "full",
  },
  {
    key: "penerima",
    label: "Penerima / Karyawan / Toko",
    type: "text",
    required: false,
    placeholder: "Nama penerima, karyawan, merchant, atau toko",
    width: "half",
  },
  {
    key: "periode",
    label: "Periode",
    type: "text",
    required: false,
    placeholder: "Contoh: Juli 2026",
    width: "half",
  },
  {
    key: "jumlah",
    label: "Jumlah",
    type: "number",
    required: false,
    placeholder: "0",
    width: "half",
  },
  {
    key: "satuan",
    label: "Satuan",
    type: "text",
    required: false,
    placeholder: "pcs / unit / bulan / orang",
    width: "half",
  },
];

export const DEFAULT_RECEIVABLE_PAYMENT_METADATA_SCHEMA: MetadataFieldDefinition[] = [
  {
    key: "nama_pelanggan",
    label: "Nama Pelanggan / Pasien",
    type: "text",
    required: true,
    placeholder: "Nama pelanggan / pasien",
    width: "half",
  },
  {
    key: "no_kuitansi",
    label: "No. Kuitansi / Referensi",
    type: "text",
    required: false,
    placeholder: "No. kuitansi atau bukti bayar",
    width: "half",
  },
];

export const DEFAULT_DEBT_PAYMENT_METADATA_SCHEMA: MetadataFieldDefinition[] = [
  {
    key: "nama_supplier",
    label: "Nama Supplier",
    type: "text",
    required: false,
    placeholder: "Nama supplier PBF (jika hutang dagang)",
    width: "half",
  },
  {
    key: "nama_vendor",
    label: "Nama Vendor",
    type: "text",
    required: false,
    placeholder: "Nama vendor konsinyasi (jika hutang konsinyasi)",
    width: "half",
  },
  {
    key: "no_faktur",
    label: "No. Faktur",
    type: "text",
    required: false,
    placeholder: "Nomor faktur / bukti bayar",
    width: "half",
  },
  {
    key: "periode_rekap",
    label: "Periode Rekap",
    type: "date",
    required: false,
    width: "half",
  },
  {
    key: "total_pelunasan",
    label: "Total Pelunasan",
    type: "currency",
    required: false,
    placeholder: "0",
    width: "half",
  },
];

export const DEFAULT_CONSIGNMENT_METADATA_SCHEMA: MetadataFieldDefinition[] =
  DEFAULT_DEBT_PAYMENT_METADATA_SCHEMA;

export const DEFAULT_PURCHASE_METADATA_SCHEMA: MetadataFieldDefinition[] = [
  {
    key: "nama_supplier",
    label: "Nama Supplier",
    type: "text",
    required: true,
    placeholder: "Nama distributor / supplier PBF",
    width: "full",
  },
  {
    key: "no_faktur",
    label: "No. Faktur",
    type: "text",
    required: false,
    placeholder: "Nomor faktur pembelian (opsional)",
    width: "half",
  },
  {
    key: "tgl_terima_barang",
    label: "Tanggal Terima Barang",
    type: "date",
    required: false,
    width: "half",
  },
  {
    key: "jatuh_tempo",
    label: "Waktu Jatuh Tempo",
    type: "date",
    required: false,
    width: "half",
  },
];

export const DEFAULT_PURCHASE_COD_METADATA_SCHEMA: MetadataFieldDefinition[] =
  DEFAULT_PURCHASE_METADATA_SCHEMA;

export const DEFAULT_PURCHASE_TEMPO_METADATA_SCHEMA: MetadataFieldDefinition[] =
  DEFAULT_PURCHASE_METADATA_SCHEMA;

export const DEFAULT_TRANSFER_METADATA_SCHEMA: MetadataFieldDefinition[] = [
  {
    key: "deskripsi",
    label: "Deskripsi",
    type: "text",
    required: false,
    placeholder: "Keterangan mutasi / transfer dana antar akun kas & bank",
    width: "full",
  },
];

export type MetadataPresetTemplate = {
  id: string;
  name: string;
  description: string;
  schema: MetadataFieldDefinition[];
};

export const METADATA_PRESET_TEMPLATES: MetadataPresetTemplate[] = [
  {
    id: "penjualan",
    name: "Penjualan (Shift)",
    description: "Shift kasir, nama pelanggan (opsional), dan jatuh tempo kasbon (opsional)",
    schema: DEFAULT_SALES_METADATA_SCHEMA,
  },
  {
    id: "biaya_operasional",
    name: "Biaya Operasional",
    description: "Deskripsi keperluan, penerima, jumlah, dan satuan biaya",
    schema: DEFAULT_EXPENSE_METADATA_SCHEMA,
  },
  {
    id: "pelunasan_kasbon",
    name: "Pelunasan Kasbon",
    description: "Nama pelanggan / pasien dan no kuitansi pembayaran kasbon",
    schema: DEFAULT_RECEIVABLE_PAYMENT_METADATA_SCHEMA,
  },
  {
    id: "pembayaran_hutang",
    name: "Pembayaran Hutang",
    description: "Nama supplier/vendor, no faktur, periode rekap, dan total pelunasan",
    schema: DEFAULT_DEBT_PAYMENT_METADATA_SCHEMA,
  },
  {
    id: "pembelian_persediaan",
    name: "Pembelian Persediaan",
    description:
      "Nama supplier, no faktur, tgl terima barang, dan jatuh tempo (opsional untuk COD)",
    schema: DEFAULT_PURCHASE_METADATA_SCHEMA,
  },
  {
    id: "transfer_antar_akun",
    name: "Transfer Antar Akun",
    description: "Keterangan mutasi / deskripsi transfer kas & bank",
    schema: DEFAULT_TRANSFER_METADATA_SCHEMA,
  },
];

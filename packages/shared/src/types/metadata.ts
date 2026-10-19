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
    label: "Nama Supplier / Vendor",
    type: "text",
    required: true,
    placeholder: "Nama supplier PBF / vendor konsinyasi",
    width: "full",
  },
  {
    key: "no_faktur",
    label: "No. Faktur",
    type: "text",
    required: false,
    placeholder: "Nomor faktur pembelian",
    width: "half",
  },
];

export const DEFAULT_PURCHASE_COD_METADATA_SCHEMA: MetadataFieldDefinition[] = [
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
    placeholder: "Nomor faktur pembelian",
    width: "half",
  },
  {
    key: "tanggal_order",
    label: "Tanggal Order",
    type: "date",
    required: false,
    width: "half",
  },
  {
    key: "total_order",
    label: "Total Order",
    type: "currency",
    required: false,
    placeholder: "0",
    width: "half",
  },
  {
    key: "tgl_terima_barang",
    label: "Tanggal Terima Barang",
    type: "date",
    required: false,
    width: "half",
  },
];

export const DEFAULT_PURCHASE_TEMPO_METADATA_SCHEMA: MetadataFieldDefinition[] = [
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
    required: true,
    placeholder: "Nomor faktur distributor",
    width: "half",
  },
  {
    key: "tanggal_order",
    label: "Tanggal Order",
    type: "date",
    required: false,
    width: "half",
  },
  {
    key: "total_order",
    label: "Total Order",
    type: "currency",
    required: false,
    placeholder: "0",
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
    required: true,
    width: "half",
  },
];

export const DEFAULT_CONSIGNMENT_METADATA_SCHEMA: MetadataFieldDefinition[] = [
  {
    key: "nama_vendor",
    label: "Nama Vendor",
    type: "text",
    required: true,
    placeholder: "Nama vendor / pemilik barang konsinyasi",
    width: "full",
  },
  {
    key: "no_faktur",
    label: "No. Faktur / Bukti Titip",
    type: "text",
    required: true,
    placeholder: "Nomor faktur titip atau bagi hasil",
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
    description: "Metadata penjualan shift tanpa nomor struk atau pesanan",
    schema: DEFAULT_SALES_METADATA_SCHEMA,
  },
  {
    id: "biaya_operasional",
    name: "Biaya Operasional",
    description: "Deskripsi keperluan, jumlah, dan satuan biaya",
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
    description: "Nama supplier PBF / vendor konsinyasi dan no faktur",
    schema: DEFAULT_DEBT_PAYMENT_METADATA_SCHEMA,
  },
  {
    id: "pembelian_cod",
    name: "Pembelian COD",
    description: "Tanggal order, total order, tgl terima, no faktur, nama supplier",
    schema: DEFAULT_PURCHASE_COD_METADATA_SCHEMA,
  },
  {
    id: "pembelian_tempo",
    name: "Pembelian Tempo",
    description:
      "Tanggal order, total order, tgl terima, no faktur, nama supplier, waktu jatuh tempo",
    schema: DEFAULT_PURCHASE_TEMPO_METADATA_SCHEMA,
  },
  {
    id: "konsinyasi",
    name: "Konsinyasi (Vendor)",
    description: "Nama vendor, no faktur titip, periode rekap, total pelunasan",
    schema: DEFAULT_CONSIGNMENT_METADATA_SCHEMA,
  },
];

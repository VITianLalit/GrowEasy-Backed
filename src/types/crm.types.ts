export const CRM_STATUS_VALUES = [
  'GOOD_LEAD_FOLLOW_UP',
  'DID_NOT_CONNECT',
  'BAD_LEAD',
  'SALE_DONE',
] as const;

export type CrmStatus = (typeof CRM_STATUS_VALUES)[number];

export const DATA_SOURCE_VALUES = [
  'leads_on_demand',
  'meridian_tower',
  'eden_park',
  'varah_swamy',
  'sarjapur_plots',
] as const;

export type DataSource = (typeof DATA_SOURCE_VALUES)[number];

/** A raw row parsed directly from the uploaded CSV, header -> cell value. */
export type RawRow = Record<string, string>;

/** A single CRM record in GrowEasy's canonical import format. */
export interface CrmRecord {
  created_at: string | null;
  name: string | null;
  email: string | null;
  country_code: string | null;
  mobile_without_country_code: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lead_owner: string | null;
  crm_status: CrmStatus | '' | null;
  crm_note: string | null;
  data_source: DataSource | '' | null;
  possession_time: string | null;
  description: string | null;
}

/** Raw shape returned by the LLM before normalization/validation. */
export interface AiExtractedRecord extends Partial<CrmRecord> {
  original_row_index: number;
  skip: boolean;
  skip_reason?: string | null;
}

export interface SkippedRecord {
  original_row_index: number;
  reason: string;
  raw_row: RawRow;
}

export interface ImportSummary {
  importId: string;
  totalRows: number;
  totalImported: number;
  totalSkipped: number;
  imported: CrmRecord[];
  skipped: SkippedRecord[];
  batches: {
    total: number;
    failed: number;
  };
  persisted: boolean;
}

export interface CsvPreviewResult {
  headers: string[];
  rows: RawRow[];
  totalRows: number;
  truncated: boolean;
}

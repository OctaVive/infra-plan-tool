const API_BASE = import.meta.env.VITE_API_URL || "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail));
  }
  if (res.headers.get("content-type")?.includes("text/csv")) {
    return (await res.text()) as T;
  }
  return res.json();
}

export interface ReportUpload {
  id: string;
  uploaded_at: string;
  report_date: string | null;
  filename: string;
  orders_imported: number;
  changes_detected: number;
  sla_risk_count: number;
  is_first_upload: boolean;
  warnings: string | null;
}

export interface OrderDetail {
  order_number: string;
  line_type: string;
  geplaatst_op: string;
  previous_gepland: string | null;
  new_gepland: string;
  sla_deadline: string | null;
  days_shifted: number | null;
  sla_days_over: number | null;
  is_sla_risk: boolean;
  is_new_order: boolean;
}

export interface CustomerCard {
  bedrijf: string;
  has_change: boolean;
  has_sla_risk: boolean;
  order_count: number;
  orders: OrderDetail[];
}

export interface Dashboard {
  last_upload: ReportUpload | null;
  customers: CustomerCard[];
}

export interface Kpi {
  sla_risk_count: number;
  changes_detected: number;
  orders_imported: number;
  last_upload_at: string | null;
}

export interface OrderChange {
  id: string;
  report_upload_id: string;
  order_number: string;
  bedrijf: string;
  line_type: string;
  geplaatst_op: string;
  previous_gepland: string | null;
  new_gepland: string;
  sla_deadline: string | null;
  days_shifted: number | null;
  sla_days_over: number | null;
  is_date_moved_later: boolean;
  is_sla_risk: boolean;
  is_new_order: boolean;
  created_at: string;
}

export interface PaginatedChanges {
  items: OrderChange[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface Settings {
  sla_days: Record<string, number>;
  sla_configured: boolean;
  retention_days: number;
}

export interface ClearDataResult {
  changes_deleted: number;
  orders_deleted: number;
  uploads_deleted: number;
  message: string;
}

export const api = {
  getDashboard: () => request<Dashboard>("/api/v1/dashboard"),
  getKpi: () => request<Kpi>("/api/v1/dashboard/kpi"),
  getLatestReport: () => request<ReportUpload | null>("/api/v1/reports/latest"),
  uploadReport: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<ReportUpload>("/api/v1/reports/upload", { method: "POST", body: form });
  },
  getChanges: (params: URLSearchParams) =>
    request<PaginatedChanges>(`/api/v1/changes?${params}`),
  exportChanges: (params: URLSearchParams) =>
    request<string>(`/api/v1/changes/export?${params}`),
  getSettings: () => request<Settings>("/api/v1/settings"),
  updateSla: (data: { onnet: number; offnet: number; special: number }) =>
    request<Settings>("/api/v1/settings/sla", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  updateRetention: (retention_days: number) =>
    request<Settings>("/api/v1/settings/retention", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retention_days }),
    }),
  clearData: () =>
    request<ClearDataResult>("/api/v1/admin/clear-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: true }),
    }),
};

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("nl-NL");
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("nl-NL");
}

export function formatSlaRiskLabel(daysOver: number | null | undefined): string {
  if (!daysOver || daysOver <= 0) return "SLA-risico";
  const unit = daysOver === 1 ? "werkdag" : "werkdagen";
  return `SLA-risico (+${daysOver} ${unit})`;
}

export type SlaDaysSort = "default" | "asc" | "desc";

export function maxSlaDaysOver(
  orders: Pick<OrderDetail, "sla_days_over" | "is_sla_risk">[]
): number {
  const values = orders.filter((o) => o.is_sla_risk).map((o) => o.sla_days_over ?? 0);
  return values.length ? Math.max(...values) : 0;
}

export function sortCustomersBySlaDays<T extends CustomerCard>(
  customers: T[],
  sort: SlaDaysSort
): T[] {
  if (sort === "default") return customers;

  return [...customers].sort((a, b) => {
    const aDays = maxSlaDaysOver(a.orders);
    const bDays = maxSlaDaysOver(b.orders);
    if (aDays === 0 && bDays === 0) return a.bedrijf.localeCompare(b.bedrijf, "nl");
    if (aDays === 0) return 1;
    if (bDays === 0) return -1;
    return sort === "asc" ? aDays - bDays : bDays - aDays;
  });
}

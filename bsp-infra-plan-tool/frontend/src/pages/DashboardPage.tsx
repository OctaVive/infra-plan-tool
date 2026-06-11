import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronUp, Search } from "lucide-react";
import { api, formatDate, formatDateTime, formatSlaRiskLabel, sortCustomersBySlaDays, type CustomerCard, type SlaDaysSort } from "@/api/client";
import SlaDaysSortButtons from "@/components/SlaDaysSortButtons";

function CustomerCardComponent({ customer }: { customer: CustomerCard }) {
  const [expanded, setExpanded] = useState(false);
  const borderClass = customer.has_sla_risk
    ? "border-red-500 dark:border-red-500 ring-1 ring-red-500/20"
    : "border-amber-400 dark:border-amber-500";

  return (
    <div className={`rounded-xl border bg-white dark:bg-gray-900 ${borderClass} overflow-hidden`}>
      <button
        className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {customer.has_sla_risk && (
            <AlertTriangle className="text-red-500 shrink-0" size={20} />
          )}
          <div>
            <h3 className="font-semibold text-base">{customer.bedrijf}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {customer.order_count} order{customer.order_count !== 1 ? "s" : ""}
              {customer.has_sla_risk && (
                <span className="ml-2 text-red-600 dark:text-red-400 font-medium">SLA-risico</span>
              )}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
      </button>
      {expanded && (
        <div className="border-t border-gray-200 dark:border-gray-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-2 text-left">Order</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Geplaatst op</th>
                <th className="px-4 py-2 text-left">Vorig Gepland</th>
                <th className="px-4 py-2 text-left">Nieuw Gepland</th>
                <th className="px-4 py-2 text-left">SLA deadline</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {customer.orders.map((o) => (
                <tr key={o.order_number} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-2 font-mono text-xs">{o.order_number}</td>
                  <td className="px-4 py-2 capitalize">{o.line_type}</td>
                  <td className="px-4 py-2">{formatDate(o.geplaatst_op)}</td>
                  <td className="px-4 py-2">{formatDate(o.previous_gepland)}</td>
                  <td className="px-4 py-2">{formatDate(o.new_gepland)}</td>
                  <td className="px-4 py-2">{formatDate(o.sla_deadline)}</td>
                  <td className="px-4 py-2">
                    {o.is_sla_risk ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                        {formatSlaRiskLabel(o.sla_days_over)}
                      </span>
                    ) : o.is_new_order ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                        Nieuw
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        Gewijzigd
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [search, setSearch] = useState("");
  const [slaFilter, setSlaFilter] = useState<"all" | "risk">("all");
  const [slaDaysSort, setSlaDaysSort] = useState<SlaDaysSort>("default");

  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: ["dashboard"],
    queryFn: api.getDashboard,
  });

  const { data: kpi } = useQuery({
    queryKey: ["kpi"],
    queryFn: api.getKpi,
  });

  if (isLoading) {
    return <div className="text-center py-20 text-gray-500">Laden...</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-300">
        Fout bij laden: {(error as Error).message}
      </div>
    );
  }

  const customers = sortCustomersBySlaDays(
    (dashboard?.customers ?? []).filter((c) => {
      if (slaFilter === "risk" && !c.has_sla_risk) return false;
      if (search && !c.bedrijf.toLowerCase().includes(search.toLowerCase())) {
        const matchOrder = c.orders.some((o) =>
          o.order_number.toLowerCase().includes(search.toLowerCase())
        );
        if (!matchOrder) return false;
      }
      return true;
    }),
    slaDaysSort
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Klanten met wijzigingen in geplande leverdata
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">SLA-risico orders</p>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">
            {kpi?.sla_risk_count ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Wijzigingen</p>
          <p className="text-3xl font-bold mt-1">{kpi?.changes_detected ?? 0}</p>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
          <p className="text-sm text-gray-500 dark:text-gray-400">Laatste upload</p>
          <p className="text-sm font-medium mt-2">
            {dashboard?.last_upload
              ? formatDateTime(dashboard.last_upload.uploaded_at)
              : "Nog geen upload"}
          </p>
          {dashboard?.last_upload && (
            <p className="text-xs text-gray-400 mt-1">{dashboard.last_upload.filename}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Zoek op bedrijf of order..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />
          </div>
          <select
            value={slaFilter}
            onChange={(e) => setSlaFilter(e.target.value as "all" | "risk")}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          >
            <option value="all">Alle wijzigingen</option>
            <option value="risk">Alleen SLA-risico</option>
          </select>
        </div>
        <SlaDaysSortButtons value={slaDaysSort} onChange={setSlaDaysSort} />
      </div>

      {!dashboard?.last_upload ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
          <p className="text-gray-500">Upload een dagrapport om te beginnen.</p>
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <p className="text-gray-500">Geen klanten met relevante wijzigingen.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {customers.map((c) => (
            <CustomerCardComponent key={c.bedrijf} customer={c} />
          ))}
        </div>
      )}
    </div>
  );
}

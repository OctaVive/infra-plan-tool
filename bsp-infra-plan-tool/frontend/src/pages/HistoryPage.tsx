import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { api, formatDate, formatDateTime, formatSlaRiskLabel, type SlaDaysSort } from "@/api/client";
import SlaDaysSortButtons from "@/components/SlaDaysSortButtons";

export default function HistoryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [slaFilter, setSlaFilter] = useState<string>("all");
  const [lineType, setLineType] = useState<string>("all");
  const [slaDaysSort, setSlaDaysSort] = useState<SlaDaysSort>("default");

  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("page_size", "25");
  if (search) params.set("search", search);
  if (slaFilter === "risk") params.set("is_sla_risk", "true");
  if (lineType !== "all") params.set("line_type", lineType);
  if (slaDaysSort !== "default") params.set("sort_sla_days", slaDaysSort);

  const { data, isLoading } = useQuery({
    queryKey: ["changes", page, search, slaFilter, lineType, slaDaysSort],
    queryFn: () => api.getChanges(params),
  });

  const handleExport = async () => {
    const exportParams = new URLSearchParams();
    if (search) exportParams.set("search", search);
    if (slaFilter === "risk") exportParams.set("is_sla_risk", "true");
    if (lineType !== "all") exportParams.set("line_type", lineType);
    const csv = await api.exportChanges(exportParams);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "order_wijzigingen.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Wijzigingsgeschiedenis</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Overzicht van alle gedetecteerde wijzigingen
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
        >
          <Download size={16} />
          Exporteer CSV
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <input
            type="text"
            placeholder="Zoek op bedrijf of order..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          />
          <select
            value={slaFilter}
            onChange={(e) => { setSlaFilter(e.target.value); setPage(1); }}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          >
            <option value="all">Alle statussen</option>
            <option value="risk">Alleen SLA-risico</option>
          </select>
          <select
            value={lineType}
            onChange={(e) => { setLineType(e.target.value); setPage(1); }}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          >
            <option value="all">Alle lijn types</option>
            <option value="onnet">Onnet</option>
            <option value="offnet">Offnet</option>
            <option value="special">Special</option>
          </select>
        </div>
        <SlaDaysSortButtons
          value={slaDaysSort}
          onChange={(value) => {
            setSlaDaysSort(value);
            setPage(1);
          }}
        />
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-x-auto">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Laden...</div>
        ) : !data?.items.length ? (
          <div className="p-8 text-center text-gray-500">Geen wijzigingen gevonden.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 text-left">Datum</th>
                <th className="px-4 py-3 text-left">Bedrijf</th>
                <th className="px-4 py-3 text-left">Order</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Vorig Gepland</th>
                <th className="px-4 py-3 text-left">Nieuw Gepland</th>
                <th className="px-4 py-3 text-left">SLA deadline</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(c.created_at)}</td>
                  <td className="px-4 py-3">{c.bedrijf}</td>
                  <td className="px-4 py-3 font-mono text-xs">{c.order_number}</td>
                  <td className="px-4 py-3 capitalize">{c.line_type}</td>
                  <td className="px-4 py-3">{formatDate(c.previous_gepland)}</td>
                  <td className="px-4 py-3">{formatDate(c.new_gepland)}</td>
                  <td className="px-4 py-3">{formatDate(c.sla_deadline)}</td>
                  <td className="px-4 py-3">
                    {c.is_sla_risk ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                        {formatSlaRiskLabel(c.sla_days_over)}
                      </span>
                    ) : c.is_new_order ? (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Nieuw</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">Gewijzigd</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Pagina {data.page} van {data.pages} ({data.total} totaal)
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40"
            >
              Vorige
            </button>
            <button
              disabled={page >= data.pages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded border border-gray-200 dark:border-gray-700 disabled:opacity-40"
            >
              Volgende
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

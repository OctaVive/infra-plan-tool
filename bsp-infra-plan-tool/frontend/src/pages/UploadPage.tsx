import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, FileUp, AlertCircle, Loader2 } from "lucide-react";
import { api, type ReportUpload } from "@/api/client";

const ALLOWED_EXTENSIONS = [".xml", ".xlsx", ".xlsm"];

function isAllowedReportFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export default function UploadPage() {
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<ReportUpload | null>(null);
  const [activeSlaRisk, setActiveSlaRisk] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: api.uploadReport,
    onSuccess: async (data) => {
      setResult(data);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["kpi"] });
      queryClient.invalidateQueries({ queryKey: ["changes"] });
      const kpi = await api.getKpi();
      setActiveSlaRisk(kpi.sla_risk_count);
    },
    onError: (err: Error) => {
      setError(err.message);
      setResult(null);
      setActiveSlaRisk(null);
    },
  });

  const handleFile = useCallback(
    (file: File) => {
      if (!isAllowedReportFile(file)) {
        setError("Alleen .xml, .xlsx en .xlsm bestanden zijn toegestaan");
        return;
      }
      mutation.mutate(file);
    },
    [mutation]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Rapport uploaden</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Upload het dagelijkse rapport (.xlsx, .xlsm of Excel-XML)
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
          dragOver
            ? "border-brand-500 bg-brand-50 dark:bg-brand-900/10"
            : "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900"
        }`}
      >
        {mutation.isPending ? (
          <Loader2 className="mx-auto text-brand-600 animate-spin" size={40} />
        ) : (
          <FileUp className="mx-auto text-gray-400" size={40} />
        )}
        <p className="mt-4 font-medium">
          {mutation.isPending ? "Verwerken..." : "Sleep een rapportbestand hierheen"}
        </p>
        <p className="text-sm text-gray-500 mt-1">of</p>
        <label className="mt-3 inline-block">
          <input
            type="file"
            accept=".xml,.xlsx,.xlsm"
            className="hidden"
            disabled={mutation.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <span className="cursor-pointer px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors">
            Bestand kiezen
          </span>
        </label>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4">
          <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
          <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-5 space-y-3">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300 font-medium">
            <CheckCircle size={20} />
            Upload succesvol
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-gray-500">Bestand</dt>
              <dd className="font-medium">{result.filename}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Orders geïmporteerd</dt>
              <dd className="font-medium">{result.orders_imported}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Wijzigingen (deze upload)</dt>
              <dd className="font-medium">{result.changes_detected}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Actieve SLA-risico&apos;s</dt>
              <dd className="font-medium text-red-600">{activeSlaRisk ?? result.sla_risk_count}</dd>
            </div>
          </dl>
          {result.warnings && (
            <div className="text-sm text-amber-700 dark:text-amber-300 whitespace-pre-wrap">
              {result.warnings}
            </div>
          )}
          <button
            onClick={() => navigate("/")}
            className="mt-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
          >
            Naar dashboard
          </button>
        </div>
      )}
    </div>
  );
}

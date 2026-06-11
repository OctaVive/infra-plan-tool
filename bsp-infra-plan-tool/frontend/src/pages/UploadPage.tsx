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
        <h2 className="vz-page-title">Rapport uploaden</h2>
        <p className="vz-page-subtitle">
          Upload het dagelijkse rapport (.xlsx, .xlsm of Excel-XML)
        </p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`relative rounded-xl border-2 border-dashed p-12 text-center transition-colors ${
          dragOver
            ? "border-vodafone bg-vodafone-50 dark:bg-vodafone/10"
            : "border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
        }`}
      >
        {mutation.isPending ? (
          <Loader2 className="mx-auto text-vodafone animate-spin" size={40} />
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
          <span className="cursor-pointer vz-btn-primary">
            Bestand kiezen
          </span>
        </label>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-lg bg-vodafone-50 dark:bg-vodafone/10 border border-vodafone/20 dark:border-vodafone/30 p-4">
          <AlertCircle className="text-vodafone shrink-0 mt-0.5" size={18} />
          <p className="text-vodafone-800 dark:text-vodafone-100 text-sm">{error}</p>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-ziggo/30 dark:border-ziggo/25 bg-ziggo-50 dark:bg-ziggo/10 p-5 space-y-3">
          <div className="flex items-center gap-2 text-ziggo-800 dark:text-ziggo-100 font-medium">
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
              <dd className="font-medium text-vodafone">{activeSlaRisk ?? result.sla_risk_count}</dd>
            </div>
          </dl>
          {result.warnings && (
            <div className="text-sm text-ziggo-800 dark:text-ziggo-100 whitespace-pre-wrap">
              {result.warnings}
            </div>
          )}
          <button
            onClick={() => navigate("/")}
            className="mt-2 vz-btn-primary"
          >
            Naar dashboard
          </button>
        </div>
      )}
    </div>
  );
}

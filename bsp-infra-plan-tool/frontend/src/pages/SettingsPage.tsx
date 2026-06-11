import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, CheckCircle, Trash2, AlertTriangle, X } from "lucide-react";
import { api } from "@/api/client";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });

  const [onnet, setOnnet] = useState(30);
  const [offnet, setOffnet] = useState(45);
  const [special, setSpecial] = useState(60);
  const [retention, setRetention] = useState(365);
  const [saved, setSaved] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearConfirmed, setClearConfirmed] = useState(false);
  const [clearResult, setClearResult] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setOnnet(settings.sla_days.onnet || 30);
      setOffnet(settings.sla_days.offnet || 45);
      setSpecial(settings.sla_days.special || 60);
      setRetention(settings.retention_days);
    }
  }, [settings]);

  const slaMutation = useMutation({
    mutationFn: () => api.updateSla({ onnet, offnet, special }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const retentionMutation = useMutation({
    mutationFn: () => api.updateRetention(retention),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  const clearMutation = useMutation({
    mutationFn: api.clearData,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["kpi"] });
      queryClient.invalidateQueries({ queryKey: ["changes"] });
      setShowClearModal(false);
      setClearConfirmed(false);
      setClearResult(result.message);
    },
  });

  const closeClearModal = () => {
    setShowClearModal(false);
    setClearConfirmed(false);
  };

  if (isLoading) {
    return <div className="text-center py-20 text-gray-500">Laden...</div>;
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="vz-page-title">Instellingen</h2>
        <p className="vz-page-subtitle">
          Configureer SLA-waarden en bewaartermijn
        </p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 text-ziggo dark:text-ziggo-200 text-sm">
          <CheckCircle size={16} />
          Instellingen opgeslagen
        </div>
      )}

      {clearResult && (
        <div className="flex items-center gap-2 rounded-lg bg-ziggo-50 dark:bg-ziggo/10 border border-ziggo/25 p-4 text-ziggo-800 dark:text-ziggo-100 text-sm">
          <CheckCircle size={16} className="shrink-0" />
          {clearResult}
        </div>
      )}

      {!settings?.sla_configured && (
        <div className="rounded-lg bg-ziggo-50 dark:bg-ziggo/10 border border-ziggo/25 dark:border-ziggo/20 p-4 text-ziggo-900 dark:text-ziggo-100 text-sm">
          SLA-dagen zijn nog niet geconfigureerd. Stel de waarden in voordat u rapporten uploadt.
        </div>
      )}

      <section className="vz-card p-6 space-y-5">
        <h3 className="font-semibold text-lg">SLA werkdagen per lijn type</h3>
        <p className="text-sm text-gray-500">
          Berekend vanaf Geplaatst op, exclusief weekenden en Nederlandse feestdagen.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Onnet", value: onnet, set: setOnnet },
            { label: "Offnet (Nearnet)", value: offnet, set: setOffnet },
            { label: "Special", value: special, set: setSpecial },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              <input
                type="number"
                min={1}
                max={999}
                value={value}
                onChange={(e) => set(Number(e.target.value))}
                className="w-full vz-input"
              />
              <span className="text-xs text-gray-400 mt-1 block">werkdagen</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => slaMutation.mutate()}
          disabled={slaMutation.isPending}
          className="flex items-center gap-2 vz-btn-primary disabled:opacity-50"
        >
          <Save size={16} />
          SLA opslaan
        </button>
      </section>

      <section className="vz-card p-6 space-y-5">
        <h3 className="font-semibold text-lg">Bewaartermijn wijzigingslog</h3>
        <div>
          <label className="block text-sm font-medium mb-1">Retentie (dagen)</label>
          <input
            type="number"
            min={30}
            max={3650}
            value={retention}
            onChange={(e) => setRetention(Number(e.target.value))}
            className="w-full max-w-xs vz-input"
          />
        </div>
        <button
          onClick={() => retentionMutation.mutate()}
          disabled={retentionMutation.isPending}
          className="flex items-center gap-2 vz-btn-primary disabled:opacity-50"
        >
          <Save size={16} />
          Retentie opslaan
        </button>
      </section>

      <section className="rounded-xl border border-vodafone/30 dark:border-vodafone/25 bg-white dark:bg-neutral-900 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-vodafone shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-lg text-vodafone dark:text-vodafone-200">Gegevens wissen</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Verwijdert alle orders, rapport-uploads en wijzigingsgeschiedenis. SLA- en
              retentie-instellingen blijven behouden. Deze actie kan niet ongedaan worden gemaakt.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setClearResult(null);
            setShowClearModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-vodafone/40 text-vodafone text-sm font-medium hover:bg-vodafone-50 dark:hover:bg-vodafone/10"
        >
          <Trash2 size={16} />
          Alle gegevens wissen
        </button>
      </section>

      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeClearModal}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-data-title"
            className="relative w-full max-w-md rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-6 shadow-xl"
          >
            <button
              onClick={closeClearModal}
              className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              aria-label="Sluiten"
            >
              <X size={18} />
            </button>

            <div className="flex items-start gap-3 mb-4">
              <div className="p-2 rounded-full bg-vodafone-50 dark:bg-vodafone/15">
                <AlertTriangle className="text-vodafone" size={24} />
              </div>
              <div>
                <h3 id="clear-data-title" className="font-semibold text-lg">
                  Alle gegevens wissen?
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                  Dit verwijdert permanent:
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-300 mt-2 list-disc list-inside space-y-1">
                  <li>Alle geïmporteerde orders</li>
                  <li>Alle rapport-uploads</li>
                  <li>De volledige wijzigingsgeschiedenis</li>
                </ul>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                  SLA- en retentie-instellingen worden <strong>niet</strong> verwijderd.
                </p>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer mb-6">
              <input
                type="checkbox"
                checked={clearConfirmed}
                onChange={(e) => setClearConfirmed(e.target.checked)}
                className="mt-1 rounded border-gray-300"
              />
              <span className="text-sm">
                Ik begrijp dat deze actie niet ongedaan gemaakt kan worden
              </span>
            </label>

            {clearMutation.isError && (
              <p className="text-sm text-vodafone dark:text-vodafone-200 mb-4">
                {(clearMutation.error as Error).message}
              </p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={closeClearModal}
                disabled={clearMutation.isPending}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Annuleren
              </button>
              <button
                onClick={() => clearMutation.mutate()}
                disabled={!clearConfirmed || clearMutation.isPending}
                className="px-4 py-2 rounded-lg bg-vodafone text-white text-sm font-medium hover:bg-vodafone-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {clearMutation.isPending ? "Bezig..." : "Ja, gegevens wissen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

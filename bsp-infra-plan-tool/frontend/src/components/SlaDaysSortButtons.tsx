import { ArrowDown, ArrowUp, List } from "lucide-react";
import type { SlaDaysSort } from "@/api/client";

const OPTIONS: { value: SlaDaysSort; label: string; icon: typeof List }[] = [
  { value: "default", label: "Standaard", icon: List },
  { value: "asc", label: "Kortste", icon: ArrowUp },
  { value: "desc", label: "Langste", icon: ArrowDown },
];

interface SlaDaysSortButtonsProps {
  value: SlaDaysSort;
  onChange: (value: SlaDaysSort) => void;
}

export default function SlaDaysSortButtons({ value, onChange }: SlaDaysSortButtonsProps) {
  return (
    <div
      className="inline-flex rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-1"
      role="group"
      aria-label="Sorteer op overschreden werkdagen"
    >
      {OPTIONS.map(({ value: optionValue, label, icon: Icon }) => {
        const active = value === optionValue;
        return (
          <button
            key={optionValue}
            type="button"
            onClick={() => onChange(optionValue)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              active
                ? "bg-vz-gradient text-white shadow-sm"
                : "text-gray-600 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-800"
            }`}
            aria-pressed={active}
          >
            <Icon size={14} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

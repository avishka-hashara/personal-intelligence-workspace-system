"use client";

import { useMemo } from "react";
import { RRule, Frequency } from "rrule";
import { Repeat } from "lucide-react";

export interface RecurrencePickerProps {
  value: string | null;
  onChange: (rrule: string | null) => void;
  disabled?: boolean;
  className?: string;
}

const PRESETS = [
  { label: "None", value: "" },
  { label: "Daily", value: "FREQ=DAILY" },
  { label: "Weekly", value: "FREQ=WEEKLY" },
  { label: "Weekdays", value: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
  { label: "Monthly", value: "FREQ=MONTHLY" },
] as const;

export function RecurrencePicker({
  value,
  onChange,
  disabled = false,
  className = "",
}: RecurrencePickerProps) {
  // Normalize value for select matching
  const selectedValue = useMemo(() => {
    if (!value) return "";
    const clean = value.startsWith("RRULE:") ? value.replace(/^RRULE:/, "") : value;
    const match = PRESETS.find((p) => p.value === clean || p.value === value);
    if (match) return match.value;
    return value;
  }, [value]);

  const humanReadable = useMemo(() => {
    if (!value) return null;
    try {
      const rule = RRule.fromString(value);
      const text = rule.toText();
      return text.charAt(0).toUpperCase() + text.slice(1);
    } catch {
      return null;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (!selected) {
      onChange(null);
    } else {
      onChange(selected);
    }
  };

  const isCustom = selectedValue && !PRESETS.some((p) => p.value === selectedValue);

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="relative">
        <select
          value={selectedValue}
          onChange={handleChange}
          disabled={disabled}
          className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Select recurrence preset"
        >
          {PRESETS.map((preset) => (
            <option key={preset.label} value={preset.value}>
              {preset.label}
            </option>
          ))}
          {isCustom && (
            <option value={selectedValue}>
              Custom ({humanReadable || selectedValue})
            </option>
          )}
        </select>
      </div>

      {humanReadable && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200/70 rounded-md px-2.5 py-1.5">
          <Repeat className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Repeats: <strong className="font-medium text-slate-700">{humanReadable}</strong></span>
        </div>
      )}
    </div>
  );
}

export default RecurrencePicker;

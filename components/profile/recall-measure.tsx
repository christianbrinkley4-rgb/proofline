"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

type Format = "words" | "count" | "percent" | "frequency";
type Fields = { amount: string; unit: string; period: string; direction: "more" | "fewer" };
const selectClass = "mt-1 h-9 w-full rounded-md border bg-background px-3 text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function RecallMeasure({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  const [format, setFormat] = useState<Format>("words");
  const [fields, setFields] = useState<Fields>({ amount: "", unit: "", period: "", direction: "more" });
  const update = (patch: Partial<Fields>) => {
    const next = { ...fields, ...patch };
    setFields(next);
    const amount = next.amount.trim().replace(/\s*(?:%|percent)$/i, "");
    onChange(format === "percent"
      ? (amount && next.unit.trim() ? `${amount} percent ${next.direction} ${next.unit.trim()}` : "")
      : (amount && next.unit.trim() ? `${amount} ${next.unit.trim()}${next.period.trim() ? ` ${next.period.trim()}` : ""}` : ""));
  };
  return <fieldset className="space-y-2 text-[13px]">
    <legend>Y · Count, frequency, or change</legend>
    <label className="block">Type of detail
      <select disabled={disabled} className={selectClass} value={format} onChange={(event) => { setFormat(event.target.value as Format); setFields({ amount: "", unit: "", period: "", direction: "more" }); onChange(""); }}>
        <option value="words">Describe in my own words</option>
        <option value="count">Count or amount</option>
        <option value="percent">Percentage change</option>
        <option value="frequency">Frequency</option>
      </select>
    </label>
    {format === "words" || format === "frequency" ? <label className="block">{format === "frequency" ? "How often?" : "Your actual detail"}
      <Input disabled={disabled} className="mt-1" value={value} maxLength={80} placeholder={format === "frequency" ? "Weekly, daily, or twice per shift" : "An actual amount, frequency, or change"} onChange={(event) => onChange(event.target.value)} />
    </label> : <>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">{format === "percent" ? "Percentage" : "Count or amount"}
          <Input disabled={disabled} className="mt-1" inputMode="decimal" value={fields.amount} maxLength={25} placeholder={format === "percent" ? "50" : "25 or $1,250"} onChange={(event) => update({ amount: event.target.value })} />
        </label>
        {format === "percent" && <label className="block">Direction
          <select disabled={disabled} className={selectClass} value={fields.direction} onChange={(event) => update({ direction: event.target.value as Fields["direction"] })}>
            <option value="more">More / increased</option><option value="fewer">Fewer / decreased</option>
          </select>
        </label>}
      </div>
      <label className="block">{format === "percent" ? "What increased or decreased?" : "What did you count?"}
        <Input disabled={disabled} className="mt-1" value={fields.unit} maxLength={45} placeholder={format === "percent" ? "Appointments booked" : "Appointments, reports, or funds raised"} onChange={(event) => update({ unit: event.target.value })} />
      </label>
      {format === "count" && <label className="block">Time period (optional)
        <Input disabled={disabled} className="mt-1" value={fields.period} maxLength={25} placeholder="Per week, per shift, or over 3 months" onChange={(event) => update({ period: event.target.value })} />
      </label>}
      {value.length > 80 && <p role="alert" className="text-[12px] text-destructive">Keep this detail to 80 characters or fewer.</p>}
      {value && <p className="text-[12px] text-muted-foreground">Your detail: {value}</p>}
    </>}
  </fieldset>;
}

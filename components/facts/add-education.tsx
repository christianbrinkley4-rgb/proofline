"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus } from "lucide-react";
import { addEducationAction } from "@/app/app/facts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmBox } from "./confirm-box";

const EMPTY = { school: "", degree: "", major: "", gradDate: "", gpa: "", honors: "", coursework: "" };

export function AddEducation() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(EMPTY);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const set = (key: keyof typeof EMPTY, text: string) => { setValues((old) => ({ ...old, [key]: text })); setConfirmed(false); };

  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Plus data-icon="inline-start" />Add education</Button>;
  return <form className="w-full space-y-3 rounded-lg border bg-background p-3" onSubmit={(event) => {
    event.preventDefault();
    setError("");
    start(async () => {
      const result = await addEducationAction({ ...values, confirmed: confirmed as true }).catch(() => ({ ok: false as const, error: "Couldn't reach the server. Try again." }));
      if (!result.ok) { setError(result.error); return; }
      setValues(EMPTY); setConfirmed(false); setOpen(false); router.refresh();
    });
  }}>
    <div className="grid gap-3 sm:grid-cols-2">
      {([['school', 'School'], ['degree', 'Degree'], ['major', 'Major'], ['gradDate', 'Graduation (optional)'], ['gpa', 'GPA (optional)'], ['honors', 'Honors (optional)']] as const).map(([key, label]) => <label key={key} className="block text-[12.5px] text-muted-foreground">
        {label}<Input type={key === 'gradDate' ? 'month' : 'text'} value={values[key]} onChange={(e) => set(key, e.target.value)} required={key === 'school'} maxLength={key === 'gpa' ? 4 : key === 'honors' ? 300 : key === 'degree' ? 120 : key === 'major' ? 160 : 200} className="mt-1 h-10" />
      </label>)}
    </div>
    <label className="block text-[12.5px] text-muted-foreground">Coursework (optional)<Textarea value={values.coursework} onChange={(e) => set('coursework', e.target.value)} rows={2} maxLength={600} className="mt-1" /></label>
    <ConfirmBox checked={confirmed} onChange={setConfirmed} />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex gap-2"><Button type="submit" size="sm" disabled={pending || !confirmed || !values.school.trim()}>{pending && <LoaderCircle className="animate-spin" />}Save education</Button><Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => { setOpen(false); setConfirmed(false); }}>Cancel</Button></div>
  </form>;
}

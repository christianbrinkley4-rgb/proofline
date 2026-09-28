"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Pencil } from "lucide-react";
import { saveContactAction } from "@/app/app/facts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resumeContactItems } from "@/lib/resume/header-contact";
import { ConfirmBox } from "./confirm-box";

type Contact = { fullName: string; contactEmail: string; phone: string; city: string; region: string; linkedinUrl: string; portfolioUrl: string };
const FIELDS = [['fullName', 'Name on your resume'], ['contactEmail', 'Email on your resume'], ['phone', 'Phone'], ['city', 'City'], ['region', 'State or region'], ['linkedinUrl', 'LinkedIn'], ['portfolioUrl', 'Website']] as const;

export function ContactDetails({ initial }: { initial: Contact }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState(initial);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (!editing) return <div className="mt-2 rounded-xl border bg-background p-3">
    <p className="text-sm font-medium">{initial.fullName}</p>
    {resumeContactItems(initial).map((item) => <p key={item} className="mt-1 break-words text-[13px] text-muted-foreground">{item}</p>)}
    <Button size="sm" variant="outline" className="mt-3" onClick={() => { setValues(initial); setConfirmed(false); setError(""); setEditing(true); }}><Pencil data-icon="inline-start" />Edit contact details</Button>
  </div>;
  return <form className="mt-2 space-y-3 rounded-xl border bg-background p-3" onSubmit={(event) => {
    event.preventDefault(); setError("");
    start(async () => {
      const result = await saveContactAction({ ...values, confirmed: confirmed as true }).catch(() => ({ ok: false as const, error: "Couldn't reach the server. Try again." }));
      if (!result.ok) { setError(result.error); return; }
      setEditing(false); setConfirmed(false); router.refresh();
    });
  }}>
    <p className="text-[13px] text-muted-foreground">Your resume email can differ from your sign-in email. Leave it blank to keep it off the resume. Rebuild existing resumes after saving.</p>
    <div className="grid gap-3 sm:grid-cols-2">{FIELDS.map(([key, label]) => <label key={key} className="block text-[12.5px] text-muted-foreground">{label}
      <Input type={key === 'contactEmail' ? 'email' : key === 'phone' ? 'tel' : 'text'} value={values[key]} required={key === 'fullName'} maxLength={key === 'contactEmail' ? 254 : key === 'fullName' ? 120 : key === 'phone' ? 40 : key === 'city' || key === 'region' ? 80 : 300} className="mt-1 h-10" onChange={(e) => { setValues((old) => ({ ...old, [key]: e.target.value })); setConfirmed(false); }} />
    </label>)}</div>
    <ConfirmBox checked={confirmed} onChange={setConfirmed} />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex gap-2"><Button type="submit" size="sm" disabled={pending || !confirmed}>{pending && <LoaderCircle className="animate-spin" />}Save contact details</Button><Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => setEditing(false)}>Cancel</Button></div>
  </form>;
}

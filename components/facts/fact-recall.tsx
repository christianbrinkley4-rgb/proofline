"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RoleRecall } from "@/components/profile/role-recall";

type Role = { id: string; name: string; lines: number };

export function FactRecall({ roles, label = "Find more resume lines" }: { roles: Role[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(roles[0]?.id ?? "");
  const role = roles.find((item) => item.id === selected) ?? roles[0];
  const count = roles.reduce((total, item) => total + item.lines, 0);
  return <>
    <Button type="button" size="sm" onClick={() => setOpen(true)}><Plus data-icon="inline-start" />{label}</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Find more resume lines</DialogTitle>
          <DialogDescription>Pick a role. We&apos;ll show one common task at a time: say yes to the ones you did, and skip the rest.</DialogDescription>
        </DialogHeader>
        <p className="text-[13px] text-muted-foreground">{count} {count === 1 ? "line" : "lines"} saved so far. Each resume uses the ones that fit the job.</p>
        {role ? <>
          <label className="block text-[13px]">Role
            <select className="mt-1 h-10 w-full min-w-0 rounded-md border bg-background px-2 text-[14px]" value={role.id} onChange={(event) => setSelected(event.target.value)}>
              {roles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <RoleRecall key={role.id} experienceId={role.id} name={role.name} />
        </> : <p className="text-[14px] leading-6">Add a role or project below first. Its title helps us find tasks to ask you about.</p>}
      </DialogContent>
    </Dialog>
  </>;
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/**
 * An in-page "are you sure?" for deletes, in place of the browser's confirm box.
 * Focus starts on Keep it, so Enter never deletes by accident.
 */
export function ConfirmDelete({
  title,
  description,
  quote,
  confirmLabel = "Delete",
  onConfirm,
  children,
}: {
  title: string;
  description: React.ReactNode;
  /** The exact words being deleted, shown so the person knows which one. */
  quote?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  /** The button that opens the dialog. */
  children: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-[13.5px] leading-6">{description}</DialogDescription>
        </DialogHeader>
        {quote && <blockquote className="border-l-2 border-border-strong pl-3 text-[14px] leading-6 break-words">{quote}</blockquote>}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="lg" autoFocus>
              Keep it
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            size="lg"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

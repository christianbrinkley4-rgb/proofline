"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { recordOutcomeAction } from "@/app/app/tracker/actions";
import { Button } from "@/components/ui/button";
import { OUTCOME_LABEL, type Outcome, type Prediction } from "@/lib/interviews/model";

export type InterviewInsight = { prediction: Prediction | null; outcome: Outcome | null; available: boolean };
export function InterviewOutcomes({ applicationId, submitted, data }: { applicationId: string; submitted: boolean; data?: InterviewInsight }) {
  const [pending, start] = useTransition();
  return <section className="mt-3 space-y-2 border-t pt-3" aria-label="Interview prediction and outcome">
    {data?.prediction && <><p className="text-xs font-medium">Interview estimate: {data.prediction.probability}%</p><p className="text-xs leading-5 text-muted-foreground">{data.prediction.reasoning}</p><p className="text-[11px] text-subtle-foreground">An initial estimate. Your recorded outcomes show how accurate it is.</p></>}
    {submitted && data?.available && <div className="flex flex-wrap gap-1" role="group" aria-label="Record application outcome">{(Object.keys(OUTCOME_LABEL) as Outcome[]).map((outcome) => <Button key={outcome} size="xs" variant={data.outcome === outcome ? "secondary" : "outline"} aria-pressed={data.outcome === outcome} disabled={pending} onClick={() => start(async () => { try { await recordOutcomeAction(applicationId, outcome); toast("Outcome saved."); } catch { toast.error("Couldn't save the outcome. Try again."); } })}>{OUTCOME_LABEL[outcome]}</Button>)}</div>}
  </section>;
}

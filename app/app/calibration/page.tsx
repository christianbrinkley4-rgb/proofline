import type { Metadata } from "next";
import Link from "next/link";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { requireSession } from "@/lib/auth";
import { calibrationForUser } from "@/lib/interviews/service";

export const metadata: Metadata = { title: "Interview predictions" };
export const dynamic = "force-dynamic";
const percent = (value: number | null) => value === null ? "No results yet" : `${Math.round(value * 10) / 10}%`;
export default async function CalibrationPage() {
  const session = await requireSession();
  const data = await calibrationForUser(session.user.id);
  return <PageBody className="max-w-4xl"><PageHeader title="Do the predictions hold up?" description="Compare the interview estimates made before you applied with the outcomes you recorded." />
    <p className="mt-5 text-sm leading-6 text-muted-foreground">These are initial estimates, not a guarantee. Each application counts once, using its last prediction before submission. Pending applications and withdrawals are excluded from both rates. No response counts only when you record it.</p>
    {!data.available ? <p role="status" className="mt-5 rounded-lg border p-4">Interview tracking is not configured yet. Your applications are still saved.</p> : <div className="mt-5 overflow-x-auto rounded-xl border"><table className="w-full min-w-[700px] text-left text-sm"><caption className="sr-only">Predicted probability compared with recorded interview rate</caption><thead className="border-b bg-muted"><tr>{["Estimate bucket", "Applications", "Recorded outcomes", "Pending", "Withdrawn", "Predicted", "Actual interview rate"].map((label) => <th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead><tbody>{data.buckets.map((b) => <tr key={b.label} className="border-b last:border-0"><th scope="row" className="p-3">{b.label}</th><td className="p-3">{b.count}</td><td className="p-3">{b.resolved}</td><td className="p-3">{b.pending}</td><td className="p-3">{b.withdrawn}</td><td className="p-3">{percent(b.predicted)}</td><td className="p-3">{percent(b.actual)}{b.resolved > 0 && ` (${b.interviews}/${b.resolved})`}</td></tr>)}</tbody></table></div>}
    {data.unpredicted > 0 && <p className="mt-3 text-sm text-muted-foreground">{data.unpredicted} submitted applications have no prediction from before submission and are excluded.</p>}
    <Link href="/app/tracker" className="mt-5 inline-block text-sm font-medium underline">Record an outcome in Applications</Link>
  </PageBody>;
}

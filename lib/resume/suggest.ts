import { familiesFor } from "@/lib/jobs/roles";
import type { Fact } from "@/lib/kb/facts";
import { findVoiceIssues, findWeakOpener } from "@/lib/voice/rules";
import { draftFromStatement } from "./rewrite";
import type { RoleTask } from "./role-tasks";
import { successSignalScore } from "./success-signals";

export type SuggestionKind = "reframe" | "likely_task" | "skill_angle";
export type SuggestionCandidate = {
  text: string;
  taskId: string | null;
  kind: SuggestionKind;
  skills: string[];
  sourceFactIds: string[];
  slot: string | null;
};
export type SuggestionHistory = {
  text: string;
  taskId: string | null;
  status: "pending" | "accepted" | "rejected";
  reason?: "not_true" | "true_but_weak" | "wording" | null;
};

const words = (text: string) => new Set(
  (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((word) =>
    !["a", "an", "and", "at", "by", "each", "for", "in", "of", "on", "the", "to", "with"].includes(word),
  ),
);

/** Conservative overlap catches the same work with a different opener. */
export function nearDuplicate(a: string, b: string): boolean {
  const left = words(a);
  const right = words(b);
  if (!left.size || !right.size) return false;
  const overlap = [...left].filter((word) => right.has(word)).length;
  const shorter = Math.min(left.size, right.size);
  return overlap / shorter >= 0.7 ||
    (overlap >= 3 && shorter <= 6 && overlap / shorter >= 0.6) ||
    (overlap >= 2 && [...left].slice(0, 3).every((word) => right.has(word)));
}

export function validSuggestion(candidate: SuggestionCandidate): boolean {
  if (!candidate.text.trim() || findVoiceIssues(candidate.text).length || findWeakOpener(candidate.text)) return false;
  if (candidate.slot) {
    if (!candidate.text.includes(`[${candidate.slot}]`)) return false;
    const outside = candidate.text.replace(`[${candidate.slot}]`, "");
    return !/\d/.test(outside) || (candidate.kind === "reframe" && candidate.sourceFactIds.length > 0);
  }
  return !/\d/.test(candidate.text) || candidate.kind === "reframe";
}

export function candidates(
  experience: { id: string; title: string | null; kind: string; targetRoles?: string[] },
  confirmedFacts: Pick<Fact, "id" | "content" | "category">[],
  tasks: RoleTask[],
): SuggestionCandidate[] {
  const out: SuggestionCandidate[] = [];
  for (const fact of confirmedFacts) {
    if (!["experience", "metric", "leadership", "project"].includes(fact.category)) continue;
    const rewritten = draftFromStatement(fact.content).replace(/[.\s]+$/, "");
    out.push({ text: rewritten, taskId: null, kind: "reframe", skills: [], sourceFactIds: [fact.id], slot: null });
  }
  const wantedFamilies = new Set(familiesFor(experience.targetRoles ?? []).map((family) => family.id));
  for (const item of tasks) {
    out.push({
      text: item.template,
      taskId: item.id,
      kind: item.families.some((id) => wantedFamilies.has(id)) ? "skill_angle" : "likely_task",
      skills: item.skills,
      sourceFactIds: [],
      slot: item.slot ?? null,
    });
  }
  return out.filter(validSuggestion);
}

/** A rejection about truth is permanent for the task and its close relatives. */
export function rankSuggestions(
  offered: SuggestionCandidate[],
  history: SuggestionHistory[],
  tasks: RoleTask[] = [],
  existingBullets: string[] = [],
): SuggestionCandidate[] {
  const related = new Map(tasks.map((task) => [task.id, task.related]));
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const broadSkills = new Set(["Bookkeeping", "Communication", "Attention to detail", "Customer service", "Data analysis", "Project management", "Problem solving", "Leadership", "Marketing", "Sales"]);
  const rejectedSpecificSkills = new Set(history
    .filter((item) => item.status === "rejected" && item.reason === "not_true" && item.taskId)
    .flatMap((item) => taskById.get(item.taskId!)?.skills ?? [])
    .filter((skill) => !broadSkills.has(skill)));
  const untrue = new Set(history.filter((item) => item.status === "rejected" && item.reason === "not_true").map((item) => item.taskId).filter((id): id is string => Boolean(id)));
  for (const id of [...untrue]) for (const relation of related.get(id) ?? []) untrue.add(relation);
  const accepted = new Set(history.filter((item) => item.status === "accepted").map((item) => item.taskId).filter((id): id is string => Boolean(id)));
  const weak = history.some((item) => item.status === "rejected" && item.reason === "true_but_weak");
  const isBaseOfFollowup = (item: SuggestionCandidate, old: string) => {
    if (!item.taskId || !/:(result|method)$/.test(item.taskId) || item.text === old) return false;
    if (!/\[[^\]]+\]/.test(old) && item.text.startsWith(old)) return true;
    // Method and result questions about the same activity are useful separately.
    const base = old.replace(/(?:, resulting in| using) \[[^\]]+\]$/, "");
    const oldDimension = /, resulting in \[/.test(old) ? "result" : / using \[/.test(old) ? "method" : null;
    return Boolean(oldDimension && !item.taskId.endsWith(`:${oldDimension}`) && item.text.startsWith(base));
  };
  const scored = offered
    .filter((item) => !item.taskId || (!untrue.has(item.taskId) && !history.some((old) => old.taskId === item.taskId)))
    .filter((item) => !item.skills.some((skill) => rejectedSpecificSkills.has(skill)))
    .filter((item) => !history.some((old) => !isBaseOfFollowup(item, old.text) && nearDuplicate(item.text, old.text)))
    .filter((item) => !existingBullets.some((old) => !isBaseOfFollowup(item, old) && nearDuplicate(item.text, old)))
    .map((item, index) => ({
      item,
      index,
      score: (item.taskId && /:(result|method)$/.test(item.taskId) ? 20 : 0) + successSignalScore(item) + (item.kind === "reframe" ? 2 : item.kind === "skill_angle" ? 1.5 : 1)
        + (item.taskId && [...accepted].some((id) => related.get(id)?.includes(item.taskId!)) ? 3 : 0)
        + (weak && (item.slot || /\b(sav(ed|ing)|reduc(ed|ing)|increas(ed|ing)|improv(ed|ing)|result(ed|ing))\b/i.test(item.text)) ? 2 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const chosen: SuggestionCandidate[] = [];
  const deferred: typeof scored = [];
  for (const entry of scored) {
    if (chosen.some((item) => nearDuplicate(item.text, entry.item.text))) continue;
    if (chosen.length && chosen[chosen.length - 1].kind === entry.item.kind) deferred.push(entry);
    else chosen.push(entry.item);
  }
  for (const entry of deferred) {
    if (!chosen.some((item) => nearDuplicate(item.text, entry.item.text))) chosen.push(entry.item);
  }
  return chosen;
}

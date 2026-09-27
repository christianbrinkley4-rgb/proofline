import { postingOverlap } from "@/lib/jobs/relevance";
import { onetTasksForTitle } from "@/lib/resume/onet-tasks";
import { ROLE_TASKS, tasksForExperience } from "@/lib/resume/role-tasks";
import { nearDuplicate } from "@/lib/resume/suggest";
import type { Gap, GapPrompt } from "./gaps";

export type ExperienceForPrompt = { id: string; org: string; title: string | null; kind: string };
export type RejectedTask = { experienceId: string; taskId: string | null; reason: string | null; skills?: string[] };
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Find a plausible, posting-relevant task to ask about for a missing skill.
 * This is only a question. It cannot become a fact until the person describes
 * and confirms their own work in the gap coach.
 */
export function promptsForGaps(
  gaps: Gap[],
  experiences: ExperienceForPrompt[],
  confirmedStatements: Array<{ experienceId: string | null; content: string }>,
  rejected: RejectedTask[],
  description: string | null,
): Gap[] {
  const excluded = new Map<string, Set<string>>();
  const excludedSkills = new Map<string, Set<string>>();
  for (const item of rejected) {
    if (item.reason !== "not_true" || !item.taskId) continue;
    const ids = excluded.get(item.experienceId) ?? new Set<string>();
    ids.add(item.taskId);
    const curated = ROLE_TASKS.find((task) => task.id === item.taskId);
    for (const related of curated?.related ?? []) ids.add(related);
    if (item.taskId.startsWith("onet:")) {
      ids.add(`${item.taskId}:result`);
      ids.add(`${item.taskId}:method`);
    }
    excluded.set(item.experienceId, ids);
    const skills = excludedSkills.get(item.experienceId) ?? new Set<string>();
    for (const skill of item.skills?.length ? item.skills : curated?.skills ?? []) skills.add(key(skill));
    excludedSkills.set(item.experienceId, skills);
  }

  return gaps.map((gap) => {
    const alternatives = gap.skill.split(/\s+or\s+/i).map(key);
    const options = experiences.flatMap((experience) => {
      // If the person already said this skill was not part of this experience,
      // do not rephrase the same question through a different task source.
      if (alternatives.some((skill) => excludedSkills.get(experience.id)?.has(skill))) return [];
      const statements = confirmedStatements.filter((fact) => fact.experienceId === experience.id).map((fact) => fact.content);
      const tasks = [...tasksForExperience(experience), ...onetTasksForTitle(experience.title, 180)];
      return tasks.flatMap((task) => {
        if (excluded.get(experience.id)?.has(task.id)) return [];
        if (statements.some((statement) => nearDuplicate(statement, task.template))) return [];
        const tags = task.skills.map(key);
        const direct = alternatives.some((skill) => tags.includes(skill));
        const lexical = postingOverlap(`${task.template} ${task.skills.join(" ")}`, gap.skill);
        if (!direct && lexical < Math.min(2, key(gap.skill).split(" ").length)) return [];
        const score = (direct ? 10 : 0) + lexical * 2 + postingOverlap(task.template, description) + (task.id.startsWith("onet:") ? 0 : 4);
        return [{ experience, task, score }];
      });
    }).sort((a, b) => b.score - a.score || a.experience.id.localeCompare(b.experience.id) || a.task.id.localeCompare(b.task.id));
    const best = options[0];
    if (!best) return gap;
    const suggestion: GapPrompt = {
      experienceId: best.experience.id,
      org: best.experience.org,
      taskId: best.task.id,
      task: best.task.template,
      source: best.task.id.startsWith("onet:") ? "O*NET 31.0" : "Proofline",
    };
    return { ...gap, suggestion };
  });
}

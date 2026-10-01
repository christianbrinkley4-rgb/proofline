import { postingOverlap } from "@/lib/jobs/relevance";
import { onetTasksForTitle } from "./onet-tasks";
import { tasksForExperience } from "./role-tasks";

export type RolePromptIdea = { id: string; /** The task as a resume-style line, without the question around it. */ template: string; question: string; source: "O*NET 31.0" | "Proofline"; postingMatch: number };

/** Occupational tasks are questions to confirm, never applicant claims. */
export function rolePromptIdeas(title: string | null, description?: string | null, count = 8): RolePromptIdea[] {
  if (!title?.trim()) return [];
  const tasks = [...tasksForExperience({ title, kind: "work" }), ...onetTasksForTitle(title, 180)];
  const seen = new Set<string>();
  const ideas = tasks.flatMap((task) => {
    const key = task.template.toLowerCase().replace(/[^a-z]+/g, " ").trim();
    if (seen.has(key)) return [];
    seen.add(key);
    return [{
      id: task.id,
      template: task.template,
      question: `Have you done this work? ${task.template}`,
      source: task.id.startsWith("onet:") ? "O*NET 31.0" as const : "Proofline" as const,
      postingMatch: postingOverlap(task.template, description),
    }];
  });
  ideas.sort((a, b) => b.postingMatch - a.postingMatch || Number(a.source === "O*NET 31.0") - Number(b.source === "O*NET 31.0"));
  return ideas.slice(0, Math.max(1, Math.min(12, Math.floor(count))));
}

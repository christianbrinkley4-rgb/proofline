import { extractSkills } from "@/lib/fit/skills";
import { onetTasksForContext, onetTasksForTitle } from "./onet-tasks";
import type { RoleTask } from "./role-tasks";
import { candidates, rankSuggestions, type SuggestionCandidate, type SuggestionHistory } from "./suggest";

import { workWords, sameRecallWork } from "./recall-work";
export { sameRecallWork } from "./recall-work";

/** Named projects can be matched to related work without pretending it was a job title. */
export function discoveryTasks(experience: { title: string | null; org: string; kind: string }, examples: string[]): RoleTask[] {
  const context = [experience.org, ...examples].join(" ");
  const direct = onetTasksForTitle(experience.title, 180, true, context);
  if (direct.length) return direct;
  const evidence = [experience.title, experience.kind === "project" ? experience.org : "", ...examples].join(" ");
  const domains: Array<[string, boolean]> = [
    ["Web Developer", /\b(?:website|web page|web application|landing page|front.?end)\b/i.test(evidence) && (experience.kind === "project" || /\b(?:built|developed|designed|coded|created)\b/i.test(evidence))],
    ["Software Developer", /\b(?:software|app|application|script|crm|python|javascript|typescript)\b/i.test(evidence) && /\b(?:built|build|developed|designed|coded|programmed|wrote|automated|custom-built)\b/i.test(evidence)],
    ["Business Intelligence Analyst", /\b(?:financial statements?|investment|cash flow|financial model|valuation)\b/i.test(evidence) && /\b(?:analy[sz]\w*|evaluat\w*|forecast\w*|model\w*|compar\w*)\b/i.test(evidence)],
    ["Business Intelligence Analyst", /\b(?:data|datasets?|sql|dashboard|analytics)\b/i.test(evidence) && /\b(?:analy[sz]\w*|quer\w*|visualiz\w*|dashboard|analytics)\b/i.test(evidence)],
  ];
  // Financial analyst tasks without a core rating are not used. Related
  // financial-reporting projects can use the rated reporting occupation above.
  const inferred = domains.filter(([, matches]) => matches).slice(0, 2).flatMap(([title]) => onetTasksForTitle(title, 180, true, context));
  if (inferred.length) return [...new Map(inferred.map((task) => [task.id, task])).values()];
  return onetTasksForContext(evidence);
}

/** Discovery adds new activities. Existing work is context, never a card to rewrite. */
export function discoverRecall(
  experience: { id: string; title: string | null; kind: string },
  tasks: RoleTask[], history: SuggestionHistory[], knownWork: string[],
): SuggestionCandidate[] {
  const terminal = history.filter((item) => item.status !== "pending");
  const offered = candidates(experience, [], tasks)
    .filter((item) => !knownWork.some((saved) => sameRecallWork(item.text, saved)))
    .filter((item) => !terminal.some((answered) => sameRecallWork(item.text, answered.text)));
  const ranked = rankSuggestions(offered, terminal, tasks, knownWork);
  const contextSkills = new Set(extractSkills(knownWork.join(" ")));
  const contextWords = new Set(workWords(knownWork.join(" ")).split(" "));
  const genericSkills = new Set(["Communication", "Leadership", "Customer service", "Attention to detail", "Problem solving"]);
  const relevance = (item: SuggestionCandidate) => item.skills.filter((skill) => !genericSkills.has(skill) && contextSkills.has(skill)).length * 2
    + workWords(item.text).split(" ").slice(1).filter((word) => contextWords.has(word)).length * 0.2;
  ranked.sort((a, b) => relevance(b) - relevance(a));
  return ranked.filter((item, index) => !ranked.slice(0, index).some((previous) => sameRecallWork(item.text, previous.text)));
}

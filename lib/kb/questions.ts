import { and, desc, eq } from "drizzle-orm";
import { logEvent } from "@/lib/agent/events";
import { db, schema } from "@/lib/db";
import { addFact, confirmFact, rejectFact, type Fact, type FactCategory } from "./facts";

export type Question = typeof schema.question.$inferSelect;

export type QuestionInput = {
  prompt: string;
  kind: Question["kind"];
  proposedValue?: string | null;
  choices?: string[] | null;
  factTemplate?: string | null;
  factCategory?: FactCategory | null;
  experienceId?: string | null;
  factId?: string | null;
  bulletId?: string | null;
  priority?: number;
};

export async function listOpenQuestions(userId: string, opts: { experienceId?: string; limit?: number } = {}) {
  return db.query.question.findMany({
    where: and(
      eq(schema.question.userId, userId),
      eq(schema.question.status, "open"),
      opts.experienceId ? eq(schema.question.experienceId, opts.experienceId) : undefined,
    ),
    orderBy: [desc(schema.question.priority), desc(schema.question.createdAt)],
    limit: opts.limit,
  });
}

/** Queues a question unless the same one is already waiting. */
export async function askQuestion(userId: string, input: QuestionInput): Promise<Question> {
  const open = await listOpenQuestions(userId, { experienceId: input.experienceId ?? undefined });
  const duplicate = open.find(
    (q) => q.prompt === input.prompt || (input.factId && q.factId === input.factId && q.kind === input.kind),
  );
  if (duplicate) return duplicate;

  const [row] = await db
    .insert(schema.question)
    .values({
      userId,
      prompt: input.prompt,
      kind: input.kind,
      proposedValue: input.proposedValue ?? null,
      choices: input.choices ?? null,
      factTemplate: input.factTemplate ?? null,
      factCategory: input.factCategory ?? null,
      experienceId: input.experienceId ?? null,
      factId: input.factId ?? null,
      bulletId: input.bulletId ?? null,
      priority: input.priority ?? 0,
    })
    .returning();
  return row;
}

export type AnswerResult = { question: Question; fact?: Fact };

/**
 * Applies an answer. Yes/no questions about a proposed fact confirm or reject it.
 * Other answers become a new confirmed fact, since the user typed them.
 */
export async function answerQuestion(userId: string, questionId: string, answer: string): Promise<AnswerResult | undefined> {
  const q = await db.query.question.findFirst({
    where: and(eq(schema.question.id, questionId), eq(schema.question.userId, userId)),
  });
  if (!q || q.status !== "open") return undefined;

  const value = answer.trim();
  let fact: Fact | undefined;

  if (q.kind === "yes_no") {
    const yes = /^(y|yes|true|1)$/i.test(value);
    if (q.factId) {
      fact = yes ? await confirmFact(userId, q.factId) : await rejectFact(userId, q.factId, "answered no");
    } else if (yes && q.factTemplate && q.proposedValue) {
      fact = await addFact(userId, {
        category: q.factCategory ?? "metric",
        content: fillTemplate(q.factTemplate, q.proposedValue),
        data: { value: q.proposedValue, questionId: q.id },
        experienceId: q.experienceId,
        source: "user_stated",
        sourceDetail: `question:${q.id}`,
      });
    }
  } else if (value) {
    fact = await addFact(userId, {
      category: q.factCategory ?? (q.kind === "number" ? "metric" : "experience"),
      content: q.factTemplate ? fillTemplate(q.factTemplate, value) : value,
      data: { value, questionId: q.id },
      experienceId: q.experienceId,
      source: "user_stated",
      sourceDetail: `question:${q.id}`,
    });
  }

  const [updated] = await db
    .update(schema.question)
    .set({ status: "answered", answer: value, answeredAt: new Date() })
    .where(eq(schema.question.id, q.id))
    .returning();
  await logEvent(userId, "question_answered", { questionId: q.id, kind: q.kind, answer: value, factId: fact?.id ?? null });
  return { question: updated, fact };
}

export async function dismissQuestion(userId: string, questionId: string): Promise<void> {
  await db
    .update(schema.question)
    .set({ status: "dismissed", answeredAt: new Date() })
    .where(and(eq(schema.question.id, questionId), eq(schema.question.userId, userId)));
}

export function fillTemplate(template: string, answer: string): string {
  return template.replaceAll("{answer}", answer.trim());
}

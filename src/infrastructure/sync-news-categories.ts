import type { PrismaClient } from "../generated/prisma/client";

export const NEWS_CATEGORIES = [
  { id: 1, code: "ANNOUNCEMENT", name: "ข่าวประชาสัมพันธ์" },
  { id: 2, code: "STUDENT_ACHIEVEMENT", name: "ความสำเร็จนักศึกษา" },
  { id: 3, code: "STUDENT_ACTIVITY", name: "งานกิจกรรมนักศึกษา" },
] as const;

type NewsCategory = { id: number; code: string; name: string };
type NewsRow = {
  id: number;
  newsCategoryID: number | null;
  tag: { name: string; tageGroups: { name: string } | null } | null;
};

export function mapNewsCategories(existing: NewsCategory[]) {
  const missing: NewsCategory[] = [];
  const updates: Array<{ existing: NewsCategory; expected: NewsCategory }> = [];
  const conflicts: string[] = [];

  for (const expected of NEWS_CATEGORIES) {
    const nameMatches = existing.filter((category) => category.name === expected.name);
    const codeMatch = existing.find((category) => category.code === expected.code);
    const idMatch = existing.find((category) => category.id === expected.id);
    if (nameMatches.length > 1) conflicts.push(`category name ${expected.name} is duplicated`);
    if (codeMatch && codeMatch.name !== expected.name) conflicts.push(`category code ${expected.code} belongs to ${codeMatch.name}`);
    if (codeMatch && nameMatches[0] && codeMatch.id !== nameMatches[0].id) conflicts.push(`category code/name ${expected.code}/${expected.name} belong to different rows`);

    const match = codeMatch ?? nameMatches[0];
    if (idMatch && idMatch.id !== match?.id && (idMatch.code !== expected.code || idMatch.name !== expected.name)) {
      conflicts.push(`category ID ${expected.id} is occupied by ${idMatch.code}/${idMatch.name}`);
    } else if (!match) {
      missing.push(expected);
    } else if (match.id !== expected.id || match.code !== expected.code || match.name !== expected.name) {
      updates.push({ existing: match, expected });
    }
  }

  return { missing, updates, conflicts };
}

export function mapNewsCategoryAssignments(news: NewsRow[], categories: readonly NewsCategory[], onlyUnassigned = false) {
  const updates: Array<{ newsID: number; categoryID: number }> = [];
  const unmatched: Array<{ newsID: number; tagName: string }> = [];
  const conflicts: string[] = [];

  for (const item of news) {
    const tag = item.tag;
    if (!tag || tag.tageGroups?.name !== "news") continue;
    const matches = categories.filter(({ name }) => name === tag.name);
    if (matches.length > 1) conflicts.push(`news tag ${tag.name} matches multiple news categories`);
    else if (!matches.length) unmatched.push({ newsID: item.id, tagName: tag.name });
    else if (item.newsCategoryID !== matches[0].id && (!onlyUnassigned || item.newsCategoryID === null)) {
      updates.push({ newsID: item.id, categoryID: matches[0].id });
    }
  }

  return { updates, unmatched, conflicts };
}

export async function syncNewsCategories(db: PrismaClient, options: { onlyUnassigned?: boolean } = {}) {
  return db.$transaction(async (tx) => {
    const existing = await tx.newsCategory.findMany({ select: { id: true, code: true, name: true } });
    const plan = mapNewsCategories(existing);
    if (plan.conflicts.length) throw new Error(`News category conflict: ${plan.conflicts.join("; ")}`);

    for (const { existing: current, expected } of plan.updates) {
      await tx.newsCategory.update({ where: { id: current.id }, data: expected });
    }
    for (const category of plan.missing) await tx.newsCategory.create({ data: category });
    await tx.$executeRaw`SELECT setval(pg_get_serial_sequence('public.news_categories', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM public.news_categories), 1), 1))`;

    const categories = await tx.newsCategory.findMany({ select: { id: true, code: true, name: true } });
    const news = await tx.news.findMany({
      select: { id: true, newsCategoryID: true, tag: { select: { name: true, tageGroups: { select: { name: true } } } } },
    });
    const assignments = mapNewsCategoryAssignments(news, categories, options.onlyUnassigned);
    if (assignments.conflicts.length) throw new Error(`News category conflict: ${assignments.conflicts.join("; ")}`);
    for (const item of assignments.updates) {
      await tx.news.update({ where: { id: item.newsID }, data: { newsCategoryID: item.categoryID } });
    }
    return { total: categories.length, created: plan.missing.length, updated: plan.updates.length, assigned: assignments.updates.length, unmatched: assignments.unmatched };
  });
}

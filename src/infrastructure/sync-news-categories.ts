import type { PrismaClient } from "../generated/prisma/client";

type NewsTag = { id: number; name: string };
type NewsCategory = { id: number; code: string; name: string };

const categoryCodes: Record<string, string> = {
  ข่าวประชาสัมพันธ์: "ANNOUNCEMENT",
  ความสำเร็จนักศึกษา: "STUDENT_ACHIEVEMENT",
  งานกิจกรรมนักศึกษา: "STUDENT_ACTIVITY",
};

export function mapNewsCategories(tags: NewsTag[], existing: NewsCategory[]) {
  const byID = new Map(existing.map((category) => [category.id, category]));
  const byCode = new Map(existing.map((category) => [category.code, category]));
  const missing: NewsCategory[] = [];
  const conflicts: string[] = [];

  for (const tag of tags) {
    const expected = {
      id: tag.id,
      code: categoryCodes[tag.name] ?? `LEGACY_TAG_${tag.id}`,
      name: tag.name,
    };
    const idMatch = byID.get(expected.id);
    const codeMatch = byCode.get(expected.code);

    if (idMatch && (idMatch.code !== expected.code || idMatch.name !== expected.name)) {
      conflicts.push(`news category id ${expected.id} should be ${expected.code}/${expected.name}, found ${idMatch.code}/${idMatch.name}`);
    } else if (codeMatch && codeMatch.id !== expected.id) {
      conflicts.push(`news category code ${expected.code} belongs to id ${codeMatch.id}, expected id ${expected.id}`);
    } else if (!idMatch) {
      missing.push(expected);
      byID.set(expected.id, expected);
      byCode.set(expected.code, expected);
    }
  }

  return { missing, conflicts };
}

export async function syncNewsCategories(db: PrismaClient, tags?: NewsTag[]) {
  return db.$transaction(async (tx) => {
    const newsTags = tags ?? await tx.tag.findMany({
      where: { tageGroups: { name: "news" } },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });
    const existing = await tx.newsCategory.findMany({
      select: { id: true, code: true, name: true },
    });
    const { missing, conflicts } = mapNewsCategories(newsTags, existing);
    if (conflicts.length) throw new Error(`News category conflict: ${conflicts.join("; ")}`);

    for (const category of missing) await tx.newsCategory.create({ data: category });
    if (newsTags.length) {
      await tx.$executeRaw`SELECT setval(pg_get_serial_sequence('public.news_categories', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM public.news_categories), 1), 1))`;
    }
    return { total: existing.length + missing.length, created: missing.length };
  });
}

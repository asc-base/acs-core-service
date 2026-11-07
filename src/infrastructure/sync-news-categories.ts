import type { PrismaClient } from "../generated/prisma/client";

export const NEWS_CATEGORIES = [
  { id: 1, code: "ANNOUNCEMENT", name: "ข่าวประชาสัมพันธ์" },
  { id: 2, code: "STUDENT_ACHIEVEMENT", name: "ความสำเร็จนักศึกษา" },
  { id: 3, code: "STUDENT_ACTIVITY", name: "งานกิจกรรมนักศึกษา" },
] as const;

export async function syncNewsCategories(db: PrismaClient) {
  return db.$transaction(async (tx) => {
    for (const category of NEWS_CATEGORIES) {
      await tx.newsCategory.upsert({ where: { code: category.code }, update: {}, create: category });
    }
    await tx.$executeRaw`SELECT setval(pg_get_serial_sequence('public.news_categories', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM public.news_categories), 1), 1))`;
  });
}

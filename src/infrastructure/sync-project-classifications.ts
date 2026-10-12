import type { PrismaClient } from "../generated/prisma/client";

export const PROJECT_CLASSIFICATION_SEEDS = {
  fields: [
    "Artificial intelligence", "Network", "Cloud computing", "Security",
    "Computer Architecture", "Software Engineering", "Computational Theory",
    "GIS", "Game Design", "Data Science and analytics",
    "Data Structures and Algorithms",
  ],
  categories: ["Education", "Medical", "Research Category", "Business", "Game", "Agricultural"],
  projectTypes: ["Research", "Web Application", "Mobile Application", "Internet Of Things"],
} as const;

export async function syncProjectClassifications(db: PrismaClient) {
  return db.$transaction(async (tx) => {
    for (const [index, name] of PROJECT_CLASSIFICATION_SEEDS.fields.entries()) {
      await tx.field.upsert({ where: { name }, update: {}, create: { id: index + 1, name } });
    }
    for (const [index, name] of PROJECT_CLASSIFICATION_SEEDS.categories.entries()) {
      await tx.category.upsert({ where: { name }, update: {}, create: { id: index + 1, name } });
    }
    for (const [index, name] of PROJECT_CLASSIFICATION_SEEDS.projectTypes.entries()) {
      await tx.projectType.upsert({ where: { name }, update: {}, create: { id: index + 1, name } });
    }
    await tx.$executeRaw`SELECT setval(pg_get_serial_sequence('public.fields', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM public.fields), 1), 1))`;
    await tx.$executeRaw`SELECT setval(pg_get_serial_sequence('public.categories', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM public.categories), 1), 1))`;
    await tx.$executeRaw`SELECT setval(pg_get_serial_sequence('public.project_types', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM public.project_types), 1), 1))`;
  });
}

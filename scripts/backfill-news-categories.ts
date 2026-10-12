/* eslint-disable no-console */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { mapNewsCategories, mapNewsCategoryAssignments, syncNewsCategories } from "../src/infrastructure/sync-news-categories";

async function main() {
  try {
    const mode = process.argv[2];
    if (mode !== "--dry-run" && mode !== "--apply") throw new Error("Choose --dry-run or --apply");

    if (mode === "--dry-run") {
      const [news, categories] = await Promise.all([
        prisma.news.findMany({
          select: { id: true, newsCategoryID: true, tag: { select: { id: true, name: true, tageGroups: { select: { name: true } } } } },
        }),
        prisma.newsCategory.findMany({ select: { id: true, code: true, name: true } }),
      ]);
      const categoryPlan = mapNewsCategories(categories);
      const normalizedCategories = categories
        .filter((category) => !categoryPlan.updates.some(({ existing }) => existing.id === category.id))
        .concat(categoryPlan.updates.map(({ expected }) => expected), categoryPlan.missing);
      const assignments = mapNewsCategoryAssignments(news, normalizedCategories);
      console.log(JSON.stringify({
        existing: categories.length,
        toCreate: categoryPlan.missing,
        toUpdate: categoryPlan.updates,
        newsToUpdate: assignments.updates,
        unmatchedNews: assignments.unmatched,
        conflicts: [...categoryPlan.conflicts, ...assignments.conflicts],
      }, null, 2));
      if (categoryPlan.conflicts.length || assignments.conflicts.length) process.exitCode = 1;
    } else {
      const result = await syncNewsCategories(prisma);
      console.log(`News categories ready: ${result.total} total, ${result.created} created, ${result.updated} normalized, ${result.assigned} news assigned`);
      result.unmatched.forEach(({ newsID, tagName }) => console.warn(`Unmatched news ${newsID}: ${tagName}`));
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

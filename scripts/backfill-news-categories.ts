/* eslint-disable no-console */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { mapNewsCategories, syncNewsCategories } from "../src/infrastructure/sync-news-categories";

async function main() {
  try {
    const mode = process.argv[2];
    if (mode !== "--dry-run" && mode !== "--apply") throw new Error("Choose --dry-run or --apply");

    if (mode === "--dry-run") {
      const [tags, categories] = await Promise.all([
        prisma.tag.findMany({
          where: { tageGroups: { name: "news" } },
          select: { id: true, name: true },
          orderBy: { id: "asc" },
        }),
        prisma.newsCategory.findMany({ select: { id: true, code: true, name: true } }),
      ]);
      const { missing, conflicts } = mapNewsCategories(tags, categories);
      console.log(JSON.stringify({ tags: tags.length, existing: categories.length, toCreate: missing, conflicts }, null, 2));
      if (conflicts.length) process.exitCode = 1;
    } else {
      const result = await syncNewsCategories(prisma);
      console.log(`News categories ready: ${result.total} total, ${result.created} created`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

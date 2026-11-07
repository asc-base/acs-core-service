import { excuteSeedRoles } from "./role";
import { prisma } from "../../src/lib/db";
import { excuteSeedTypeCourses } from "./type-course";
import { executeSeedPrefixes } from "./prefix";
import { syncNewsCategories } from "../../src/infrastructure/sync-news-categories";
import { syncProjectClassifications } from "../../src/infrastructure/sync-project-classifications";

async function main() {
  await excuteSeedRoles(prisma);
  await syncNewsCategories(prisma);
  await syncProjectClassifications(prisma);
  await excuteSeedTypeCourses(prisma);
  await executeSeedPrefixes(prisma);
}

main()
  .then(() => {
    console.log("Seeding completed.");
  })
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

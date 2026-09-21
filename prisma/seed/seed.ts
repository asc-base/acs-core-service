import { excuteSeedRoles } from "./role";
import { prisma } from "../../src/lib/db";
import { executeSeedTags } from "./tag";
import { excuteSeedTypeCourses } from "./type-course";
import { executeSeedPrefixes } from "./prefix";

async function main() {
  await excuteSeedRoles(prisma);
  await executeSeedTags(prisma);
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
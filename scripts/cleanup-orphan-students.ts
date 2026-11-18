/* eslint-disable no-console */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { releaseUsers } from "../src/infrastructure/release-users";

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  if (args.some((argument) => argument !== "--apply")) {
    throw new Error("Usage: cleanup-orphan-students.ts [--apply]");
  }

  const orphanStudents = await prisma.student.findMany({
    where: { deletedAt: null, classBook: { deletedAt: { not: null } } },
    select: { id: true, userID: true, studentCode: true, classBookID: true },
  });
  const staleUsers = await prisma.user.findMany({
    where: {
      deletedAt: null,
      OR: [
        { student: { is: { deletedAt: { not: null } } } },
        { professor: { is: { deletedAt: { not: null } } } },
      ],
      NOT: [
        { student: { is: { deletedAt: null } } },
        { professor: { is: { deletedAt: null } } },
      ],
    },
    select: { id: true, email: true },
  });

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        orphanStudents: orphanStudents.length,
        staleUsers: staleUsers.length,
        sample: {
          students: orphanStudents.slice(0, 5),
          users: staleUsers.slice(0, 5),
        },
      },
      null,
      2,
    ),
  );
  if (!apply) return;

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.student.updateMany({
      where: { id: { in: orphanStudents.map((student) => student.id) } },
      data: { deletedAt: now },
    });
    const userIDs = [
      ...new Set([
        ...orphanStudents.map((student) => student.userID),
        ...staleUsers.map((user) => user.id),
      ]),
    ];
    await releaseUsers(tx, userIDs, now);
  });
  console.log("Cleanup applied");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

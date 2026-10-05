/* eslint-disable no-console */
import { prisma } from "../src/lib/db";

export async function backfillProfileMedia(mode: "--dry-run" | "--apply") {
  const pending = await prisma.user.findMany({
    where: {
      AND: [{ imageUrl: { not: null } }, { imageUrl: { not: "" } }],
      imageID: null,
    },
    select: { imageUrl: true },
    distinct: ["imageUrl"],
  });

  if (mode === "--dry-run") {
    console.log(`${pending.length} distinct profile image URL(s) need metadata`);
    return;
  }

  let linked = 0;
  for (const { imageUrl } of pending) {
    if (!imageUrl) continue;
    await prisma.$transaction(async (tx) => {
      const image = await tx.imageMedia.upsert({
        where: { imageUrl },
        create: { provider: "legacy_url", imageUrl },
        update: {},
      });
      const result = await tx.user.updateMany({
        where: { imageUrl, imageID: null },
        data: { imageID: image.id },
      });
      linked += result.count;
    });
  }
  console.log(`Linked ${linked} user profile(s)`);
}

if (process.argv[1]?.endsWith("backfill-profile-media.ts")) {
  const mode = process.argv[2];
  if (mode !== "--dry-run" && mode !== "--apply") throw new Error("Choose --dry-run or --apply");
  try {
    await backfillProfileMedia(mode);
  } finally {
    await prisma.$disconnect();
  }
}

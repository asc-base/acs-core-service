/* eslint-disable no-console */
import { prisma } from "../src/lib/db";

export async function backfillNewsMedia(mode: "--dry-run" | "--apply") {
  const news = await prisma.news.findMany({
    include: {
      newsImages: { where: { deletedAt: null }, include: { image: true } },
      newsAdditionalImages: { orderBy: { id: "asc" } },
    },
  });
  const warnings = news.flatMap((item) => [
    ...(!item.thumbnail ? [`news ${item.id}: missing legacy thumbnail`] : []),
    ...(item.newsAdditionalImages.filter((image) => !image.deletedAt).length > 10 ? [`news ${item.id}: more than 10 detail images (all will be preserved)`] : []),
  ]);
  console.log(`${news.length} news, ${warnings.length} warning(s)`);
  warnings.forEach((warning) => console.warn(`WARN ${warning}`));
  if (mode === "--dry-run") return;

  for (const item of news) {
    await prisma.$transaction(async (tx) => {
      await tx.news.update({ where: { id: item.id }, data: { eventStartAt: item.startDate, eventEndAt: item.dueDate } });
      const ensureImage = async (imageUrl: string) => tx.imageMedia.upsert({
        where: { imageUrl },
        create: { provider: "legacy_url", imageUrl },
        update: {},
      });
      const addLink = async (
        imageUrl: string,
        imageType: "CARD" | "THUMBNAIL" | "DETAIL",
        focalPointX: number | null = null,
        focalPointY: number | null = null,
        sortOrder = 0,
        deletedAt = item.deletedAt,
      ) => {
        const image = await ensureImage(imageUrl);
        const key = { newsID_imageID_imageType: { newsID: item.id, imageID: image.id, imageType } };
        if (await tx.newsImage.findUnique({ where: key })) return;
        if (imageType !== "DETAIL" && await tx.newsImage.findFirst({ where: { newsID: item.id, imageType, deletedAt: null } })) return;
        await tx.newsImage.create({ data: { newsID: item.id, imageID: image.id, imageType, focalPointX, focalPointY, sortOrder, deletedAt } });
      };

      const cardExists = item.newsImages.some(({ imageType }) => imageType === "CARD");
      const thumbnailExists = item.newsImages.some(({ imageType }) => imageType === "THUMBNAIL");
      if (!cardExists && item.thumbnail) await addLink(item.thumbnail, "CARD", item.thumbnailFocalPointX, item.thumbnailFocalPointY);
      if (!thumbnailExists && item.thumbnail) await addLink(item.thumbnail, "THUMBNAIL", item.thumbnailFocalPointX, item.thumbnailFocalPointY);
      if (item.thumbnail && item.newsImages.every(({ image }) => image.imageUrl !== item.thumbnail)) {
        await addLink(item.thumbnail, "DETAIL", item.thumbnailFocalPointX, item.thumbnailFocalPointY);
      }
      let order = 0;
      for (const image of item.newsAdditionalImages) {
        await addLink(image.imageUrl, "DETAIL", null, null, order++, image.deletedAt ?? item.deletedAt);
      }
    });
  }
  console.log(`Backfilled media for ${news.length} news item(s)`);
}

if (process.argv[1]?.endsWith("backfill-news-media.ts")) {
  const mode = process.argv[2];
  if (mode !== "--dry-run" && mode !== "--apply") throw new Error("Choose --dry-run or --apply");
  try {
    await backfillNewsMedia(mode);
  } finally {
    await prisma.$disconnect();
  }
}

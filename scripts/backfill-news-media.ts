import { prisma } from "../src/lib/db";

const mode = process.argv[2];
if (mode !== "--dry-run" && mode !== "--apply") {
  throw new Error("Choose --dry-run or --apply");
}

const categoryCodes: Record<string, string> = {
  ข่าวประชาสัมพันธ์: "ANNOUNCEMENT",
  ความสำเร็จนักศึกษา: "STUDENT_ACHIEVEMENT",
  งานกิจกรรมนักศึกษา: "STUDENT_ACTIVITY",
};

try {
  const [news, newsTags] = await Promise.all([
    prisma.news.findMany({
      include: {
        tag: { include: { tageGroups: true } },
        newsFeatures: { include: { tag: { include: { tageGroups: true } } } },
        newsAdditionalImages: { orderBy: { id: "asc" } },
      },
    }),
    prisma.tag.findMany({ where: { tageGroups: { name: "news" } } }),
  ]);

  const warnings: string[] = [];
  for (const item of news) {
    if (!newsTags.some((tag) => tag.id === item.tagID)) warnings.push(`news ${item.id}: category tag ${item.tagID} is outside the news group`);
    if (!item.thumbnail) warnings.push(`news ${item.id}: missing thumbnail`);
    if (item.newsAdditionalImages.filter((image) => !image.deletedAt).length > 10) {
      warnings.push(`news ${item.id}: more than 10 detail images (all will be preserved)`);
    }
    for (const feature of item.newsFeatures.filter((feature) => !feature.deletedAt)) {
      if (!feature.tag.tageGroups || feature.tag.tageGroups.name !== "news-feature") {
        warnings.push(`news ${item.id}: feature ${feature.id} has an unexpected tag group`);
      }
    }
  }
  console.log(`${news.length} news, ${newsTags.length} categories, ${warnings.length} warning(s)`);
  warnings.forEach((warning) => console.warn(`WARN ${warning}`));
  if (mode !== "--dry-run") {

  const bulletinByFeatureName: Record<string, "HIGHLIGHT" | "ANNOUNCEMENT"> = {
    newshighlight: "HIGHLIGHT",
    announcement: "ANNOUNCEMENT",
  };
  for (const tag of newsTags) {
    const code = categoryCodes[tag.name] ?? `LEGACY_TAG_${tag.id}`;
    await prisma.newsCategory.upsert({
      where: { id: tag.id },
      create: { id: tag.id, code, name: tag.name },
      update: { code, name: tag.name },
    });
  }
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('public.news_categories', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM public.news_categories), 1), 1))`;

  for (const item of news) {
    await prisma.$transaction(async (tx) => {
      const category = newsTags.find((tag) => tag.id === item.tagID);
      await tx.news.update({
        where: { id: item.id },
        data: {
          ...(category ? { newsCategoryID: category.id } : {}),
          eventStartAt: item.startDate,
          eventEndAt: item.dueDate,
        },
      });

      const activeFeatures = item.newsFeatures.filter((feature) => !feature.deletedAt);
      const featureImage = (name: string) => activeFeatures.find(
        (feature) => feature.tag.tageGroups?.name === "news-feature" && feature.tag.name.toLowerCase() === name,
      );
      const card = featureImage("announcement")?.thumbnailURL || item.thumbnail;
      const thumbnail = featureImage("newshighlight")?.thumbnailURL || item.thumbnail;
      const ensureImage = async (url: string) => tx.imageMedia.upsert({
        where: { imageUrl: url },
        create: { provider: "legacy_url", imageUrl: url },
        update: {},
      });
      const addLink = async (
        url: string,
        imageType: "CARD" | "THUMBNAIL" | "DETAIL",
        focalPointX: number | null = null,
        focalPointY: number | null = null,
        sortOrder = 0,
      ) => {
        const image = await ensureImage(url);
        await tx.newsImage.upsert({
          where: { newsID_imageID_imageType: { newsID: item.id, imageID: image.id, imageType } },
          create: { newsID: item.id, imageID: image.id, imageType, focalPointX, focalPointY, sortOrder, deletedAt: item.deletedAt },
          update: { deletedAt: item.deletedAt, focalPointX, focalPointY, sortOrder },
        });
      };

      if (card) {
        const feature = featureImage("announcement");
        await addLink(card, "CARD", feature?.thumbnailFocalPointX ?? item.thumbnailFocalPointX, feature?.thumbnailFocalPointY ?? item.thumbnailFocalPointY);
      }
      if (thumbnail) {
        const feature = featureImage("newshighlight");
        await addLink(thumbnail, "THUMBNAIL", feature?.thumbnailFocalPointX ?? item.thumbnailFocalPointX, feature?.thumbnailFocalPointY ?? item.thumbnailFocalPointY);
      }
      if (item.thumbnail && item.thumbnail !== card && item.thumbnail !== thumbnail) {
        await addLink(item.thumbnail, "DETAIL", item.thumbnailFocalPointX, item.thumbnailFocalPointY);
      }
      let order = 0;
      for (const image of item.newsAdditionalImages.filter((entry) => !entry.deletedAt)) {
        await addLink(image.imageUrl, "DETAIL", null, null, order++);
      }

      for (const feature of activeFeatures) {
        const bulletinType = feature.tag.tageGroups?.name === "news-feature"
          ? bulletinByFeatureName[feature.tag.name.toLowerCase()]
          : undefined;
        if (bulletinType) {
          await tx.newsBulletin.upsert({
            where: { newsID_type: { newsID: item.id, type: bulletinType } },
            create: { newsID: item.id, type: bulletinType, deletedAt: item.deletedAt },
            update: { deletedAt: item.deletedAt },
          });
        }
      }
    });
  }
  console.log(`Backfilled ${news.length} news item(s)`);
  }
} finally {
  await prisma.$disconnect();
}

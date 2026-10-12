/* eslint-disable no-console */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { mapProjectClassificationSeeds, PROJECT_CLASSIFICATION_SEEDS, syncProjectClassifications } from "../src/infrastructure/sync-project-classifications";

const groupNames = { fields: "field", categories: "category", projectTypes: "type" } as const;

async function main() {
  try {
    const mode = process.argv[2];
    if (mode !== "--dry-run" && mode !== "--apply") throw new Error("Choose --dry-run or --apply");
    if (mode === "--apply") {
      const result = await syncProjectClassifications(prisma);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    const [tags, projectTags, fields, categories, projectTypes] = await Promise.all([
      prisma.tag.findMany({
        where: { tageGroups: { name: { in: Object.values(groupNames) } } },
        select: { id: true, name: true, tageGroups: { select: { name: true } } },
        orderBy: { id: "asc" },
      }),
      prisma.projectTag.findMany({
        where: { deletedAt: null, tag: { tageGroups: { name: { in: Object.values(groupNames) } } } },
        select: { projectID: true, tagID: true, tag: { select: { name: true, tageGroups: { select: { name: true } } } } },
      }),
      prisma.field.findMany({ select: { id: true, name: true } }),
      prisma.category.findMany({ select: { id: true, name: true } }),
      prisma.projectType.findMany({ select: { id: true, name: true } }),
    ]);
    const existing = { fields, categories, projectTypes };
    const lookups = {} as Record<keyof typeof groupNames, Array<{ id: number; name: string }>>;
    const extras = {} as Record<keyof typeof groupNames, Array<{ legacyTagID: number; id: number; name: string }>>;
    const updates = {} as Record<keyof typeof groupNames, Array<{ from: { id: number; name: string }; to: { id: number; name: string } }>>;
    const conflicts: string[] = [];

    for (const group of Object.keys(groupNames) as Array<keyof typeof groupNames>) {
      const plan = mapProjectClassificationSeeds(group, existing[group], tags.map(({ id, name, tageGroups }) => ({ id, name, groupName: tageGroups!.name })));
      conflicts.push(...plan.conflicts);
      const updatedIDs = new Set(plan.updates.map(({ existing: row }) => row.id));
      const canonicalRows = existing[group].filter((row) => !updatedIDs.has(row.id));
      const afterCanonical = [...canonicalRows, ...plan.updates.map(({ expected }) => expected), ...plan.missing];
      let nextID = Math.max(afterCanonical.reduce((max, row) => Math.max(max, row.id), 0), PROJECT_CLASSIFICATION_SEEDS[group].length);
      const plannedExtras = plan.extras.map((tag) => ({ legacyTagID: tag.id, id: ++nextID, name: tag.name }));
      lookups[group] = [...afterCanonical, ...plannedExtras.map(({ id, name }) => ({ id, name }))];
      extras[group] = plannedExtras;
      updates[group] = plan.updates.map(({ existing, expected }) => ({ from: existing, to: expected }));
    }

    const byTagID = new Map(tags.map((tag) => [tag.id, tag]));
    const target = new Map<string, number>();
    for (const group of Object.keys(groupNames) as Array<keyof typeof groupNames>) {
      for (const row of lookups[group]) target.set(`${groupNames[group]}:${row.name}`, row.id);
    }
    const mappedLinks = projectTags.flatMap((link) => {
      const tag = byTagID.get(link.tagID);
      const lookupID = tag && target.get(`${tag.tageGroups!.name}:${tag.name}`);
      return lookupID === undefined ? [] : [{ projectID: link.projectID, legacyTagID: link.tagID, lookupID, group: tag!.tageGroups!.name, name: tag!.name }];
    });
    const mappedLinkKeys = new Set(mappedLinks.map(({ projectID, legacyTagID }) => `${projectID}:${legacyTagID}`));
    const existingLinkKeys = new Set([
      ...(await prisma.projectField.findMany({ select: { projectID: true, fieldID: true } })).map(({ projectID, fieldID }) => `field:${projectID}:${fieldID}`),
      ...(await prisma.projectCategory.findMany({ select: { projectID: true, categoryID: true } })).map(({ projectID, categoryID }) => `category:${projectID}:${categoryID}`),
      ...(await prisma.projectProjectType.findMany({ select: { projectID: true, typeID: true } })).map(({ projectID, typeID }) => `type:${projectID}:${typeID}`),
    ]);
    const toCreate = mappedLinks.filter((link) => !existingLinkKeys.has(`${link.group}:${link.projectID}:${link.lookupID}`));
    console.log(JSON.stringify({
      lookups: Object.fromEntries((Object.keys(groupNames) as Array<keyof typeof groupNames>).map((group) => [group, { existing: existing[group].length, toCreate: lookups[group].filter((row) => !existing[group].some((item) => item.id === row.id && item.name === row.name)), toUpdate: updates[group], custom: extras[group] }])),
      projectLinks: { activeLegacy: projectTags.length, toCreate: toCreate.length, rows: toCreate },
      unmatchedLegacyLinks: projectTags.filter((link) => !mappedLinkKeys.has(`${link.projectID}:${link.tagID}`)),
      conflicts,
    }, null, 2));
    if (conflicts.length) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

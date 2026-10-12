import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { AppError } from "../core/error/app-error";
import { ErrorCode } from "../core/types/errors";

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

export type ProjectClassificationGroup = keyof typeof PROJECT_CLASSIFICATION_SEEDS;
type LookupRow = { id: number; name: string };
type LegacyTag = { id: number; name: string; groupName: string };
type ClassificationInput = {
  fieldIds?: number[];
  categoryIds?: number[];
  projectTypeIds?: number[];
  tagsID?: number[];
  newtagsID?: number[];
  deletedtagsID?: number[];
};

const groupNames: Record<ProjectClassificationGroup, string> = {
  fields: "field",
  categories: "category",
  projectTypes: "type",
};
const fixedIdCounts: Record<ProjectClassificationGroup, number> = {
  fields: PROJECT_CLASSIFICATION_SEEDS.fields.length,
  categories: PROJECT_CLASSIFICATION_SEEDS.categories.length,
  projectTypes: PROJECT_CLASSIFICATION_SEEDS.projectTypes.length,
};

export function mapProjectClassificationSeeds(
  group: ProjectClassificationGroup,
  existing: LookupRow[],
  legacyTags: LegacyTag[],
) {
  const expectedNames = PROJECT_CLASSIFICATION_SEEDS[group];
  const conflicts: string[] = [];
  const updates: Array<{ existing: LookupRow; expected: LookupRow }> = [];
  const missing: LookupRow[] = [];
  const extras: LegacyTag[] = [];
  const byName = new Map(existing.map((row) => [row.name, row]));

  expectedNames.forEach((name, index) => {
    const id = index + 1;
    const byID = existing.find((row) => row.id === id);
    const byExpectedName = byName.get(name);
    if (byID && byID.name !== name && byExpectedName?.id !== id) {
      conflicts.push(`${group} ID ${id} is occupied by ${byID.name}`);
    } else if (!byExpectedName) {
      missing.push({ id, name });
    } else if (byExpectedName.id !== id) {
      updates.push({ existing: byExpectedName, expected: { id, name } });
    }
  });

  const reservedNames = new Set<string>(expectedNames);
  const extraNames = new Set<string>();
  for (const tag of legacyTags.filter((item) => item.groupName === groupNames[group]).sort((a, b) => a.id - b.id)) {
    if (reservedNames.has(tag.name)) continue;
    if (extraNames.has(tag.name)) {
      conflicts.push(`${group} legacy name ${tag.name} is duplicated`);
      continue;
    }
    extraNames.add(tag.name);
    if (!byName.has(tag.name)) extras.push(tag);
  }

  return { updates, missing, extras, conflicts };
}

export async function syncProjectClassifications(db: PrismaClient) {
  return db.$transaction(async (tx) => {
    const [legacyRows, fields, categories, projectTypes] = await Promise.all([
      tx.tag.findMany({
        where: { tageGroups: { name: { in: ["field", "category", "type"] } } },
        select: { id: true, name: true, tageGroups: { select: { name: true } } },
        orderBy: { id: "asc" },
      }),
      tx.field.findMany({ select: { id: true, name: true } }),
      tx.category.findMany({ select: { id: true, name: true } }),
      tx.projectType.findMany({ select: { id: true, name: true } }),
    ]);
    const legacyTags: LegacyTag[] = legacyRows.map((tag) => ({ id: tag.id, name: tag.name, groupName: tag.tageGroups?.name ?? "" }));
    const plans = {
      fields: mapProjectClassificationSeeds("fields", fields, legacyTags),
      categories: mapProjectClassificationSeeds("categories", categories, legacyTags),
      projectTypes: mapProjectClassificationSeeds("projectTypes", projectTypes, legacyTags),
    };
    const conflicts = Object.values(plans).flatMap((plan) => plan.conflicts);
    if (conflicts.length) throw new Error(`Project classification conflict: ${conflicts.join("; ")}`);

    for (const { existing, expected } of plans.fields.updates) {
      await tx.field.update({ where: { id: existing.id }, data: expected });
    }
    for (const { existing, expected } of plans.categories.updates) {
      await tx.category.update({ where: { id: existing.id }, data: expected });
    }
    for (const { existing, expected } of plans.projectTypes.updates) {
      await tx.projectType.update({ where: { id: existing.id }, data: expected });
    }
    for (const row of plans.fields.missing) await tx.field.create({ data: row });
    for (const row of plans.categories.missing) await tx.category.create({ data: row });
    for (const row of plans.projectTypes.missing) await tx.projectType.create({ data: row });

    await tx.$executeRaw`SELECT setval(pg_get_serial_sequence('public.fields', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM public.fields), 0), ${fixedIdCounts.fields}), true)`;
    await tx.$executeRaw`SELECT setval(pg_get_serial_sequence('public.categories', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM public.categories), 0), ${fixedIdCounts.categories}), true)`;
    await tx.$executeRaw`SELECT setval(pg_get_serial_sequence('public.project_types', 'id'), GREATEST(COALESCE((SELECT MAX(id) FROM public.project_types), 0), ${fixedIdCounts.projectTypes}), true)`;

    for (const tag of plans.fields.extras) await tx.field.create({ data: { name: tag.name } });
    for (const tag of plans.categories.extras) await tx.category.create({ data: { name: tag.name } });
    for (const tag of plans.projectTypes.extras) await tx.projectType.create({ data: { name: tag.name } });

    const [fieldRows, categoryRows, typeRows, links] = await Promise.all([
      tx.field.findMany({ select: { id: true, name: true } }),
      tx.category.findMany({ select: { id: true, name: true } }),
      tx.projectType.findMany({ select: { id: true, name: true } }),
      tx.projectTag.findMany({
        where: { deletedAt: null, tag: { tageGroups: { name: { in: ["field", "category", "type"] } } } },
        select: { projectID: true, tag: { select: { name: true, tageGroups: { select: { name: true } } } } },
      }),
    ]);
    const fieldByName = new Map(fieldRows.map(({ id, name }) => [name, id]));
    const categoryByName = new Map(categoryRows.map(({ id, name }) => [name, id]));
    const typeByName = new Map(typeRows.map(({ id, name }) => [name, id]));
    const projectFields = links.flatMap((link) => link.tag.tageGroups?.name === "field" ? [{ projectID: link.projectID, fieldID: fieldByName.get(link.tag.name)! }] : []);
    const projectCategories = links.flatMap((link) => link.tag.tageGroups?.name === "category" ? [{ projectID: link.projectID, categoryID: categoryByName.get(link.tag.name)! }] : []);
    const projectProjectTypes = links.flatMap((link) => link.tag.tageGroups?.name === "type" ? [{ projectID: link.projectID, typeID: typeByName.get(link.tag.name)! }] : []);
    if (projectFields.some(({ fieldID }) => fieldID === undefined) || projectCategories.some(({ categoryID }) => categoryID === undefined) || projectProjectTypes.some(({ typeID }) => typeID === undefined)) {
      throw new Error("Project classification tags are missing a lookup row");
    }
    const [fieldsCreated, categoriesCreated, typesCreated] = await Promise.all([
      tx.projectField.createMany({ data: projectFields, skipDuplicates: true }),
      tx.projectCategory.createMany({ data: projectCategories, skipDuplicates: true }),
      tx.projectProjectType.createMany({ data: projectProjectTypes, skipDuplicates: true }),
    ]);
    return {
      fields: fieldRows.length,
      categories: categoryRows.length,
      projectTypes: typeRows.length,
      linksCreated: { fields: fieldsCreated.count, categories: categoriesCreated.count, projectTypes: typesCreated.count },
      conflicts: [] as string[],
    };
  });
}

function validation(message: string): never {
  throw new AppError(ErrorCode.VALIDATION_ERROR, message, 400);
}

export async function writeProjectClassifications(
  tx: Prisma.TransactionClient,
  projectID: number,
  input: ClassificationInput,
  create = false,
) {
  const rawLegacyIDs = create ? (input.tagsID ?? []) : [...(input.newtagsID ?? []), ...(input.deletedtagsID ?? [])];
  if (new Set(input.newtagsID ?? []).size !== (input.newtagsID ?? []).length || new Set(input.deletedtagsID ?? []).size !== (input.deletedtagsID ?? []).length) {
    validation("Project tag IDs must be unique");
  }
  if ((input.newtagsID ?? []).some((id) => (input.deletedtagsID ?? []).includes(id))) validation("A project tag cannot be added and deleted together");

  const [legacyTags, currentTags] = await Promise.all([
    tx.tag.findMany({
      where: { tageGroups: { name: { in: ["field", "category", "type"] } } },
      include: { tageGroups: true },
    }),
    tx.projectTag.findMany({ where: { projectID, deletedAt: null }, include: { tag: { include: { tageGroups: true } } } }),
  ]);
  const requestedTags = rawLegacyIDs.length
    ? await tx.tag.findMany({ where: { id: { in: Array.from(new Set(rawLegacyIDs)) } }, include: { tageGroups: true } })
    : [];
  if (requestedTags.length !== new Set(rawLegacyIDs).size) validation("One or more project tag IDs do not exist");

  const legacyByID = new Map(legacyTags.map((tag) => [tag.id, tag]));
  const groupForTag = (id: number) => legacyByID.get(id)?.tageGroups?.name;
  const legacyChangedGroups = new Set(rawLegacyIDs.map(groupForTag).filter((name): name is string => name === "field" || name === "category" || name === "type"));
  const tagMap = new Map(currentTags.map(({ tag }) => [tag.id, tag]));
  for (const tag of requestedTags) tagMap.set(tag.id, tag);
  const finalTagIDs = new Set(currentTags.map(({ tagID }) => tagID));
  if (create) {
    for (const id of input.tagsID ?? []) finalTagIDs.add(id);
  } else {
    for (const id of input.deletedtagsID ?? []) finalTagIDs.delete(id);
    for (const id of input.newtagsID ?? []) finalTagIDs.add(id);
  }
  for (const id of rawLegacyIDs) {
    if (create || (input.newtagsID ?? []).includes(id)) finalTagIDs.add(id);
  }

  const groupSpecs = [
    { key: "fieldIds", group: "field" },
    { key: "categoryIds", group: "category" },
    { key: "projectTypeIds", group: "type" },
  ] as const;
  const lookupTables = [
    { group: "field", rows: await tx.field.findMany({ select: { id: true, name: true } }) },
    { group: "category", rows: await tx.category.findMany({ select: { id: true, name: true } }) },
    { group: "type", rows: await tx.projectType.findMany({ select: { id: true, name: true } }) },
  ];
  const desiredNames = new Map<string, string[]>();

  for (const spec of groupSpecs) {
    const suppliedIDs = input[spec.key];
    const legacyTouched = create ? rawLegacyIDs.some((id) => groupForTag(id) === spec.group) : legacyChangedGroups.has(spec.group);
    if (suppliedIDs === undefined && !legacyTouched) continue;
    const lookups = lookupTables.find((table) => table.group === spec.group)!.rows;
    let names: string[];
    if (suppliedIDs !== undefined) {
      if (new Set(suppliedIDs).size !== suppliedIDs.length) validation(`${spec.key} must not contain duplicate IDs`);
      names = suppliedIDs.map((id) => {
        const item = lookups.find((row) => row.id === id);
        if (!item) validation(`Invalid ${spec.key} value ${id}`);
        return item.name;
      });
      if (legacyTouched) {
        const legacyNames = Array.from(finalTagIDs)
          .map((id) => tagMap.get(id))
          .filter((tag) => tag?.tageGroups?.name === spec.group)
          .map((tag) => tag!.name)
          .sort();
        if (legacyNames.join("\0") !== [...names].sort().join("\0")) validation(`${spec.key} and legacy tag IDs must select the same names`);
      }
    } else {
      names = Array.from(finalTagIDs)
        .map((id) => tagMap.get(id))
        .filter((tag) => tag?.tageGroups?.name === spec.group)
        .map((tag) => tag!.name);
      if (names.some((name) => !lookups.some((row) => row.name === name))) validation(`Legacy ${spec.group} tags are missing a lookup row`);
    }
    desiredNames.set(spec.group, names);
  }

  const desiredTagIDs = new Set(finalTagIDs);
  for (const group of desiredNames.keys()) {
    for (const id of desiredTagIDs) if (groupForTag(id) === group) desiredTagIDs.delete(id);
    const names = desiredNames.get(group)!;
    for (const tag of legacyTags.filter((item) => item.tageGroups?.name === group && names.includes(item.name))) desiredTagIDs.add(tag.id);
  }
  for (const spec of groupSpecs) {
    if (!desiredNames.has(spec.group)) continue;
    const names = desiredNames.get(spec.group)!;
    if (create || spec.key in input || legacyChangedGroups.has(spec.group)) {
      const lookupIDs = lookupTables.find((table) => table.group === spec.group)!.rows.filter((row) => names.includes(row.name)).map((row) => row.id);
      if (spec.group === "field") {
        await tx.projectField.deleteMany({ where: { projectID } });
        if (lookupIDs.length) await tx.projectField.createMany({ data: lookupIDs.map((fieldID) => ({ projectID, fieldID })), skipDuplicates: true });
      } else if (spec.group === "category") {
        await tx.projectCategory.deleteMany({ where: { projectID } });
        if (lookupIDs.length) await tx.projectCategory.createMany({ data: lookupIDs.map((categoryID) => ({ projectID, categoryID })), skipDuplicates: true });
      } else {
        await tx.projectProjectType.deleteMany({ where: { projectID } });
        if (lookupIDs.length) await tx.projectProjectType.createMany({ data: lookupIDs.map((typeID) => ({ projectID, typeID })), skipDuplicates: true });
      }
    }
  }

  if (create || rawLegacyIDs.length || desiredNames.size) {
    const existingIDs = new Set(currentTags.map(({ tagID }) => tagID));
    const toDelete = currentTags.map(({ tagID }) => tagID).filter((id) => !desiredTagIDs.has(id));
    const toCreate = Array.from(desiredTagIDs).filter((id) => !existingIDs.has(id));
    if (toDelete.length) await tx.projectTag.deleteMany({ where: { projectID, tagID: { in: toDelete } } });
    for (const tagID of toCreate) {
      await tx.projectTag.upsert({
        where: { projectID_tagID: { projectID, tagID } },
        create: { projectID, tagID },
        update: { deletedAt: null },
      });
    }
  }
}

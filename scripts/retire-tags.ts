/* eslint-disable no-console */
import "dotenv/config";
import pg from "pg";
import { PROJECT_CLASSIFICATION_SEEDS } from "../src/infrastructure/sync-project-classifications";
import { NEWS_CATEGORIES } from "../src/infrastructure/sync-news-categories";

type Lookup = { id: number; name: string };
type LegacyTag = { id: number; name: string; group_name: string };
type LegacyLink = { project_id: number; tag_id: number; name: string; group_name: string };

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const report = { status: "ready", lookups: {}, news: {}, projectLinks: {}, newsFeatures: {}, dependencies: [], conflicts: [] as string[] } as Record<string, unknown> & { conflicts: string[] };

async function main() {
  if (process.argv.slice(2).some((argument) => argument !== "--dry-run")) {
    throw new Error("This command is read-only; apply with prisma migrate deploy");
  }
  const client = await pool.connect();
  try {
    const tables = await client.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
    );
    const present = new Set(tables.rows.map(({ table_name }) => table_name));
    const legacyColumn = await client.query(
      "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'news' AND column_name = 'tag_id'",
    );
    const legacyTables = ["tag_groups", "tags", "project_tags", "news_features"];
    if (legacyTables.every((table) => !present.has(table)) && legacyColumn.rowCount === 0) {
      console.log(JSON.stringify({ status: "completed", retiredTables: legacyTables }, null, 2));
      return;
    }
    if (legacyTables.some((table) => !present.has(table)) || !present.has("news") || legacyColumn.rowCount === 0) {
      report.status = "incomplete_schema";
      report.conflicts.push(`Legacy objects are only partially present: tables [${legacyTables.filter((table) => present.has(table)).join(", ")}], news.tag_id=${legacyColumn.rowCount ? "present" : "missing"}`);
      printReport();
      process.exitCode = 1;
      return;
    }

    const [tags, fields, categories, projectTypes, newsCategories, projectLinks, news, newsFeatures, projectRows, mediaRows, bulletins, constraints, views] = await Promise.all([
      client.query<LegacyTag>("SELECT tag.id, tag.name, tag_group.name AS group_name FROM public.tags AS tag JOIN public.tag_groups AS tag_group ON tag_group.id = tag.tage_groups_id ORDER BY tag.id"),
      client.query<Lookup>("SELECT id, name FROM public.fields ORDER BY id"),
      client.query<Lookup>("SELECT id, name FROM public.categories ORDER BY id"),
      client.query<Lookup>("SELECT id, name FROM public.project_types ORDER BY id"),
      client.query<{ id: number; code: string; name: string }>("SELECT id, code, name FROM public.news_categories ORDER BY id"),
      client.query<LegacyLink>("SELECT link.project_id, link.tag_id, tag.name, tag_group.name AS group_name FROM public.project_tags AS link JOIN public.tags AS tag ON tag.id = link.tag_id JOIN public.tag_groups AS tag_group ON tag_group.id = tag.tage_groups_id WHERE link.deleted_at IS NULL ORDER BY link.project_id, tag_group.name, tag.id"),
      client.query<{ id: number; news_category_id: number | null; tag_id: number; tag_name: string; group_name: string }>("SELECT news.id, news.news_category_id, news.tag_id, tag.name AS tag_name, tag_group.name AS group_name FROM public.news AS news JOIN public.tags AS tag ON tag.id = news.tag_id JOIN public.tag_groups AS tag_group ON tag_group.id = tag.tage_groups_id ORDER BY news.id"),
      client.query<{ id: number; news_id: number; tag_id: number; name: string; group_name: string; thumbnail_url: string; focal_point_x: number | null; focal_point_y: number | null; deleted_at: Date | null }>("SELECT feature.id, feature.news_id, feature.tag_id, tag.name, tag_group.name AS group_name, feature.thumbnail_url, feature.thumbnail_focal_point_x AS focal_point_x, feature.thumbnail_focal_point_y AS focal_point_y, feature.deleted_at FROM public.news_features AS feature JOIN public.tags AS tag ON tag.id = feature.tag_id JOIN public.tag_groups AS tag_group ON tag_group.id = tag.tage_groups_id ORDER BY feature.news_id, tag.id"),
      client.query<{ project_id: number; group_name: string; name: string }>("SELECT link.project_id, 'field' AS group_name, lookup.name FROM public.project_fields AS link JOIN public.fields AS lookup ON lookup.id = link.field_id UNION ALL SELECT link.project_id, 'category', lookup.name FROM public.project_categories AS link JOIN public.categories AS lookup ON lookup.id = link.category_id UNION ALL SELECT link.project_id, 'type', lookup.name FROM public.project_project_types AS link JOIN public.project_types AS lookup ON lookup.id = link.type_id"),
      client.query<{ image_url: string; news_id: number; image_type: string; focal_point_x: number | null; focal_point_y: number | null; deleted_at: Date | null }>("SELECT media.image_url, image_link.news_id, image_link.image_type::text, image_link.focal_point_x, image_link.focal_point_y, image_link.deleted_at FROM public.news_images AS image_link JOIN public.image_media AS media ON media.id = image_link.image_id"),
      client.query<{ news_id: number; type: string; deleted_at: Date | null }>("SELECT news_id, type::text, deleted_at FROM public.news_bulletins"),
      client.query<{ relation: string; constraint_name: string; referenced_table: string }>("SELECT constraint_row.conrelid::regclass::text AS relation, constraint_row.conname AS constraint_name, constraint_row.confrelid::regclass::text AS referenced_table FROM pg_constraint AS constraint_row WHERE constraint_row.contype = 'f' AND constraint_row.confrelid IN ('public.tags'::regclass, 'public.tag_groups'::regclass)"),
      client.query<{ relation: string }>("SELECT DISTINCT view_ns.nspname || '.' || view_row.relname AS relation FROM pg_depend AS dependency JOIN pg_rewrite AS rewrite ON rewrite.oid = dependency.objid JOIN pg_class AS view_row ON view_row.oid = rewrite.ev_class JOIN pg_namespace AS view_ns ON view_ns.oid = view_row.relnamespace JOIN pg_class AS source_row ON source_row.oid = dependency.refobjid JOIN pg_namespace AS source_ns ON source_ns.oid = source_row.relnamespace WHERE source_ns.nspname = 'public' AND source_row.relname IN ('tags', 'tag_groups') AND view_row.relkind = 'v'"),
    ]);
    const byGroup: Record<string, Lookup[]> = { fields: fields.rows, categories: categories.rows, projectTypes: projectTypes.rows };
    const groupForTable = { fields: "field", categories: "category", projectTypes: "type" } as const;
    const standardNames: Record<keyof typeof groupForTable, readonly string[]> = PROJECT_CLASSIFICATION_SEEDS;
    const plannedLookups: Record<string, Lookup[]> = {};
    const mappings: Record<string, Array<{ oldTagId: number; name: string; newId: number }>> = {};

    for (const group of Object.keys(groupForTable) as Array<keyof typeof groupForTable>) {
      const current = byGroup[group];
      const seed = standardNames[group];
      const seedNames = new Set<string>(seed);
      const target = new Map(current.map((row) => [row.name, row.id]));
      const fixedRows = seed.map((name, index) => ({ id: index + 1, name }));
      for (const row of fixedRows) {
        const occupied = current.find((item) => item.id === row.id);
        if (occupied && occupied.name !== row.name && target.get(row.name) !== row.id) report.conflicts.push(`${group} ID ${row.id} is occupied by ${occupied.name}`);
      }
      const rekeyNames = new Set(fixedRows.filter(({ id, name }) => target.has(name) && target.get(name) !== id).map(({ name }) => name));
      const postSeedRows = [...current.filter(({ name }) => !rekeyNames.has(name)), ...fixedRows];
      let nextId = Math.max(seed.length, ...postSeedRows.map(({ id }) => id));
      const extraRows: Lookup[] = [];
      const extraSource = tags.rows.filter((tag) => tag.group_name === groupForTable[group] && !seedNames.has(tag.name)).sort((a, b) => a.id - b.id);
      for (const tag of extraSource) {
        if (!target.has(tag.name)) {
          target.set(tag.name, ++nextId);
          extraRows.push({ id: nextId, name: tag.name });
        }
      }
      for (const row of fixedRows) target.set(row.name, row.id);
      plannedLookups[group] = [...postSeedRows, ...extraRows].filter((row, index, rows) => rows.findIndex((other) => other.name === row.name) === index);
      mappings[group] = tags.rows.filter((tag) => tag.group_name === groupForTable[group]).map((tag) => ({ oldTagId: tag.id, name: tag.name, newId: target.get(tag.name)! }));
    }
    report.lookups = Object.fromEntries(Object.keys(groupForTable).map((group) => [group, {
      seed: standardNames[group as keyof typeof groupForTable].map((name, index) => ({ fromId: byGroup[group as keyof typeof groupForTable].find((row) => row.name === name)?.id ?? null, toId: index + 1, name })),
      additional: plannedLookups[group as keyof typeof groupForTable].filter(({ name }) => !standardNames[group as keyof typeof groupForTable].includes(name)),
      mappings: mappings[group as keyof typeof groupForTable],
    }]));

    const categoriesByName = new Map<string, typeof newsCategories.rows>();
    for (const category of newsCategories.rows) categoriesByName.set(category.name, [...(categoriesByName.get(category.name) ?? []), category]);
    const expectedNews = new Map<string, { id: number; code: string; name: string }>(NEWS_CATEGORIES.map(({ id, code, name }) => [name, { id, code, name }]));
    const newsCategoryPlan = NEWS_CATEGORIES.map((expected) => {
      const byCode = newsCategories.rows.find(({ code }) => code === expected.code);
      const byName = categoriesByName.get(expected.name) ?? [];
      const occupied = newsCategories.rows.find(({ id }) => id === expected.id);
      if (occupied && occupied.name !== expected.name) report.conflicts.push(`news category ID ${expected.id} is occupied by ${occupied.code}/${occupied.name}`);
      if (byCode && byCode.name !== expected.name) report.conflicts.push(`news category code ${expected.code} belongs to ${byCode.name}`);
      if (byName.length > 1) report.conflicts.push(`news category name ${expected.name} is ambiguous`);
      if (byName.length === 1 && byName[0]!.code !== expected.code) report.conflicts.push(`news category name ${expected.name} belongs to code ${byName[0]!.code}`);
      return { fromId: byCode?.id ?? byName[0]?.id ?? null, toId: expected.id, code: expected.code, name: expected.name };
    });
    const newsAssignments = news.rows.map((row) => {
      const currentMatches = categoriesByName.get(row.tag_name) ?? [];
      const canonical = expectedNews.get(row.tag_name);
      const matches = currentMatches.length ? currentMatches : canonical ? [canonical] : [];
      if (row.group_name !== "news" || matches.length !== 1) report.conflicts.push(`news ${row.id} tag ${row.tag_id}/${row.tag_name} has no unique news category`);
      else if (row.news_category_id !== null) {
        const current = newsCategories.rows.find(({ id }) => id === row.news_category_id);
        if (current && current.name !== row.tag_name) report.conflicts.push(`news ${row.id} category ${current.id}/${current.name} conflicts with tag name ${row.tag_name}`);
      }
      const newCategoryId = matches.length === 1
        ? canonical ? canonical.id : matches[0]!.id
        : null;
      return { newsId: row.id, oldTagId: row.tag_id, currentCategoryId: row.news_category_id, name: row.tag_name, newCategoryId };
    });
    report.news = { categories: newsCategoryPlan, count: news.rows.length, assignments: newsAssignments };

    const oldProjectNames = new Map<string, Set<string>>();
    for (const link of projectLinks.rows) {
      if (!["field", "category", "type"].includes(link.group_name)) report.conflicts.push(`project ${link.project_id} tag ${link.tag_id}/${link.name} has unsupported group ${link.group_name}`);
      const key = `${link.project_id}:${link.group_name}`;
      const names = oldProjectNames.get(key) ?? new Set<string>();
      names.add(link.name);
      oldProjectNames.set(key, names);
    }
    const currentNames = new Map<string, Set<string>>();
    for (const row of projectRows.rows) {
      const key = `${row.project_id}:${row.group_name}`;
      const names = currentNames.get(key) ?? new Set<string>();
      names.add(row.name);
      currentNames.set(key, names);
    }
    for (const [key, expected] of oldProjectNames) {
      const actual = currentNames.get(key);
      if (actual?.size && (actual.size !== expected.size || [...expected].some((name) => !actual.has(name)))) report.conflicts.push(`project ${key} current and legacy classifications differ`);
    }
    const lookupIDsByGroup = {
      field: new Map(plannedLookups.fields.map(({ id, name }) => [name, id])),
      category: new Map(plannedLookups.categories.map(({ id, name }) => [name, id])),
      type: new Map(plannedLookups.projectTypes.map(({ id, name }) => [name, id])),
    };
    const projectMappings = projectLinks.rows.map((link) => {
      const key = `${link.project_id}:${link.group_name}`;
      const lookupID = lookupIDsByGroup[link.group_name as keyof typeof lookupIDsByGroup]?.get(link.name);
      if (lookupID === undefined) report.conflicts.push(`project ${link.project_id} tag ${link.tag_id}/${link.name} has no target lookup`);
      return { ...link, lookup_id: lookupID ?? null, toCreate: !currentNames.get(key)?.has(link.name) };
    });
    report.projectLinks = { activeLegacy: projectLinks.rows.length, toCreate: projectMappings.filter((link) => link.toCreate).length, mappings: projectMappings };

    const targetType = (name: string) => name.toLowerCase() === "announcement" ? "ANNOUNCEMENT" : "HIGHLIGHT";
    const targetImage = (name: string) => name.toLowerCase() === "announcement" ? "CARD" : "THUMBNAIL";
    const seenFeatures = new Set<string>();
    const featureMappings = newsFeatures.rows.map((feature) => {
      if (feature.group_name !== "news-feature" || !["announcement", "newshighlight"].includes(feature.name.toLowerCase()) || !feature.thumbnail_url.trim()) report.conflicts.push(`news feature ${feature.id} has unsupported tag group/name or an empty image URL`);
      const type = targetType(feature.name);
      const imageType = targetImage(feature.name);
      const key = `${feature.news_id}:${type}`;
      if (seenFeatures.has(key)) report.conflicts.push(`news ${feature.news_id} has duplicate feature type ${type}`);
      seenFeatures.add(key);
      const bulletin = bulletins.rows.find((row) => row.news_id === feature.news_id && row.type === type);
      if (bulletin && String(bulletin.deleted_at) !== String(feature.deleted_at)) report.conflicts.push(`news ${feature.news_id} has conflicting ${type} bulletin state`);
      const image = mediaRows.rows.find((row) => row.news_id === feature.news_id && row.image_url === feature.thumbnail_url && row.image_type === imageType);
      if (image && (String(image.deleted_at) !== String(feature.deleted_at) || image.focal_point_x !== feature.focal_point_x || image.focal_point_y !== feature.focal_point_y)) report.conflicts.push(`news ${feature.news_id} has conflicting ${imageType} image state`);
      if (feature.deleted_at === null && mediaRows.rows.some((row) => row.news_id === feature.news_id && row.image_type === imageType && row.deleted_at === null && row.image_url !== feature.thumbnail_url)) report.conflicts.push(`news ${feature.news_id} already has a different active ${imageType} image`);
      return { newsId: feature.news_id, oldTagId: feature.tag_id, name: feature.name, bulletinType: type, imageType, imageUrl: feature.thumbnail_url, deletedAt: feature.deleted_at };
    });
    report.newsFeatures = { count: newsFeatures.rows.length, mappings: featureMappings };

    const expectedConstraints = new Set(["tags.tag_groups", "news.tags", "news_features.tags", "project_tags.tags"]);
    const dependencies = constraints.rows.filter((row) => !expectedConstraints.has(`${row.relation.replace('public.', '')}.${row.referenced_table.replace('public.', '')}`));
    report.dependencies = [...dependencies, ...views.rows];
    if (dependencies.length || views.rows.length) report.conflicts.push("Unexpected foreign key or view dependencies still reference legacy tables");

    if (report.conflicts.length) report.status = "blocked";
    printReport();
    if (report.conflicts.length) process.exitCode = 1;
  } finally {
    client.release();
  }
}

function printReport() {
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(`Could not inspect tag retirement state: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}).finally(async () => {
  await pool.end();
});

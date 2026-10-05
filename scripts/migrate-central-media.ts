/* eslint-disable no-console */
import { createHash } from "node:crypto";
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, openSync, fsyncSync, closeSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { fileTypeFromBuffer } from "file-type";
import { backfillNewsMedia } from "./backfill-news-media";
import { backfillProfileMedia } from "./backfill-profile-media";
import { prisma } from "../src/lib/db";
import { config } from "../src/core/config/config";
import { ensureImageMedia } from "../src/infrastructure/image-media.repository";
import { detectImageContentTypeFromBytes } from "../src/modules/users/image-file-validation";

const groups = ["profile", "news", "projects", "curriculums", "class-books"] as const;
type Group = typeof groups[number];
type Mode = "--dry-run" | "--apply" | "--verify" | "--rollback";
type ManifestRecord = {
  state: "prepared" | "committed" | "rolled-back";
  imageID: number;
  sourceUrl: string;
  source: { provider: string; bucket: string | null; fileKey: string | null; imageUrl: string; fileName: string | null; contentType: string | null; fileSize: number | null };
  destination: { provider: string; bucket: string; fileKey: string; imageUrl: string; fileName: string | null; contentType: string; fileSize: number; sha256: string };
  owners: Array<{ table: string; id: number; field: string; before: string; after: string }>;
};

const args = process.argv.slice(2);
const mode = args[0] as Mode;
if (!["--dry-run", "--apply", "--verify", "--rollback"].includes(mode)) {
  throw new Error("Usage: media:migrate --dry-run|--apply|--verify|--rollback [--groups profile,news,projects,curriculums,class-books] [--manifest path]");
}
const option = (name: string) => {
  const index = args.indexOf(name);
  return index < 0 ? undefined : args[index + 1];
};
const selectedGroups = (option("--groups") ?? groups.join(",")).split(",").filter(Boolean) as Group[];
if (selectedGroups.some((group) => !groups.includes(group))) throw new Error(`Unknown media group. Choose: ${groups.join(", ")}`);
if (!selectedGroups.length) throw new Error(`Choose at least one media group: ${groups.join(", ")}`);
const manifestPath = resolve(option("--manifest") ?? `.scratch/central-media-migration/${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`);

const rustfsEndpoint = config.RUSTFS_ENDPOINT;
const bucket = config.RUSTFS_BUCKET;
const publicBase = config.RUSTFS_PUBLIC_BASE_URL?.replace(/\/+$/, "");
const accessKeyId = config.RUSTFS_ACCESS_KEY_ID;
const secretAccessKey = config.RUSTFS_SECRET_ACCESS_KEY;
const s3 = rustfsEndpoint && bucket && accessKeyId && secretAccessKey
  ? new S3Client({ endpoint: rustfsEndpoint, region: config.RUSTFS_REGION, credentials: { accessKeyId, secretAccessKey }, forcePathStyle: true })
  : undefined;

function imageURL(url: string) {
  return /\.(avif|gif|jpe?g|png|svg|webp|bmp|tiff?)(?:$|[?#])/i.test(url);
}

function knownDocumentURL(url: string) {
  return /\.(?:pdf|docx?|pptx?|xlsx?|zip|csv)(?:$|[?#])/i.test(url);
}

function fileName(url: string) {
  try { return decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() ?? ""); }
  catch { return ""; }
}

function safeDisplayURL(rawUrl: string) {
  try { const url = new URL(rawUrl); return `${url.origin}${url.pathname}`; }
  catch { return "invalid URL"; }
}

function sourceAllowed(rawUrl: string) {
  let source: URL;
  try { source = new URL(rawUrl); } catch { return false; }
  if ((source.protocol !== "http:" && source.protocol !== "https:") || source.username || source.password) return false;
  const allowed = new Set((process.env.MEDIA_SOURCE_ALLOWED_ORIGINS ?? "").split(",").map((item) => item.trim()).filter(Boolean));
  for (const value of [config.SUPABASE_URL, config.RUSTFS_PUBLIC_BASE_URL]) {
    if (value) {
      try { allowed.add(new URL(value).origin); } catch { /* Ignore invalid optional origins. */ }
    }
  }
  if (!allowed.has(source.origin)) return false;
  const supabaseBucket = config.BUCKET_NAME;
  const publicBasePath = config.RUSTFS_PUBLIC_BASE_URL ? new URL(config.RUSTFS_PUBLIC_BASE_URL).pathname.replace(/\/+$/, "") : "";
  return Boolean(
    (supabaseBucket && source.pathname.includes(`/storage/v1/object/public/${supabaseBucket}/`)) ||
    (publicBasePath && source.pathname.startsWith(`${publicBasePath}/public/`)) ||
    /\/[^/]+\/public\/(profiles|news|projects|curriculums|class-books|images\/migrated)\//.test(source.pathname)
  );
}

function appendManifest(record: ManifestRecord) {
  mkdirSync(dirname(manifestPath), { recursive: true, mode: 0o700 });
  const fd = openSync(manifestPath, "a");
  try { chmodSync(manifestPath, 0o600); appendFileSync(fd, `${JSON.stringify(record)}\n`); fsyncSync(fd); } finally { closeSync(fd); }
}

function readManifest() {
  if (!existsSync(manifestPath)) throw new Error(`Manifest not found: ${manifestPath}`);
  const latest = new Map<number, ManifestRecord>();
  for (const line of readFileSync(manifestPath, "utf8").split("\n").filter(Boolean)) {
    const record = JSON.parse(line) as ManifestRecord;
    latest.set(record.imageID, record);
  }
  return [...latest.values()];
}

async function inventory() {
  const [media, users, newsImages, curriculums, classBooks, projects, news, profiles, courseRows, cohortRows, projectRows, newsRows] = await Promise.all([
    prisma.imageMedia.findMany({ select: { provider: true, imageUrl: true, contentType: true } }),
    prisma.user.count({ where: { imageUrl: { not: null }, imageID: null } }),
    prisma.newsImage.count(),
    prisma.curriculum.count({ where: { imageID: null } }),
    prisma.classBook.count({ where: { imageID: null } }),
    prisma.project.count({ where: { imageID: null } }),
    prisma.news.count(),
    selectedGroups.includes("profile") ? prisma.user.findMany({ where: { imageUrl: { not: null } }, select: { imageUrl: true } }) : [],
    selectedGroups.includes("curriculums") ? prisma.curriculum.findMany({ select: { thumbnailURL: true } }) : [],
    selectedGroups.includes("class-books") ? prisma.classBook.findMany({ select: { thumbnailURL: true } }) : [],
    selectedGroups.includes("projects") ? prisma.project.findMany({ select: { thumbnailURL: true, assetsURL: true } }) : [],
    selectedGroups.includes("news") ? prisma.news.findMany({ include: { newsFeatures: true, newsAdditionalImages: true } }) : [],
  ]);
  const urls = new Set(media.map(({ imageUrl }) => imageUrl));
  const sourceURLs = [
    ...profiles.map(({ imageUrl }) => imageUrl).filter((url): url is string => Boolean(url)),
    ...courseRows.map((row) => row.thumbnailURL),
    ...cohortRows.map((row) => row.thumbnailURL),
    ...projectRows.flatMap((row) => [row.thumbnailURL, ...(row.assetsURL ?? "").split(",").filter((url) => imageURL(url))]),
    ...newsRows.flatMap((row) => [row.thumbnail, ...row.newsFeatures.map((feature) => feature.thumbnailURL), ...row.newsAdditionalImages.map((image) => image.imageUrl)]).filter((url): url is string => Boolean(url)),
    ...media.map(({ imageUrl }) => imageUrl),
  ];
  const uniqueSourceURLs = [...new Set(sourceURLs)];
  const blocked = uniqueSourceURLs.filter((imageUrl) => !sourceAllowed(imageUrl) && !imageUrl.includes("/public/images/migrated/"));
  const allowedURLs = uniqueSourceURLs.filter(sourceAllowed);
  const unavailable: string[] = [];
  for (let offset = 0; offset < allowedURLs.length; offset += 10) {
    const results = await Promise.all(allowedURLs.slice(offset, offset + 10).map(async (imageUrl) => {
      try {
        const response = await fetch(imageUrl, { redirect: "error" });
        await response.body?.cancel();
        return response.ok ? null : imageUrl;
      } catch { return imageUrl; }
    }));
    unavailable.push(...results.filter((url): url is string => Boolean(url)));
  }
  console.log(JSON.stringify({
    imageMediaRows: media.length,
    uniqueImageURLs: new Set([...urls, ...uniqueSourceURLs]).size,
    duplicateReferences: sourceURLs.length - uniqueSourceURLs.length,
    imageObjectsToInspect: uniqueSourceURLs.filter((imageUrl) => sourceAllowed(imageUrl)).length,
    unavailableAllowedSources: unavailable.map(safeDisplayURL),
    usersNeedingLink: selectedGroups.includes("profile") ? users : "not selected",
    newsRows: selectedGroups.includes("news") ? news : "not selected",
    existingNewsImageLinks: selectedGroups.includes("news") ? newsImages : "not selected",
    curriculumsNeedingLink: selectedGroups.includes("curriculums") ? curriculums : "not selected",
    classBooksNeedingLink: selectedGroups.includes("class-books") ? classBooks : "not selected",
    projectsNeedingLink: selectedGroups.includes("projects") ? projects : "not selected",
    sourceURLsOutsideAllowlist: blocked.map(safeDisplayURL),
    note: "Configure MEDIA_SOURCE_ALLOWED_ORIGINS before applying if source URLs need to be copied.",
  }, null, 2));
}

async function linkOwnerMedia() {
  if (selectedGroups.includes("profile")) await backfillProfileMedia("--apply");
  if (selectedGroups.includes("news")) {
    await backfillNewsMedia("--apply");
    const [news, features, additional] = await Promise.all([
      prisma.news.findMany({ select: { thumbnail: true } }),
      prisma.newsFeatures.findMany({ select: { thumbnailURL: true } }),
      prisma.newsAdditionalImage.findMany({ select: { imageUrl: true } }),
    ]);
    const urls = [...new Set([
      ...news.map((row) => row.thumbnail),
      ...features.map((row) => row.thumbnailURL),
      ...additional.map((row) => row.imageUrl),
    ].filter((url): url is string => Boolean(url)))];
    for (const imageUrl of urls) {
      await prisma.imageMedia.upsert({
        where: { imageUrl },
        create: { provider: "legacy_url", imageUrl, fileName: fileName(imageUrl) },
        update: {},
      });
    }
  }
  for (const group of ["curriculums", "class-books", "projects"] as const) {
    if (!selectedGroups.includes(group)) continue;
    if (group === "curriculums") {
      for (const row of await prisma.curriculum.findMany({ where: { imageID: null, thumbnailURL: { not: "" } } })) {
        await prisma.$transaction(async (tx) => {
          const imageID = await ensureImageMedia(tx, { provider: "legacy_url", imageUrl: row.thumbnailURL, fileName: fileName(row.thumbnailURL) });
          await tx.curriculum.updateMany({ where: { id: row.id, imageID: null }, data: { imageID } });
        });
      }
    } else if (group === "class-books") {
      for (const row of await prisma.classBook.findMany({ where: { imageID: null, thumbnailURL: { not: "" } } })) {
        await prisma.$transaction(async (tx) => {
          const imageID = await ensureImageMedia(tx, { provider: "legacy_url", imageUrl: row.thumbnailURL, fileName: fileName(row.thumbnailURL) });
          await tx.classBook.updateMany({ where: { id: row.id, imageID: null }, data: { imageID } });
        });
      }
    } else {
      for (const row of await prisma.project.findMany({ include: { images: true } })) {
        await prisma.$transaction(async (tx) => {
          const thumbnailID = await ensureImageMedia(tx, { provider: "legacy_url", imageUrl: row.thumbnailURL, fileName: fileName(row.thumbnailURL) });
          if (row.imageID === null) await tx.project.updateMany({ where: { id: row.id, imageID: null }, data: { imageID: thumbnailID } });
          const urls = (row.assetsURL ?? "").split(",").filter((url) => imageURL(url));
          for (const [sortOrder, imageUrl] of urls.entries()) {
            const imageID = await ensureImageMedia(tx, { provider: "legacy_url", imageUrl, fileName: fileName(imageUrl) });
            await tx.projectImage.upsert({
              where: { projectID_sortOrder: { projectID: row.id, sortOrder } },
              create: { projectID: row.id, imageID, sortOrder, deletedAt: row.deletedAt },
              update: {},
            });
          }
        });
      }
    }
  }
}

async function objectBytes(imageUrl: string) {
  if (!sourceAllowed(imageUrl)) throw new Error("source URL is outside MEDIA_SOURCE_ALLOWED_ORIGINS or an approved media path");
  const response = await fetch(imageUrl, { redirect: "error" });
  if (!response.ok) throw new Error(`source returned HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function verifyDestination(fileKey: string, expectedHash: string) {
  const result = await s3!.send(new GetObjectCommand({ Bucket: bucket!, Key: fileKey }));
  if (!result.Body) throw new Error(`Destination object ${fileKey} has no body`);
  const bytes = Buffer.from(await result.Body.transformToByteArray());
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== expectedHash) throw new Error(`Destination checksum mismatch for ${fileKey}`);
  return bytes;
}

async function ownersFor(imageID: number, imageUrl: string): Promise<ManifestRecord["owners"]> {
  const [users, projects, curriculums, classBooks, news, features, additional] = await Promise.all([
    prisma.user.findMany({ where: { OR: [{ imageID }, { imageUrl }] }, select: { id: true, imageUrl: true } }),
    prisma.project.findMany({ where: { OR: [{ imageID }, { thumbnailURL: imageUrl }, { assetsURL: { contains: imageUrl } }] }, select: { id: true, thumbnailURL: true, assetsURL: true } }),
    prisma.curriculum.findMany({ where: { OR: [{ imageID }, { thumbnailURL: imageUrl }] }, select: { id: true, thumbnailURL: true } }),
    prisma.classBook.findMany({ where: { OR: [{ imageID }, { thumbnailURL: imageUrl }] }, select: { id: true, thumbnailURL: true } }),
    prisma.news.findMany({ where: { thumbnail: imageUrl }, select: { id: true, thumbnail: true } }),
    prisma.newsFeatures.findMany({ where: { thumbnailURL: imageUrl }, select: { id: true, thumbnailURL: true } }),
    prisma.newsAdditionalImage.findMany({ where: { imageUrl }, select: { id: true, imageUrl: true } }),
  ]);
  return [
    ...users.filter((row) => row.imageUrl === imageUrl).map((row) => ({ table: "user", id: row.id, field: "imageUrl", before: imageUrl, after: "" })),
    ...projects.flatMap((row) => [
      ...(row.thumbnailURL === imageUrl ? [{ table: "project", id: row.id, field: "thumbnailURL", before: imageUrl, after: "" }] : []),
      ...(row.assetsURL.split(",").includes(imageUrl) ? [{ table: "project", id: row.id, field: "assetsURL", before: row.assetsURL, after: "" }] : []),
    ]),
    ...curriculums.filter((row) => row.thumbnailURL === imageUrl).map((row) => ({ table: "curriculum", id: row.id, field: "thumbnailURL", before: imageUrl, after: "" })),
    ...classBooks.filter((row) => row.thumbnailURL === imageUrl).map((row) => ({ table: "classBook", id: row.id, field: "thumbnailURL", before: imageUrl, after: "" })),
    ...news.map((row) => ({ table: "news", id: row.id, field: "thumbnail", before: row.thumbnail!, after: "" })),
    ...features.map((row) => ({ table: "newsFeatures", id: row.id, field: "thumbnailURL", before: row.thumbnailURL, after: "" })),
    ...additional.map((row) => ({ table: "newsAdditionalImage", id: row.id, field: "imageUrl", before: row.imageUrl, after: "" })),
  ];
}

async function migrateObjects() {
  if (!s3 || !bucket || !publicBase) throw new Error("RustFS credentials, bucket, endpoint and public URL must be configured");
  await linkOwnerMedia();
  const previous = existsSync(manifestPath) ? readManifest() : [];
  const journal = new Map(previous.map((entry) => [entry.imageID, entry]));
  const done = new Set(previous.filter((entry) => entry.state === "committed").map((entry) => entry.imageID));
  const failures: string[] = [];
  const nonImages = new Set<number>();
  const mediaIDs = await selectedMediaIDs();
  for (const media of await prisma.imageMedia.findMany({ where: { id: { in: [...mediaIDs] }, imageUrl: { not: "" } }, orderBy: { id: "asc" } })) {
    if (done.has(media.id)) continue;
    const prepared = journal.get(media.id);
    if (prepared?.state === "prepared" && media.imageUrl === prepared.destination.imageUrl) {
      try {
        await verifyDestination(prepared.destination.fileKey, prepared.destination.sha256);
        appendManifest({ ...prepared, state: "committed" });
        done.add(media.id);
        continue;
      } catch (error) { failures.push(`image_media ${media.id} (${safeDisplayURL(prepared.sourceUrl)}): ${String(error)}`); continue; }
    }
    if (media.provider === "rustfs" && media.bucket === bucket && media.fileKey?.startsWith("public/")) {
      try {
        const bytes = await verifyDestination(media.fileKey, createHash("sha256").update(await objectBytes(media.imageUrl)).digest("hex"));
        if (bytes.length !== media.fileSize && media.fileSize !== null) throw new Error("RustFS file size differs from metadata");
      } catch (error) { failures.push(`${media.imageUrl}: ${String(error)}`); }
      continue;
    }
    if (!sourceAllowed(media.imageUrl)) continue;
    try {
      const sourceBytes = await objectBytes(media.imageUrl);
      const sourceType = await fileTypeFromBuffer(sourceBytes);
      const knownImage = Boolean(media.contentType?.startsWith("image/") || imageURL(media.imageUrl));
      let contentType: string;
      try { contentType = await detectImageContentTypeFromBytes(sourceBytes); }
      catch (error) {
        if (knownImage) throw error;
        const knownNonImage = Boolean(sourceType && !sourceType.mime.startsWith("image/") || media.contentType && !media.contentType.startsWith("image/") || knownDocumentURL(media.imageUrl));
        if (!knownNonImage) throw error;
        nonImages.add(media.id);
        console.log(`Preserved unsupported or non-image URL ${safeDisplayURL(media.imageUrl)}`);
        continue;
      }
      const sha256 = createHash("sha256").update(sourceBytes).digest("hex");
      const extension = contentType === "image/svg+xml" ? "svg" : fileName(media.imageUrl).split(".").pop();
      const originalFileName = media.fileName || fileName(media.imageUrl) || `image-${media.id}.${extension || "img"}`;
      const keyHash = createHash("sha256").update(media.imageUrl).digest("hex");
      const fileKey = `public/images/migrated/${keyHash}`;
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: fileKey,
        Body: sourceBytes,
        ContentType: contentType,
        Metadata: { "source-sha256": sha256 },
      }));
      const destinationBytes = await verifyDestination(fileKey, sha256);
      if (destinationBytes.length !== sourceBytes.length) throw new Error(`Destination size mismatch for ${fileKey}`);
      const destinationUrl = `${publicBase}/${fileKey}`;
      const owners = await ownersFor(media.id, media.imageUrl);
      const record: ManifestRecord = {
        state: "prepared", imageID: media.id, sourceUrl: media.imageUrl,
        source: { provider: media.provider, bucket: media.bucket, fileKey: media.fileKey, imageUrl: media.imageUrl, fileName: media.fileName, contentType: media.contentType, fileSize: media.fileSize },
        destination: { provider: "rustfs", bucket, fileKey, imageUrl: destinationUrl, fileName: originalFileName, contentType, fileSize: sourceBytes.length, sha256 },
        owners: owners.map((owner) => {
          if (owner.table === "project" && owner.field === "assetsURL") return { ...owner, after: owner.before.split(",").map((url) => url === media.imageUrl ? destinationUrl : url).join(",") };
          return { ...owner, after: destinationUrl };
        }),
      };
      appendManifest(record);
      await prisma.$transaction(async (tx) => {
        await tx.imageMedia.update({ where: { id: media.id }, data: { provider: "rustfs", bucket, fileKey, imageUrl: destinationUrl, fileName: originalFileName, contentType, fileSize: sourceBytes.length } });
        for (const owner of record.owners) {
          const where = { id: owner.id };
          if (owner.table === "user") await tx.user.updateMany({ where: { ...where, imageUrl: owner.before }, data: { imageUrl: owner.after } });
          if (owner.table === "project" && owner.field === "thumbnailURL") await tx.project.updateMany({ where: { ...where, thumbnailURL: owner.before }, data: { thumbnailURL: owner.after } });
          if (owner.table === "project" && owner.field === "assetsURL") await tx.project.updateMany({ where: { ...where, assetsURL: owner.before }, data: { assetsURL: owner.after } });
          if (owner.table === "curriculum") await tx.curriculum.updateMany({ where: { ...where, thumbnailURL: owner.before }, data: { thumbnailURL: owner.after } });
          if (owner.table === "classBook") await tx.classBook.updateMany({ where: { ...where, thumbnailURL: owner.before }, data: { thumbnailURL: owner.after } });
          if (owner.table === "news") await tx.news.updateMany({ where: { ...where, thumbnail: owner.before }, data: { thumbnail: owner.after } });
          if (owner.table === "newsFeatures") await tx.newsFeatures.updateMany({ where: { ...where, thumbnailURL: owner.before }, data: { thumbnailURL: owner.after } });
          if (owner.table === "newsAdditionalImage") await tx.newsAdditionalImage.updateMany({ where: { ...where, imageUrl: owner.before }, data: { imageUrl: owner.after } });
        }
      });
      appendManifest({ ...record, state: "committed" });
      console.log(`Migrated image_media ${media.id} (${sourceBytes.length} bytes)`);
    } catch (error) {
      failures.push(`image_media ${media.id} (${safeDisplayURL(media.imageUrl)}): ${String(error)}`);
      console.error(`FAILED image_media ${media.id} (${safeDisplayURL(media.imageUrl)}): ${String(error)}`);
    }
  }
  if (failures.length) throw new Error(`${failures.length} image(s) failed; see output and rerun with the same --manifest`);
  const remaining = await prisma.imageMedia.findMany({ where: { id: { in: [...mediaIDs] }, provider: { not: "rustfs" } }, select: { id: true, imageUrl: true } });
  const unresolved = remaining.filter(({ id, imageUrl }) => !nonImages.has(id) && sourceAllowed(imageUrl));
  if (unresolved.length) throw new Error(`${unresolved.length} image media record(s) remain on their original provider: ${unresolved.map(({ id }) => id).join(", ")}`);
  console.log(`Migration complete; recovery manifest: ${manifestPath}`);
}

async function selectedMediaIDs() {
  const ids = new Set<number>();
  if (selectedGroups.includes("profile")) for (const row of await prisma.user.findMany({ where: { imageID: { not: null } }, select: { imageID: true } })) if (row.imageID !== null) ids.add(row.imageID);
  if (selectedGroups.includes("news")) {
    const [newsImages, news, features, additionalImages] = await Promise.all([
      prisma.newsImage.findMany({ select: { imageID: true } }),
      prisma.news.findMany({ select: { thumbnail: true } }),
      prisma.newsFeatures.findMany({ select: { thumbnailURL: true } }),
      prisma.newsAdditionalImage.findMany({ select: { imageUrl: true } }),
    ]);
    for (const row of newsImages) ids.add(row.imageID);
    const legacyURLs = [...news.map((row) => row.thumbnail), ...features.map((row) => row.thumbnailURL), ...additionalImages.map((row) => row.imageUrl)].filter((url): url is string => Boolean(url));
    if (legacyURLs.length) for (const row of await prisma.imageMedia.findMany({ where: { imageUrl: { in: legacyURLs } }, select: { id: true } })) ids.add(row.id);
  }
  if (selectedGroups.includes("projects")) {
    for (const row of await prisma.project.findMany({ where: { imageID: { not: null } }, select: { imageID: true } })) if (row.imageID !== null) ids.add(row.imageID);
    for (const row of await prisma.projectImage.findMany({ select: { imageID: true } })) ids.add(row.imageID);
  }
  if (selectedGroups.includes("curriculums")) for (const row of await prisma.curriculum.findMany({ where: { imageID: { not: null } }, select: { imageID: true } })) if (row.imageID !== null) ids.add(row.imageID);
  if (selectedGroups.includes("class-books")) for (const row of await prisma.classBook.findMany({ where: { imageID: { not: null } }, select: { imageID: true } })) if (row.imageID !== null) ids.add(row.imageID);
  return [...ids];
}

async function verifyManifest() {
  if (!s3 || !bucket) throw new Error("RustFS credentials and bucket must be configured");
  const linkedIDs = await selectedMediaIDs();
  const selectedIDs = new Set(linkedIDs);
  const records = readManifest().filter((record) => record.state === "committed" && selectedIDs.has(record.imageID));
  const errors: string[] = [];
  const recordedIDs = new Set(records.map((record) => record.imageID));
  for (const record of records) {
    try {
      const bytes = await verifyDestination(record.destination.fileKey, record.destination.sha256);
      if (bytes.length !== record.destination.fileSize) throw new Error("Destination size mismatch");
      const media = await prisma.imageMedia.findUnique({ where: { id: record.imageID } });
      if (media?.imageUrl !== record.destination.imageUrl || media.fileKey !== record.destination.fileKey) throw new Error("Database media reference differs from manifest");
    } catch (error) { errors.push(`image_media ${record.imageID} (${safeDisplayURL(record.sourceUrl)}): ${String(error)}`); }
  }
  const unrecorded = await prisma.imageMedia.findMany({ where: { id: { in: linkedIDs, notIn: [...recordedIDs] } } });
  for (const media of unrecorded) {
    if (media.provider !== "rustfs" || media.bucket !== bucket || !media.fileKey) {
      if (sourceAllowed(media.imageUrl)) {
        try {
          const bytes = await objectBytes(media.imageUrl);
          const sourceType = await fileTypeFromBuffer(bytes);
          const knownImage = Boolean(media.contentType?.startsWith("image/") || imageURL(media.imageUrl));
          const knownDocument = Boolean(media.contentType && !media.contentType.startsWith("image/") || knownDocumentURL(media.imageUrl));
          if (sourceType && !sourceType.mime.startsWith("image/") && !knownImage) continue;
          try { await detectImageContentTypeFromBytes(bytes); }
          catch { if (!knownImage && knownDocument) continue; throw new Error("source is not a supported image"); }
          errors.push(`image_media ${media.id} (${safeDisplayURL(media.imageUrl)}): image was not migrated`);
        } catch (error) {
          errors.push(`image_media ${media.id} (${safeDisplayURL(media.imageUrl)}): ${String(error)}`);
        }
      }
      continue;
    }
    try {
      const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: media.fileKey }));
      if (!response.Body) throw new Error("Destination object has no body");
      const bytes = Buffer.from(await response.Body.transformToByteArray());
      if (media.fileSize !== null && bytes.length !== media.fileSize) throw new Error("Destination size differs from metadata");
      await detectImageContentTypeFromBytes(bytes);
    } catch (error) { errors.push(`image_media ${media.id} (${safeDisplayURL(media.imageUrl)}): ${String(error)}`); }
  }
  console.log(`${records.length - errors.length}/${records.length} migrated objects verified`);
  if (errors.length) throw new Error(errors.join("\n"));
}

async function rollbackManifest() {
  const selectedIDs = new Set(await selectedMediaIDs());
  const records = readManifest().filter((record) => record.state === "committed" && selectedIDs.has(record.imageID)).reverse();
  for (const record of records) {
    await prisma.$transaction(async (tx) => {
      const media = await tx.imageMedia.findUnique({ where: { id: record.imageID } });
      if (media?.imageUrl === record.destination.imageUrl && media.fileKey === record.destination.fileKey) {
        await tx.imageMedia.update({ where: { id: record.imageID }, data: record.source });
      }
      for (const owner of record.owners) {
        const where = { id: owner.id };
        if (owner.table === "user") await tx.user.updateMany({ where: { ...where, imageUrl: owner.after }, data: { imageUrl: owner.before } });
        if (owner.table === "project" && owner.field === "thumbnailURL") await tx.project.updateMany({ where: { ...where, thumbnailURL: owner.after }, data: { thumbnailURL: owner.before } });
        if (owner.table === "project" && owner.field === "assetsURL") {
          const project = await tx.project.findUnique({ where, select: { assetsURL: true } });
          if (project) {
            const currentURLs = project.assetsURL.split(",");
            if (currentURLs.includes(record.destination.imageUrl)) {
              await tx.project.updateMany({
                where: { ...where, assetsURL: project.assetsURL },
                data: { assetsURL: currentURLs.map((url) => url === record.destination.imageUrl ? record.sourceUrl : url).join(",") },
              });
            }
          }
        }
        if (owner.table === "curriculum") await tx.curriculum.updateMany({ where: { ...where, thumbnailURL: owner.after }, data: { thumbnailURL: owner.before } });
        if (owner.table === "classBook") await tx.classBook.updateMany({ where: { ...where, thumbnailURL: owner.after }, data: { thumbnailURL: owner.before } });
        if (owner.table === "news") await tx.news.updateMany({ where: { ...where, thumbnail: owner.after }, data: { thumbnail: owner.before } });
        if (owner.table === "newsFeatures") await tx.newsFeatures.updateMany({ where: { ...where, thumbnailURL: owner.after }, data: { thumbnailURL: owner.before } });
        if (owner.table === "newsAdditionalImage") await tx.newsAdditionalImage.updateMany({ where: { ...where, imageUrl: owner.after }, data: { imageUrl: owner.before } });
      }
    });
    appendManifest({ ...record, state: "rolled-back" });
  }
  console.log(`Restored ${records.length} image record(s); source and RustFS objects were kept`);
}

try {
  if (mode === "--dry-run") await inventory();
  if (mode === "--apply") await migrateObjects();
  if (mode === "--verify") await verifyManifest();
  if (mode === "--rollback") await rollbackManifest();
} finally {
  s3?.destroy();
  await prisma.$disconnect();
}

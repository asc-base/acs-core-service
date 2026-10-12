import { describe, expect, test, vi } from "vitest";
import { mapNewsCategories, mapNewsCategoryAssignments, NEWS_CATEGORIES, syncNewsCategories } from "../../src/infrastructure/sync-news-categories";
import type { PrismaClient } from "../../src/generated/prisma/client";

describe("news category ID mapping", () => {
  test("rekeys legacy rows by code or name and creates missing canonical rows", () => {
    expect(mapNewsCategories([
      { id: 16, code: "LEGACY_TAG_16", name: "ข่าวประชาสัมพันธ์" },
      { id: 2, code: "STUDENT_ACHIEVEMENT", name: "ความสำเร็จนักศึกษา" },
    ])).toMatchObject({
      updates: [{ existing: { id: 16 }, expected: { id: 1, code: "ANNOUNCEMENT" } }],
      missing: [{ id: 3, code: "STUDENT_ACTIVITY" }],
      conflicts: [],
    });
  });

  test("reports occupied canonical IDs and ambiguous names before writes", () => {
    expect(mapNewsCategories([
      { id: 1, code: "OTHER", name: "Other" },
      { id: 10, code: "LEGACY", name: "ข่าวประชาสัมพันธ์" },
      { id: 11, code: "DUPLICATE", name: "ข่าวประชาสัมพันธ์" },
    ]).conflicts).toEqual(expect.arrayContaining([
      "category name ข่าวประชาสัมพันธ์ is duplicated",
      "category ID 1 is occupied by OTHER/Other",
    ]));
  });

  test("does not write categories when a canonical ID is occupied", async () => {
    const tx = {
      newsCategory: {
        findMany: vi.fn().mockResolvedValue([{ id: 1, code: "OTHER", name: "Other" }]),
        update: vi.fn(),
        create: vi.fn(),
      },
      news: { findMany: vi.fn(), update: vi.fn() },
      $executeRaw: vi.fn(),
    };
    const db = { $transaction: (callback: (transaction: unknown) => unknown) => callback(tx) } as unknown as PrismaClient;

    await expect(syncNewsCategories(db)).rejects.toThrow("category ID 1 is occupied");
    expect(tx.newsCategory.update).not.toHaveBeenCalled();
    expect(tx.newsCategory.create).not.toHaveBeenCalled();
  });

  test("maps news by tag name only for the news tag group", () => {
    expect(mapNewsCategoryAssignments([
      { id: 1, newsCategoryID: 16, tag: { name: "ข่าวประชาสัมพันธ์", tageGroups: { name: "news" } } },
      { id: 2, newsCategoryID: null, tag: { name: "Unknown", tageGroups: { name: "news" } } },
      { id: 3, newsCategoryID: null, tag: { name: "ข่าวประชาสัมพันธ์", tageGroups: { name: "category" } } },
    ], [...NEWS_CATEGORIES])).toEqual({
      updates: [{ newsID: 1, categoryID: 1 }],
      unmatched: [{ newsID: 2, tagName: "Unknown" }],
      conflicts: [],
    });
  });
});

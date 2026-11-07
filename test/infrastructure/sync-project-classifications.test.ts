import { describe, expect, test, vi } from "vitest";
import type { PrismaClient } from "../../src/generated/prisma/client";
import { syncProjectClassifications } from "../../src/infrastructure/sync-project-classifications";

describe("project classification seed", () => {
  test("uses the fixed IDs and resets all three sequences", async () => {
    const tx = {
      field: { upsert: vi.fn() },
      category: { upsert: vi.fn() },
      projectType: { upsert: vi.fn() },
      $executeRaw: vi.fn(),
    };
    const db = { $transaction: (callback: (transaction: unknown) => unknown) => callback(tx) } as unknown as PrismaClient;

    await syncProjectClassifications(db);

    expect(tx.field.upsert).toHaveBeenCalledWith({
      where: { name: "Artificial intelligence" }, update: {}, create: { id: 1, name: "Artificial intelligence" },
    });
    expect(tx.category.upsert).toHaveBeenCalledWith({
      where: { name: "Education" }, update: {}, create: { id: 1, name: "Education" },
    });
    expect(tx.projectType.upsert).toHaveBeenCalledWith({
      where: { name: "Research" }, update: {}, create: { id: 1, name: "Research" },
    });
    expect(tx.field.upsert).toHaveBeenCalledTimes(11);
    expect(tx.category.upsert).toHaveBeenCalledTimes(6);
    expect(tx.projectType.upsert).toHaveBeenCalledTimes(4);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(3);
  });
});

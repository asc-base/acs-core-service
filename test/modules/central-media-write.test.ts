import { describe, expect, test, vi } from "vitest";
import type { PrismaInstance } from "../../src/lib/db";
import { ProjectRepository } from "../../src/infrastructure/project.repository";
import { CurriculumRepository } from "../../src/infrastructure/curriculum.repository";
import { ClassBookRepository } from "../../src/infrastructure/class-book.repository";
import { ProjectService } from "../../src/modules/projects/project.service";
import type { IProjectRepository } from "../../src/modules/projects/domain/project.repository";
import type { IProjectFactory } from "../../src/modules/projects/project.factory";
import type { CreateProjectDTO } from "../../src/modules/projects/domain/project";
import type { ProfileImageStorage } from "../../src/infrastructure/profile-image-storage";

const cover = {
  provider: "rustfs" as const,
  bucket: "acs-media",
  fileKey: "public/projects/images/cover",
  imageUrl: "https://acs.example/media/acs-media/public/projects/images/cover",
  fileName: "cover.png",
  contentType: "image/png",
  fileSize: 4,
};

const image = () => {
  const bytes = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
  return new File([bytes], "project.png", { type: "image/png" });
};

const projectInput: CreateProjectDTO = {
  title: "Project",
  detail: "Details",
  githubURL: "https://example.test/github",
  presentationURL: "https://example.test/presentation",
  documentURL: "https://example.test/document",
  youtubeURL: "https://example.test/youtube",
  courseIds: [4],
  fieldIds: [1],
  categoryIds: [2],
  projectTypeIds: [3],
  members: [
    { userID: 11, memberType: "STUDENT", position: "Backend" },
    { userID: 12, memberType: "ADVISOR" },
  ],
  gallery: [{ fileIndex: 0 }],
  techStacks: ["TypeScript"],
};

describe("central media writes for projects", () => {
  test("cleans up uploaded images when the single project transaction fails", async () => {
    let nextID = 0;
    const storage = {
      provider: "rustfs" as const,
      upload: vi.fn(async () => ({ ...cover, fileKey: `public/projects/images/${++nextID}`, imageUrl: `https://acs.example/${nextID}` })),
      delete: vi.fn(async () => {}),
    } satisfies ProfileImageStorage;
    const repository = { createProject: vi.fn().mockRejectedValue(new Error("database failed")) } as unknown as IProjectRepository;
    const service = new ProjectService(repository, storage, {} as IProjectFactory);

    await expect(service.createProject(projectInput, { thumbnailFile: image(), assets: [image()] })).rejects.toThrow("database failed");
    expect(storage.upload).toHaveBeenCalledTimes(2);
    expect(repository.createProject).toHaveBeenCalledWith(expect.objectContaining({
      thumbnailMedia: expect.objectContaining({ contentType: "image/png", fileName: "project.png" }),
      galleryImages: [expect.objectContaining({ media: expect.objectContaining({ contentType: "image/png", fileName: "project.png" }) })],
    }));
    expect(storage.delete).toHaveBeenCalledTimes(2);
  });

  test("cleans up completed uploads when a later gallery upload fails", async () => {
    let attempts = 0;
    const storage = {
      provider: "rustfs" as const,
      upload: vi.fn(async () => {
        attempts += 1;
        if (attempts === 2) throw new Error("storage unavailable");
        return cover;
      }),
      delete: vi.fn(async () => {}),
    } satisfies ProfileImageStorage;
    const repository = { createProject: vi.fn() } as unknown as IProjectRepository;
    const service = new ProjectService(repository, storage, {} as IProjectFactory);

    await expect(service.createProject(projectInput, { thumbnailFile: image(), assets: [image()] })).rejects.toThrow("storage unavailable");
    expect(storage.upload).toHaveBeenCalledTimes(2);
    expect(storage.delete).toHaveBeenCalledOnce();
    expect(repository.createProject).not.toHaveBeenCalled();
  });

  test("rejects unreferenced gallery files before uploading media", async () => {
    const storage = {
      provider: "rustfs" as const,
      upload: vi.fn(async () => cover),
      delete: vi.fn(async () => {}),
    } satisfies ProfileImageStorage;
    const repository = { createProject: vi.fn() } as unknown as IProjectRepository;
    const service = new ProjectService(repository, storage, {} as IProjectFactory);

    await expect(service.createProject({ ...projectInput, gallery: [{ fileIndex: 1 }] }, {
      thumbnailFile: image(),
      assets: [image()],
    })).rejects.toMatchObject({ statusCode: 400 });
    expect(storage.upload).not.toHaveBeenCalled();
  });

  test("cleans up the thumbnail when a gallery file is not an image", async () => {
    const storage = {
      provider: "rustfs" as const,
      upload: vi.fn(async () => cover),
      delete: vi.fn(async () => {}),
    } satisfies ProfileImageStorage;
    const repository = { createProject: vi.fn() } as unknown as IProjectRepository;
    const service = new ProjectService(repository, storage, {} as IProjectFactory);

    await expect(service.createProject(projectInput, {
      thumbnailFile: image(),
      assets: [new File(["text file"], "bad.txt", { type: "text/plain" })],
    })).rejects.toMatchObject({ statusCode: 415 });
    expect(storage.upload).toHaveBeenCalledOnce();
    expect(storage.delete).toHaveBeenCalledOnce();
    expect(repository.createProject).not.toHaveBeenCalled();
  });

  test("writes project relations and ordered image links in one transaction", async () => {
    const tx = {
      imageMedia: { upsert: vi.fn().mockResolvedValueOnce({ id: 41 }).mockResolvedValueOnce({ id: 42 }) },
      project: { create: vi.fn().mockResolvedValue({ id: 7 }), findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 7 }) },
      projectField: { deleteMany: vi.fn(), createMany: vi.fn() },
      projectCategory: { deleteMany: vi.fn(), createMany: vi.fn() },
      projectProjectType: { deleteMany: vi.fn(), createMany: vi.fn() },
      field: { count: vi.fn().mockResolvedValue(1) },
      category: { count: vi.fn().mockResolvedValue(1) },
      projectType: { count: vi.fn().mockResolvedValue(1) },
      user: { findMany: vi.fn().mockResolvedValue([
        { id: 11, student: { deletedAt: null }, professor: null },
        { id: 12, student: null, professor: { deletedAt: null } },
      ]) },
      projectMember: { deleteMany: vi.fn(), createMany: vi.fn() },
      course: { findMany: vi.fn().mockResolvedValue([{ id: 4 }]) },
      projectCourse: { deleteMany: vi.fn(), createMany: vi.fn() },
      techStack: { upsert: vi.fn().mockResolvedValue({ id: 51 }) },
      projectTechStack: { deleteMany: vi.fn(), createMany: vi.fn() },
      projectImage: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn(), createMany: vi.fn() },
    };
    const db = { $transaction: vi.fn((work: (transaction: typeof tx) => unknown) => work(tx)) } as unknown as PrismaInstance;
    const repository = new ProjectRepository(db);

    await repository.createProject({
      ...projectInput,
      thumbnailMedia: cover,
      galleryImages: [{ media: { ...cover, fileKey: "public/projects/images/gallery", imageUrl: "https://acs.example/gallery" } }],
    });

    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(tx.project.create).toHaveBeenCalledWith({ data: expect.objectContaining({ imageID: 41, detail: "Details" }) });
    expect(tx.projectMember.createMany).toHaveBeenCalledWith({ data: [
      { projectID: 7, userID: 11, memberType: "STUDENT", position: "Backend" },
      { projectID: 7, userID: 12, memberType: "ADVISOR", position: null },
    ] });
    expect(tx.projectCourse.createMany).toHaveBeenCalledWith({ data: [{ projectID: 7, courseID: 4 }] });
    expect(tx.projectTechStack.createMany).toHaveBeenCalledWith({ data: [{ projectID: 7, techStackID: 51 }] });
    expect(tx.projectImage.createMany).toHaveBeenCalledWith({ data: [{ projectID: 7, imageID: 42, sortOrder: 0 }] });
  });

  test("creates a Curriculum with its central thumbnail in one transaction", async () => {
    const tx = {
      imageMedia: { upsert: vi.fn().mockResolvedValue({ id: 51 }) },
      curriculum: { create: vi.fn().mockResolvedValue({ id: 5 }) },
    };
    const db = { $transaction: vi.fn((work: (transaction: typeof tx) => unknown) => work(tx)) } as unknown as PrismaInstance;
    const repository = new CurriculumRepository(db);

    await repository.createCurriculum({ title: "Curriculum", year: "2026", documentURL: "document.pdf", description: "Description", thumbnailURL: cover.imageUrl, thumbnailMedia: cover });

    expect(tx.imageMedia.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: cover }));
    expect(tx.curriculum.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ imageID: 51 }) }));
  });

  test("creates a Classbook with its central thumbnail in one transaction", async () => {
    const tx = {
      imageMedia: { upsert: vi.fn().mockResolvedValue({ id: 61 }) },
      classBook: { create: vi.fn().mockResolvedValue({ id: 6 }) },
    };
    const db = { $transaction: vi.fn((work: (transaction: typeof tx) => unknown) => work(tx)) } as unknown as PrismaInstance;
    const repository = new ClassBookRepository(db);

    await repository.createClassBook({ classof: "2026", firstYearAcademic: "2022", curriculumID: 2, thumbnailURL: cover.imageUrl, thumbnailMedia: cover });

    expect(tx.imageMedia.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: cover }));
    expect(tx.classBook.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ imageID: 61 }) }));
  });
});

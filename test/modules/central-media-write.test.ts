import { describe, expect, test, vi } from "vitest";
import type { PrismaInstance } from "../../src/lib/db";
import { ProjectRepository } from "../../src/infrastructure/project.repository";
import { CurriculumRepository } from "../../src/infrastructure/curriculum.repository";
import { ClassBookRepository } from "../../src/infrastructure/class-book.repository";
import { ProjectService } from "../../src/modules/projects/project.service";
import type { IProjectRepository } from "../../src/modules/projects/domain/project.repository";
import type { IProjectFactory } from "../../src/modules/projects/project.factory";
import type { CreateProjectDTO, Project } from "../../src/modules/projects/domain/project";
import type { ProfileImageStorage } from "../../src/infrastructure/profile-image-storage";

const cover = {
  provider: "rustfs",
  bucket: "acs-media",
  fileKey: "public/projects/images/cover",
  imageUrl: "https://acs.example/media/acs-media/public/projects/images/cover",
  fileName: "cover.png",
  contentType: "image/png",
  fileSize: 4,
};

describe("central media owner writes", () => {
  test("uploads Project images to central media and cleans them up if the owner write fails", async () => {
    const bytes = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
    const image = () => new File([bytes], "project.png", { type: "image/png" });
    let nextID = 0;
    const storage = {
      provider: "rustfs" as const,
      upload: vi.fn(async () => {
        const id = ++nextID;
        return { provider: "rustfs" as const, bucket: "acs-media", fileKey: `public/projects/images/${id}`, imageUrl: `https://acs.example/${id}` };
      }),
      delete: vi.fn(async () => {}),
    } satisfies ProfileImageStorage;
    const createProject = vi.fn(async (): Promise<Project> => { throw new Error("database failed"); });
    const repository = { createProject } as unknown as IProjectRepository;
    const factory = {} as unknown as IProjectFactory;
    const service = new ProjectService(repository, storage, factory);
    const data = {
      thumbnailFile: image(),
      title: "Project",
      details: "Details",
      githubURL: "",
      presentationURL: "",
      documentURL: "",
      youtubeURL: "",
      tagsID: [],
      members: [],
      coursesID: [],
      assets: [image()],
      techStacks: [],
    } as CreateProjectDTO;

    await expect(service.createProject(data)).rejects.toThrow("database failed");
    expect(storage.upload).toHaveBeenCalledTimes(2);
    expect(storage.upload).toHaveBeenCalledWith(expect.any(File), "image/png", "projects/images");
    expect(createProject).toHaveBeenCalledWith(expect.objectContaining({
      thumbnailMedia: expect.objectContaining({ contentType: "image/png", fileName: "project.png" }),
      galleryMedia: [expect.objectContaining({ contentType: "image/png", fileName: "project.png", sortOrder: 0 })],
    }));
    expect(storage.delete).toHaveBeenCalledTimes(2);
  });

  test("creates a Project and its ordered gallery relations in one transaction", async () => {
    const tx = {
      imageMedia: { upsert: vi.fn().mockResolvedValueOnce({ id: 41 }).mockResolvedValueOnce({ id: 42 }) },
      project: { create: vi.fn().mockResolvedValue({ id: 7 }) },
    };
    const db = { $transaction: vi.fn((work: (transaction: typeof tx) => unknown) => work(tx)) } as unknown as PrismaInstance;
    const repository = new ProjectRepository(db);

    await repository.createProject({
      title: "Portal",
      details: "Details",
      githubURL: "",
      presentationURL: "",
      documentURL: "",
      youtubeURL: "",
      thumbnailURL: cover.imageUrl,
      thumbnailMedia: cover,
      assetsURL: cover.imageUrl,
      galleryMedia: [{ ...cover, sortOrder: 0 }],
      techStacks: "",
    });

    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(tx.imageMedia.upsert).toHaveBeenCalledTimes(2);
    expect(tx.project.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ imageID: 41, images: { create: [{ imageID: 42, sortOrder: 0 }] } }),
    }));
  });

  test("creates a Curriculum with its central thumbnail in one transaction", async () => {
    const tx = {
      imageMedia: { upsert: vi.fn().mockResolvedValue({ id: 51 }) },
      curriculum: { create: vi.fn().mockResolvedValue({ id: 5 }) },
    };
    const db = { $transaction: vi.fn((work: (transaction: typeof tx) => unknown) => work(tx)) } as unknown as PrismaInstance;
    const repository = new CurriculumRepository(db);

    await repository.createCurriculum({
      title: "Curriculum",
      year: "2026",
      documentURL: "document.pdf",
      description: "Description",
      thumbnailURL: cover.imageUrl,
      thumbnailMedia: cover,
    });

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

    await repository.createClassBook({
      classof: "2026",
      firstYearAcademic: "2022",
      curriculumID: 2,
      thumbnailURL: cover.imageUrl,
      thumbnailMedia: cover,
    });

    expect(tx.imageMedia.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: cover }));
    expect(tx.classBook.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ imageID: 61 }) }));
  });
});

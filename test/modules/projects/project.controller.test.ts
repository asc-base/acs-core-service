import { beforeEach, describe, expect, test, vi } from "vitest";
import { Elysia } from "elysia";
import { Value } from "@sinclair/typebox/value";
import { responseEnhancer } from "../../../src/core/interceptor/response";
import { ProjectController } from "../../../src/modules/projects/project.controller";
import { UpdateProjectDTO } from "../../../src/modules/projects/domain/project";

const { createProject, updateProject } = vi.hoisted(() => ({
  createProject: vi.fn(),
  updateProject: vi.fn(),
}));

vi.mock("../../../src/lib/db", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(async () => ({ userRoles: [{ role: { name: "admin" } }] })),
    },
  },
}));
vi.mock("../../../src/lib/auth", () => ({
  auth: { api: { getSession: vi.fn(async () => ({ user: { id: "1" } })) } },
}));
vi.mock("../../../src/infrastructure/profile-image-storage", () => ({
  createCentralImageStorage: () => ({ upload: vi.fn(), delete: vi.fn() }),
}));
vi.mock("../../../src/modules/projects/project.service", () => ({
  ProjectService: class {
    createProject = createProject;
    updateProject = updateProject;
    getProject = vi.fn();
    getProjectById = vi.fn();
    deleteProject = vi.fn();
  },
}));

const projectResponse = {
  id: 1,
  title: "Project",
  detail: "Details",
  thumbnailURL: "https://example.test/thumbnail.png",
  thumbnailContentType: "image/png",
  imageID: 1,
  thumbnailFocalPointX: 50,
  thumbnailFocalPointY: 50,
  githubURL: "https://github.com/",
  presentationURL: "https://example.test/presentation",
  documentURL: "https://example.test/document",
  figmaURL: null,
  youtubeURL: "https://example.test/youtube",
  images: [],
  techStacks: [],
  fields: [],
  categories: [],
  projectTypes: [],
  members: [],
  courses: [],
};

const createPayload = {
  title: "dasda",
  detail: "sdasdasd",
  youtubeURL: "https://www.youtube.com/watch?v=ZVR5O-ynjmk&t=1889s",
  githubURL: "https://github.com/",
  documentURL: "https://www.youtube.com/watch?v=ZVR5O-ynjmk&t=1889s",
  presentationURL: "https://www.youtube.com/watch?v=ZVR5O-ynjmk&t=1889s",
  figmaURL: "https://www.youtube.com/watch?v=ZVR5O-ynjmk&t=1889s",
  thumbnailFocalPointX: 50,
  thumbnailFocalPointY: 50,
  courseIds: [10],
  fieldIds: [1],
  categoryIds: [2],
  projectTypeIds: [1],
  techStacks: ["dasdasdasdasdasdadsd"],
  members: [
    { userID: 165, memberType: "STUDENT" },
    { userID: 206, memberType: "ADVISOR" },
  ],
  gallery: [{ fileIndex: 0 }, { fileIndex: 1 }, { fileIndex: 2 }],
};

function createProjectForm(payload: unknown, { thumbnail = true, assets = 3 } = {}) {
  const form = new FormData();
  form.set("payload", typeof payload === "string" ? payload : JSON.stringify(payload));
  if (thumbnail) form.set("thumbnailFile", new File(["thumbnail"], "thumbnail.png", { type: "image/png" }));
  for (let index = 0; index < assets; index++) {
    form.append("assets", new File([`asset-${index}`], `asset-${index}.png`, { type: "image/png" }));
  }
  return form;
}

function projectApp() {
  return new Elysia().use(responseEnhancer).use(ProjectController);
}

beforeEach(() => {
  vi.clearAllMocks();
  createProject.mockResolvedValue(projectResponse);
  updateProject.mockResolvedValue(projectResponse);
});

describe("project controller query contract", () => {
  test.each(["tagID=16", "tagId=16", "fields=16", "categories=2", "types=1"])(
    "rejects the retired filter %s",
    async (query) => {
      const app = new Elysia().use(responseEnhancer).use(ProjectController);
      const response = await app.handle(new Request(`http://localhost/project?${query}`));
      expect(response.status).toBe(400);
    },
  );

  test("validates the JSON relation payload and rejects removed fields", () => {
    expect(Value.Check(UpdateProjectDTO, {
      members: [{ userID: 7, memberType: "STUDENT", position: "Backend" }],
      courseIds: [4],
      gallery: [{ imageID: 12 }],
    })).toBe(true);
    expect(Value.Check(UpdateProjectDTO, {
      details: "old field",
      newMembers: [{ userID: 7, roleID: 2 }],
    })).toBe(false);
  });
});

describe("project controller multipart payload", () => {
  test("creates a project from a JSON payload and repeated gallery files", async () => {
    const response = await projectApp().handle(new Request("http://localhost/project", {
      method: "POST",
      body: createProjectForm(createPayload),
    }));

    expect(response.status).toBe(201);
    expect(createProject).toHaveBeenCalledOnce();
    const [payload, files] = createProject.mock.calls[0]!;
    expect(payload).toEqual(createPayload);
    expect(files.thumbnailFile.name).toBe("thumbnail.png");
    expect(files.assets.map((file: File) => file.name)).toEqual([
      "asset-0.png", "asset-1.png", "asset-2.png",
    ]);
  });

  test("updates a project with parsed payload and no uploaded files", async () => {
    const form = new FormData();
    form.set("payload", JSON.stringify({ title: "Updated" }));
    const response = await projectApp().handle(new Request("http://localhost/project/7", {
      method: "PUT",
      body: form,
    }));

    expect(response.status).toBe(200);
    expect(updateProject).toHaveBeenCalledWith(7, { title: "Updated" }, {
      thumbnailFile: undefined,
      assets: undefined,
    });
  });

  test.each([
    ["invalid JSON", "{bad"],
    ["missing required field", JSON.stringify(Object.fromEntries(
      Object.entries(createPayload).filter(([key]) => key !== "title"),
    ))],
    ["invalid member type", JSON.stringify({
      ...createPayload,
      members: [{ userID: 165, memberType: "ADMIN" }, { userID: 206, memberType: "ADVISOR" }],
    })],
    ["extra field", JSON.stringify({ ...createPayload, unexpected: true })],
    ["array payload", "[]"],
    ["null payload", "null"],
  ])("rejects %s before creating a project", async (_name, payload) => {
    const response = await projectApp().handle(new Request("http://localhost/project", {
      method: "POST",
      body: createProjectForm(payload),
    }));

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(createProject).not.toHaveBeenCalled();
  });

  test.each([
    ["thumbnail", { thumbnail: false }],
    ["gallery assets", { assets: 0 }],
  ])("still requires %s", async (_name, files) => {
    const response = await projectApp().handle(new Request("http://localhost/project", {
      method: "POST",
      body: createProjectForm(createPayload, files),
    }));

    expect(response.status).toBe(422);
    expect(createProject).not.toHaveBeenCalled();
  });
});

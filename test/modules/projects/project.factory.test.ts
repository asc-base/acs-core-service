import { describe, expect, test, vi } from "vitest";
import { ProjectFactory } from "../../../src/modules/projects/project.factory";
import type { Project } from "../../../src/modules/projects/domain/project";

describe("ProjectFactory", () => {
  test("maps relation-backed media, lookups, members, courses, and tech stacks", () => {
    const mapUserToDTO = vi.fn((user) => ({ id: user.id, email: user.email } as never));
    const mapCourseListToDTO = vi.fn().mockReturnValue([]);
    const factory = new ProjectFactory(
      { mapUserToDTO } as never,
      { mapCourseListToDTO } as never,
    );
    const project = {
      id: 7,
      title: "Project",
      detail: "Details",
      imageID: 21,
      imageMedia: { imageUrl: "/thumbnail.png", contentType: "image/png" },
      thumbnailFocalPointX: null,
      thumbnailFocalPointY: 50,
      githubURL: "https://example.test/github",
      presentationURL: "https://example.test/presentation",
      documentURL: "https://example.test/document",
      figmaURL: null,
      youtubeURL: "https://example.test/youtube",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      projectFields: [{ field: { id: 1, name: "Artificial intelligence" } }],
      projectCategories: [{ category: { id: 1, name: "Education" } }],
      projectProjectTypes: [{ type: { id: 1, name: "Research" } }],
      projectTechStacks: [{ techStack: { id: 4, name: "TypeScript" } }],
      projectMembers: [{ memberType: "ADVISOR" as const, position: "Advisor", user: { id: 3, email: "advisor@example.test" } }],
      projectCourses: [],
      images: [{ imageID: 22, sortOrder: 0, image: { imageUrl: "/gallery.png", contentType: "image/png" } }],
    } as unknown as Project;

    expect(factory.mapProjectToDTO(project)).toMatchObject({
      detail: "Details",
      thumbnailURL: "/thumbnail.png",
      thumbnailContentType: "image/png",
      fields: [{ id: 1, name: "Artificial intelligence" }],
      categories: [{ id: 1, name: "Education" }],
      projectTypes: [{ id: 1, name: "Research" }],
      techStacks: [{ id: 4, name: "TypeScript" }],
      members: [{ user: { id: 3, email: "advisor@example.test" }, memberType: "ADVISOR", position: "Advisor" }],
      images: [{ imageID: 22, imageUrl: "/gallery.png", contentType: "image/png", sortOrder: 0 }],
      courses: [],
    });
    expect(mapUserToDTO).toHaveBeenCalledOnce();
    expect(mapCourseListToDTO).toHaveBeenCalledOnce();
  });
});

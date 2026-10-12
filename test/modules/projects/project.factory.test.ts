import { describe, expect, test, vi } from "vitest";
import { ProjectFactory } from "../../../src/modules/projects/project.factory";
import type { Project } from "../../../src/modules/projects/domain/project";

describe("ProjectFactory", () => {
  test("keeps legacy tags and maps the new project lookups into the DTO", () => {
    const factory = new ProjectFactory(
      { mapUserToDTO: vi.fn() } as never,
      { mapCourseListToDTO: vi.fn().mockReturnValue([]) } as never,
    );
    const project = {
      id: 7,
      title: "Project",
      thumbnailURL: "/thumbnail.png",
      imageID: null,
      imageMedia: null,
      thumbnailFocalPointX: null,
      thumbnailFocalPointY: null,
      assetsURL: "",
      techStacks: "",
      details: "Details",
      githubURL: "",
      presentationURL: "",
      documentURL: "",
      figmaURL: null,
      youtubeURL: "",
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      projectTags: [{ tag: { id: 16, name: "Education", tageGroupsId: 3 } }],
      projectFields: [{ field: { id: 1, name: "Artificial intelligence" } }],
      projectCategories: [{ category: { id: 1, name: "Education" } }],
      projectProjectTypes: [{ type: { id: 1, name: "Research" } }],
      projectMembers: [],
      projectCourses: [],
      images: [],
    } as unknown as Project;

    expect(factory.mapProjectToDTO(project)).toMatchObject({
      tag: [{ id: 16, name: "Education", tagsGroupsId: 3 }],
      fields: [{ id: 1, name: "Artificial intelligence" }],
      categories: [{ id: 1, name: "Education" }],
      projectTypes: [{ id: 1, name: "Research" }],
    });
  });
});

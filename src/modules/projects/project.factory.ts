import { Project, ProjectDTO } from "./domain/project";
import { IUserFactory } from "../users/user.factory";
import { ICourseFactory } from "../courses/course.factory";

export interface IProjectFactory {
  mapProjectToDTO(project: Project): ProjectDTO;
  mapProjectListToDTOList(projects: Project[]): ProjectDTO[];
}

export class ProjectFactory implements IProjectFactory {
  constructor(
    private readonly userFactory: IUserFactory,
    private readonly courseFactory: ICourseFactory,
  ) {}

  mapProjectToDTO(project: Project): ProjectDTO {
    return {
      id: project.id,
      title: project.title,
      detail: project.detail,
      thumbnailURL: project.imageMedia?.imageUrl ?? "",
      thumbnailContentType: project.imageMedia?.contentType ?? null,
      imageID: project.imageID,
      thumbnailFocalPointX: project.thumbnailFocalPointX,
      thumbnailFocalPointY: project.thumbnailFocalPointY,
      githubURL: project.githubURL,
      presentationURL: project.presentationURL,
      documentURL: project.documentURL,
      figmaURL: project.figmaURL,
      youtubeURL: project.youtubeURL,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      deletedAt: project.deletedAt,
      images: project.images.map(({ imageID, sortOrder, image }) => ({
        imageID,
        imageUrl: image.imageUrl,
        contentType: image.contentType,
        sortOrder,
      })),
      techStacks: project.projectTechStacks.map(({ techStack }) => techStack),
      fields: project.projectFields.map(({ field }) => field),
      categories: project.projectCategories.map(({ category }) => category),
      projectTypes: project.projectProjectTypes.map(({ type }) => type),
      members: project.projectMembers.map(({ user, memberType, position }) => ({
        user: this.userFactory.mapUserToDTO(user),
        memberType,
        position,
      })),
      courses: this.courseFactory.mapCourseListToDTO(
        project.projectCourses.map(({ course }) => course),
      ),
    };
  }

  mapProjectListToDTOList(projects: Project[]): ProjectDTO[] {
    return projects.map((project) => this.mapProjectToDTO(project));
  }
}

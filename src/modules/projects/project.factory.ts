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
  ) { }
  mapProjectToDTO(project: Project): ProjectDTO {
    return {
      id: project.id,
      thumbnailURL: project.imageMedia?.imageUrl ?? project.thumbnailURL,
      thumbnailContentType: project.imageMedia?.contentType ?? null,
      title: project.title,
      thumbnailFocalPointX: project.thumbnailFocalPointX,
      thumbnailFocalPointY: project.thumbnailFocalPointY,
      details: project.details,
      githubURL: project.githubURL,
      presentationURL: project.presentationURL,
      documentURL: project.documentURL,
      figmaURL: project.figmaURL,
      youtubeURL: project.youtubeURL,
      assetsURL: project.assetsURL ? project.assetsURL.split(",") : [],
      images: (project.images ?? []).map(({ sortOrder, image }) => ({
        imageUrl: image.imageUrl,
        contentType: image.contentType ?? null,
        sortOrder,
      })),
      techStacks: project.techStacks ? project.techStacks.split(",") : [],

      tag: project.projectTags?.map((projectTag) => ({
        id: projectTag.tag.id,
        name: projectTag.tag.name,
        tagsGroupsId: projectTag.tag.tagsGroupsId,
      })) || [],

      member:
        project.projectMembers?.map((projectMember) => ({
          ...this.userFactory.mapUserToDTO(projectMember.user),
          role: {
            id: projectMember.role.id,
            name: projectMember.role.name,
          },
        })) ?? [],

      course: this.courseFactory.mapCourseListToDTO(
        project.projectCourses?.map((projectCourse) => projectCourse.course) || []
      ),
    };
  }

  mapProjectListToDTOList(projects: Project[]): ProjectDTO[] {
    return projects.map((project) => this.mapProjectToDTO(project));
  }
}

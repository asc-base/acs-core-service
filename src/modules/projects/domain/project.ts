import { t, Static } from "elysia";
import { BaseModelSchema, CommonQueryParams } from "../../../core/models";
import { Tag } from "../../../core/models/tag";
import { UserSchema } from "../../users/domain/user";
import { CourseSchema, CourseDTO as CourseDTOSchema } from "../../courses/domain/course";
import { RoleSchema } from "../../../core/models/role";

const FocalPointInputFields = {
  thumbnailFocalPointX: t.Optional(t.Numeric()),
  thumbnailFocalPointY: t.Optional(t.Numeric()),
};
const FocalPointResponseFields = {
  thumbnailFocalPointX: t.Optional(t.Nullable(t.Number())),
  thumbnailFocalPointY: t.Optional(t.Nullable(t.Number())),
};

export const CommonProjectFields = {
  title: t.String(),
  details: t.String(),
  githubURL: t.String(),
  presentationURL: t.String(),
  documentURL: t.String(),
  figmaURL: t.Optional(t.String()),
  youtubeURL: t.String(),
};

export const ProjectSchema = t.Intersect([
  t.Object({
    id: t.Number(),
    ...CommonProjectFields,
    ...FocalPointResponseFields,
    thumbnailURL: t.String(),
    assetsURL: t.Optional(t.String()),
    techStacks: t.String(),
    projectTags: t.Optional(t.Array(t.Object({
      tag: Tag,
    }))),
    projectMembers: t.Optional(t.Array(t.Object({
      user: UserSchema,
      role: RoleSchema,
    }))),
    projectCourses: t.Optional(t.Array(t.Object({
      course: CourseSchema,
    }))),
  }),
  BaseModelSchema,
]);

const ProjectMemberFields = {
  userID: t.Numeric(),
  roleID: t.Numeric(),
};

export const CreateProjectDTO = t.Object({
  thumbnailFile: t.File(),
  ...CommonProjectFields,
  ...FocalPointInputFields,
  tagsID: t.Array(t.Number()),
  members: t.Array(t.Object(ProjectMemberFields)),
  coursesID: t.Array(t.Number()),
  assets: t.Files(),
  techStacks: t.Array(t.String()),
});

export const ProjectDTO = t.Intersect([
  t.Object({
    id: t.Number(),
    thumbnailURL: t.String(),
    ...CommonProjectFields,
    ...FocalPointResponseFields,
    assetsURL: t.Array(t.String()),
    techStacks: t.Array(t.String()),
    tag: t.Array(Tag),

    member: t.Array(
      t.Intersect([
        UserSchema,
        t.Object({
          role: RoleSchema,
        })
      ])
    ),

    course: t.Array(CourseDTOSchema),
  })
]);

export const ProjectQueryParams = t.Object({
  tagID: t.Optional(t.Array(t.Numeric())),
  courseID: t.Optional(t.Array(t.Numeric())),
  ...CommonQueryParams,
  search: t.Optional(t.String()),
  searchBy: t.Optional(t.String()),
})

export const UpdateProjectDTO = t.Object({
  thumbnailFile: t.Optional(t.File()),
  ...Object.fromEntries(
    Object.entries(CommonProjectFields).map(([key, value]) => [
      key,
      t.Optional(value),
    ])
  ),
  ...FocalPointInputFields,
  newtagsID: t.Optional(t.Array(t.Number())),
  deletedtagsID: t.Optional(t.Array(t.Number())),
  newMembers: t.Optional(t.Array(t.Object(ProjectMemberFields))),
  deletedmembersID: t.Optional(t.Array(t.Numeric())),
  newCoursesID: t.Optional(t.Array(t.Number())),
  deletedCoursesID: t.Optional(t.Array(t.Number())),
  assets: t.Optional(t.Files()),
  techStacks: t.Optional(t.Array(t.String())),
});

export const ProjectCreatePayloadSchema = t.Object({ //มาดูอีกทีว่าต้องแก้ optional กับ required ไหม
  title: t.String(),
  details: t.String(),
  githubURL: t.String(),
  presentationURL: t.String(),
  documentURL: t.String(),
  figmaURL: t.Optional(t.String()),
  youtubeURL: t.String(),
  thumbnailURL: t.String(),
  assetsURL: t.String(),
  ...FocalPointInputFields,
  techStacks: t.String(),
});

export const ProjectUpdatePayloadSchema = t.Partial(
  t.Object({
    title: t.String(),
    details: t.String(),
    githubURL: t.String(),
    presentationURL: t.String(),
    documentURL: t.String(),
    figmaURL: t.Optional(t.String()),
    youtubeURL: t.String(),
    thumbnailURL: t.String(),
    assetsURL: t.String(),
    ...FocalPointInputFields,
    techStacks: t.String(),
    updatedAt: t.Date(),
  })
);

export const ProjectTagPayloadSchema = t.Object({
  projectID: t.Number(),
  tagID: t.Number(),
});

export const ProjectMemberPayloadSchema = t.Object({
  projectID: t.Number(),
  userID: t.Number(),
  roleID: t.Number(),
});

export const ProjectCoursePayloadSchema = t.Object({
  projectID: t.Number(),
  courseID: t.Number(),
});

export const ProjectIdParam = t.Object({
  id: t.Number(),
});

export type Project = Static<typeof ProjectSchema>;
export type CreateProjectDTO = Static<typeof CreateProjectDTO>;
export type UpdateProjectDTO = Static<typeof UpdateProjectDTO>;
export type ProjectDTO = Static<typeof ProjectDTO>;
export type ProjectQueryParams = Static<typeof ProjectQueryParams>;

export type ProjectCreatePayload = Static<typeof ProjectCreatePayloadSchema>;
export type ProjectUpdatePayload = Static<typeof ProjectUpdatePayloadSchema>;
export type ProjectTagPayload = Static<typeof ProjectTagPayloadSchema>;
export type ProjectMemberPayload = Static<typeof ProjectMemberPayloadSchema>;
export type ProjectCoursePayload = Static<typeof ProjectCoursePayloadSchema>;
export type ProjectIdParam = Static<typeof ProjectIdParam>;
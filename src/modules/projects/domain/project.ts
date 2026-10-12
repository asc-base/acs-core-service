import { t, Static } from "elysia";
import { BaseModelSchema, CommonQueryParams } from "../../../core/models";
import { UserSchema } from "../../users/domain/user";
import {
  CourseSchema,
  CourseDTO as CourseDTOSchema,
} from "../../courses/domain/course";
import { RoleSchema } from "../../../core/models/role";
import {
  ImageMediaSchema,
  StoredImageMedia,
} from "../../users/domain/image-media";
import { ProjectPlain } from "../../../generated/prismabox/Project";
import { ProjectMemberPlain } from "../../../generated/prismabox/ProjectMember";
import { ProjectCoursePlain } from "../../../generated/prismabox/ProjectCourse";
import { ProjectImagePlain } from "../../../generated/prismabox/ProjectImage";
import { ProjectFieldPlain } from "../../../generated/prismabox/ProjectField";
import { ProjectCategoryPlain } from "../../../generated/prismabox/ProjectCategory";
import { ProjectProjectTypePlain } from "../../../generated/prismabox/ProjectProjectType";
import { FieldPlain } from "../../../generated/prismabox/Field";
import { CategoryPlain } from "../../../generated/prismabox/Category";
import { ProjectTypePlain } from "../../../generated/prismabox/ProjectType";

const FocalPointInputFields = {
  thumbnailFocalPointX: t.Optional(t.Numeric()),
  thumbnailFocalPointY: t.Optional(t.Numeric()),
};
const FocalPointResponseFields = {
  thumbnailFocalPointX: t.Optional(
    ProjectPlain.properties.thumbnailFocalPointX,
  ),
  thumbnailFocalPointY: t.Optional(
    ProjectPlain.properties.thumbnailFocalPointY,
  ),
};

const ProjectImageDTO = t.Object({
  imageUrl: t.String(),
  contentType: t.Nullable(t.String()),
  sortOrder: t.Number(),
});

const ProjectFieldSchema = t.Object({
  ...ProjectFieldPlain.properties,
  field: FieldPlain,
});
const ProjectCategorySchema = t.Object({
  ...ProjectCategoryPlain.properties,
  category: CategoryPlain,
});
const ProjectProjectTypeSchema = t.Object({
  ...ProjectProjectTypePlain.properties,
  type: ProjectTypePlain,
});

export const CommonProjectFields = {
  ...t.Pick(ProjectPlain, [
    "title",
    "details",
    "githubURL",
    "presentationURL",
    "documentURL",
    "youtubeURL",
  ]).properties,
  figmaURL: t.Optional(t.String()),
};

export const ProjectSchema = t.Object({
  ...t.Pick(ProjectPlain, ["id", "thumbnailURL", "techStacks"]).properties,
  ...CommonProjectFields,
  figmaURL: t.Optional(ProjectPlain.properties.figmaURL),
  ...FocalPointResponseFields,
  thumbnailContentType: t.Optional(t.Nullable(t.String())),
  assetsURL: t.Optional(ProjectPlain.properties.assetsURL),
  imageID: t.Optional(ProjectPlain.properties.imageID),
  imageMedia: t.Optional(t.Nullable(ImageMediaSchema)),
  images: t.Optional(
    t.Array(
      t.Object({
        ...ProjectImagePlain.properties,
        image: ImageMediaSchema,
      }),
    ),
  ),
  projectFields: t.Optional(t.Array(ProjectFieldSchema)),
  projectCategories: t.Optional(t.Array(ProjectCategorySchema)),
  projectProjectTypes: t.Optional(t.Array(ProjectProjectTypeSchema)),
  projectMembers: t.Optional(
    t.Array(
      t.Object({
        ...ProjectMemberPlain.properties,
        user: UserSchema,
        role: RoleSchema,
      }),
    ),
  ),
  projectCourses: t.Optional(
    t.Array(
      t.Object({
        ...ProjectCoursePlain.properties,
        course: CourseSchema,
      }),
    ),
  ),
  ...BaseModelSchema.properties,
});

const ProjectMemberFields = {
  userID: t.Numeric(),
  roleID: t.Numeric(),
};

export const CreateProjectDTO = t.Object(
  {
    thumbnailFile: t.File(),
    ...CommonProjectFields,
    ...FocalPointInputFields,
    tagsID: t.Optional(t.Never()),
    fieldIds: t.Optional(t.Array(t.Integer({ minimum: 1 }))),
    categoryIds: t.Optional(t.Array(t.Integer({ minimum: 1 }))),
    projectTypeIds: t.Optional(t.Array(t.Integer({ minimum: 1 }))),
    members: t.Array(t.Object(ProjectMemberFields)),
    coursesID: t.Array(t.Number()),
    assets: t.Files(),
    techStacks: t.Array(t.String()),
  },
  { additionalProperties: false },
);

export const ProjectDTO = t.Object({
  ...t.Pick(ProjectPlain, ["id", "thumbnailURL"]).properties,
  thumbnailContentType: t.Optional(t.Nullable(t.String())),
  ...CommonProjectFields,
  ...FocalPointResponseFields,
  assetsURL: t.Array(t.String()),
  images: t.Optional(t.Array(ProjectImageDTO)),
  techStacks: t.Array(t.String()),
  fields: t.Array(FieldPlain),
  categories: t.Array(CategoryPlain),
  projectTypes: t.Array(ProjectTypePlain),

  member: t.Array(t.Object({ ...UserSchema.properties, role: RoleSchema })),

  course: t.Array(CourseDTOSchema),
});

export const ProjectQueryParams = t.Object(
  {
    fieldIds: t.Optional(t.Array(t.Numeric({ minimum: 1, multipleOf: 1 }))),
    categoryIds: t.Optional(t.Array(t.Numeric({ minimum: 1, multipleOf: 1 }))),
    projectTypeIds: t.Optional(
      t.Array(t.Numeric({ minimum: 1, multipleOf: 1 })),
    ),
    courseID: t.Optional(t.Array(t.Numeric())),
    ...CommonQueryParams,
    search: t.Optional(t.String()),
    searchBy: t.Optional(t.String()),
  },
  { additionalProperties: false },
);

export const UpdateProjectDTO = t.Object(
  {
    thumbnailFile: t.Optional(t.File()),
    ...Object.fromEntries(
      Object.entries(CommonProjectFields).map(([key, value]) => [
        key,
        t.Optional(value),
      ]),
    ),
    ...FocalPointInputFields,
    newtagsID: t.Optional(t.Never()),
    deletedtagsID: t.Optional(t.Never()),
    fieldIds: t.Optional(t.Array(t.Integer({ minimum: 1 }))),
    categoryIds: t.Optional(t.Array(t.Integer({ minimum: 1 }))),
    projectTypeIds: t.Optional(t.Array(t.Integer({ minimum: 1 }))),
    newMembers: t.Optional(t.Array(t.Object(ProjectMemberFields))),
    deletedmembersID: t.Optional(t.Array(t.Numeric())),
    newCoursesID: t.Optional(t.Array(t.Number())),
    deletedCoursesID: t.Optional(t.Array(t.Number())),
    assets: t.Optional(t.Files()),
    techStacks: t.Optional(t.Array(t.String())),
  },
  { additionalProperties: false },
);

export const ProjectCreatePayloadSchema = t.Object({
  ...t.Pick(ProjectPlain, [
    "title",
    "details",
    "githubURL",
    "presentationURL",
    "documentURL",
    "youtubeURL",
    "thumbnailURL",
    "assetsURL",
  ]).properties,
  figmaURL: t.Optional(t.String()),
  ...FocalPointInputFields,
  techStacks: t.String(),
  fieldIds: t.Optional(t.Array(t.Integer({ minimum: 1 }))),
  categoryIds: t.Optional(t.Array(t.Integer({ minimum: 1 }))),
  projectTypeIds: t.Optional(t.Array(t.Integer({ minimum: 1 }))),
});

export const ProjectUpdatePayloadSchema = t.Partial(
  t.Object(
    {
      ...t.Pick(ProjectPlain, [
        "title",
        "details",
        "githubURL",
        "presentationURL",
        "documentURL",
        "youtubeURL",
        "thumbnailURL",
        "assetsURL",
      ]).properties,
      figmaURL: t.Optional(t.String()),
      ...FocalPointInputFields,
      techStacks: t.String(),
      fieldIds: t.Array(t.Integer({ minimum: 1 })),
      categoryIds: t.Array(t.Integer({ minimum: 1 })),
      projectTypeIds: t.Array(t.Integer({ minimum: 1 })),
      updatedAt: t.Date(),
    },
    { additionalProperties: false },
  ),
);

export const ProjectMemberPayloadSchema = t.Object({
  ...t.Pick(ProjectMemberPlain, ["projectID", "userID", "roleID"]).properties,
});

export const ProjectCoursePayloadSchema = t.Object({
  ...t.Pick(ProjectCoursePlain, ["projectID", "courseID"]).properties,
});

export const ProjectIdParam = t.Object({
  ...t.Pick(ProjectPlain, ["id"]).properties,
});

export type Project = Static<typeof ProjectSchema>;
export type CreateProjectDTO = Static<typeof CreateProjectDTO>;
export type UpdateProjectDTO = Static<typeof UpdateProjectDTO>;
export type ProjectDTO = Static<typeof ProjectDTO>;
export type ProjectQueryParams = Static<typeof ProjectQueryParams>;

export type ProjectCreatePayload = Static<typeof ProjectCreatePayloadSchema> & {
  thumbnailMedia?: StoredImageMedia;
  galleryMedia?: Array<StoredImageMedia & { sortOrder: number }>;
};
export type ProjectUpdatePayload = Static<typeof ProjectUpdatePayloadSchema> & {
  thumbnailMedia?: StoredImageMedia;
  galleryMedia?: Array<StoredImageMedia & { sortOrder: number }>;
};
export type ProjectMemberPayload = Static<typeof ProjectMemberPayloadSchema>;
export type ProjectCoursePayload = Static<typeof ProjectCoursePayloadSchema>;
export type ProjectIdParam = Static<typeof ProjectIdParam>;

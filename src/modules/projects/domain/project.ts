import { Static, t } from "elysia";
import { BaseModelSchema } from "../../../core/models";
import { UserSchema, type User } from "../../users/domain/user";
import { CourseDTO, type Course } from "../../courses/domain/course";
import { StoredImageMedia } from "../../users/domain/image-media";

const Id = t.Integer({ minimum: 1 });
const Ids = t.Array(Id);

export const ProjectMemberTypeSchema = t.Union([
  t.Literal("STUDENT"),
  t.Literal("ADVISOR"),
  t.Literal("CO_ADVISOR"),
]);

const ProjectMemberInputSchema = t.Object(
  {
    userID: Id,
    memberType: ProjectMemberTypeSchema,
    position: t.Optional(t.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

const ProjectImageSourceSchema = t.Union([
  t.Object({ imageID: Id }, { additionalProperties: false }),
  t.Object({ fileIndex: t.Integer({ minimum: 0 }) }, { additionalProperties: false }),
]);

const ProjectFields = {
  title: t.String({ minLength: 1 }),
  detail: t.String({ minLength: 1 }),
  githubURL: t.String({ minLength: 1 }),
  presentationURL: t.String({ minLength: 1 }),
  documentURL: t.String({ minLength: 1 }),
  youtubeURL: t.String({ minLength: 1 }),
  figmaURL: t.Optional(t.Nullable(t.String())),
  thumbnailFocalPointX: t.Optional(t.Numeric()),
  thumbnailFocalPointY: t.Optional(t.Numeric()),
};

const ProjectClassificationFields = {
  fieldIds: t.Optional(Ids),
  categoryIds: t.Optional(Ids),
  projectTypeIds: t.Optional(Ids),
};

export const CreateProjectDTO = t.Object(
  {
    ...ProjectFields,
    courseIds: Ids,
    ...ProjectClassificationFields,
    members: t.Array(ProjectMemberInputSchema, { minItems: 2 }),
    gallery: t.Array(
      t.Object({ fileIndex: t.Integer({ minimum: 0 }) }, { additionalProperties: false }),
      { minItems: 1, maxItems: 10 },
    ),
    techStacks: t.Array(t.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const UpdateProjectDTO = t.Object(
  {
    title: t.Optional(ProjectFields.title),
    detail: t.Optional(ProjectFields.detail),
    githubURL: t.Optional(ProjectFields.githubURL),
    presentationURL: t.Optional(ProjectFields.presentationURL),
    documentURL: t.Optional(ProjectFields.documentURL),
    youtubeURL: t.Optional(ProjectFields.youtubeURL),
    figmaURL: t.Optional(t.Nullable(t.String())),
    thumbnailFocalPointX: t.Optional(t.Numeric()),
    thumbnailFocalPointY: t.Optional(t.Numeric()),
    courseIds: t.Optional(Ids),
    fieldIds: t.Optional(Ids),
    categoryIds: t.Optional(Ids),
    projectTypeIds: t.Optional(Ids),
    members: t.Optional(t.Array(ProjectMemberInputSchema)),
    gallery: t.Optional(t.Array(ProjectImageSourceSchema, { minItems: 1, maxItems: 10 })),
    techStacks: t.Optional(t.Array(t.String({ minLength: 1 }))),
  },
  { additionalProperties: false },
);

export const ProjectMultipartBody = t.Object({
  payload: t.String(),
  thumbnailFile: t.Optional(t.File()),
  assets: t.Optional(t.Files()),
});

export const CreateProjectMultipartBody = t.Object({
  payload: t.String(),
  thumbnailFile: t.File(),
  assets: t.Files(),
});

export const ProjectQueryParams = t.Object({
  page: t.Optional(t.Numeric({ minimum: 1 })),
  pageSize: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
  orderBy: t.Optional(t.Union([t.Literal("createdAt"), t.Literal("updatedAt"), t.Literal("title")])),
  sortBy: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
  fieldIds: t.Optional(Ids),
  categoryIds: t.Optional(Ids),
  projectTypeIds: t.Optional(Ids),
  courseID: t.Optional(Ids),
  classBookID: t.Optional(Ids),
  search: t.Optional(t.String()),
});

const ProjectLookupSchema = t.Object({ id: t.Number(), name: t.String() });

export const ProjectDTO = t.Object({
  id: t.Number(),
  title: t.String(),
  detail: t.Nullable(t.String()),
  thumbnailURL: t.String(),
  thumbnailContentType: t.Nullable(t.String()),
  imageID: t.Nullable(t.Number()),
  thumbnailFocalPointX: t.Nullable(t.Number()),
  thumbnailFocalPointY: t.Nullable(t.Number()),
  githubURL: t.String(),
  presentationURL: t.String(),
  documentURL: t.String(),
  figmaURL: t.Nullable(t.String()),
  youtubeURL: t.String(),
  images: t.Array(t.Object({
    imageID: t.Number(),
    imageUrl: t.String(),
    contentType: t.Nullable(t.String()),
    sortOrder: t.Number(),
  })),
  techStacks: t.Array(ProjectLookupSchema),
  fields: t.Array(ProjectLookupSchema),
  categories: t.Array(ProjectLookupSchema),
  projectTypes: t.Array(ProjectLookupSchema),
  members: t.Array(t.Object({
    user: UserSchema,
    memberType: ProjectMemberTypeSchema,
    position: t.Nullable(t.String()),
  })),
  courses: t.Array(CourseDTO),
  ...BaseModelSchema.properties,
});
export const ProjectSchema = ProjectDTO;

export type ProjectMemberInput = Static<typeof ProjectMemberInputSchema>;
export type ProjectImageSource = Static<typeof ProjectImageSourceSchema>;
export type CreateProjectDTO = Static<typeof CreateProjectDTO>;
export type UpdateProjectDTO = Static<typeof UpdateProjectDTO>;
export type ProjectQueryParams = Static<typeof ProjectQueryParams>;
export type Project = {
  id: number;
  title: string;
  detail: string | null;
  githubURL: string;
  presentationURL: string;
  documentURL: string;
  figmaURL: string | null;
  youtubeURL: string;
  imageID: number | null;
  thumbnailFocalPointX: number | null;
  thumbnailFocalPointY: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  imageMedia: { imageUrl: string; contentType: string | null } | null;
  images: Array<{ imageID: number; sortOrder: number; image: { imageUrl: string; contentType: string | null } }>;
  projectFields: Array<{ field: { id: number; name: string } }>;
  projectCategories: Array<{ category: { id: number; name: string } }>;
  projectProjectTypes: Array<{ type: { id: number; name: string } }>;
  projectTechStacks: Array<{ techStack: { id: number; name: string } }>;
  projectMembers: Array<{ memberType: "STUDENT" | "ADVISOR" | "CO_ADVISOR"; position: string | null; user: User }>;
  projectCourses: Array<{ course: Course }>;
};
export type ProjectDTO = Static<typeof ProjectDTO>;

export type ProjectImageWrite =
  | { imageID: number }
  | { media: StoredImageMedia };

export type ProjectCreatePayload = Omit<CreateProjectDTO, "gallery"> & {
  thumbnailMedia: StoredImageMedia;
  galleryImages: ProjectImageWrite[];
};

export type ProjectUpdatePayload = Omit<UpdateProjectDTO, "gallery"> & {
  thumbnailMedia?: StoredImageMedia;
  galleryImages?: ProjectImageWrite[];
  updatedAt: Date;
};

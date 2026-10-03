import { t, Static } from "elysia";
import { BaseModelSchema, CommonQueryParams } from "../../../core/models";
import { Tag } from "../../../core/models/tag";

export const NewsImageTypes = ["CARD", "THUMBNAIL", "DETAIL"] as const;
export type NewsImageType = (typeof NewsImageTypes)[number];
export type NewsImageInput = {
  imageType: NewsImageType;
  media: {
    provider: "rustfs" | "supabase" | "legacy_url";
    bucket?: string;
    fileKey?: string;
    imageUrl: string;
    fileName?: string;
    contentType?: string;
    fileSize?: number;
  };
  focalPointX?: number | null;
  focalPointY?: number | null;
  sortOrder?: number;
};
export type NewsImageView = {
  id: number;
  imageID: number;
  imageType: NewsImageType;
  imageUrl: string;
  focalPointX: number | null;
  focalPointY: number | null;
  sortOrder: number;
};
export type NewsCategoryView = { id: number; code: string; name: string };
export type NewsBulletinType = "HIGHLIGHT" | "ANNOUNCEMENT";
export type NewsBulletinView = { id: number; newsID: number; type: NewsBulletinType; news: News };

const CommonNewsFields = {
  title: t.String(),
  detail: t.String(),
  startDate: t.Date(),
  dueDate: t.Optional(t.Nullable(t.Date())),
};

const FocalPointInputFields = {
  thumbnailFocalPointX: t.Optional(t.Numeric({ minimum: 0, maximum: 100 })),
  thumbnailFocalPointY: t.Optional(t.Numeric({ minimum: 0, maximum: 100 })),
};

const FocalPointResponseFields = {
  thumbnailFocalPointX: t.Optional(t.Nullable(t.Number())),
  thumbnailFocalPointY: t.Optional(t.Nullable(t.Number())),
};
const CardFocalPointInputFields = {
  cardFocalPointX: t.Optional(t.Numeric({ minimum: 0, maximum: 100 })),
  cardFocalPointY: t.Optional(t.Numeric({ minimum: 0, maximum: 100 })),
};
const CardFocalPointResponseFields = {
  cardFocalPointX: t.Optional(t.Nullable(t.Number())),
  cardFocalPointY: t.Optional(t.Nullable(t.Number())),
};

export const CreateNewsDTO = t.Object({
  title: t.String(),
  detail: t.String(),
  startDate: t.Optional(t.Date()),
  dueDate: t.Optional(t.Nullable(t.Date())),
  ...FocalPointInputFields,
  ...CardFocalPointInputFields,
  thumbnail: t.Optional(t.File()),
  cardImage: t.Optional(t.File()),
  thumbnailImage: t.Optional(t.File()),
  additionalImages: t.Optional(t.Files()),
  detailImages: t.Optional(t.Files()),
  tagID: t.Optional(t.Numeric()),
  newsCategoryId: t.Optional(t.Numeric()),
  eventStartAt: t.Optional(t.Date()),
  eventEndAt: t.Optional(t.Nullable(t.Date())),
});

export const NewsSchema = t.Intersect([
  t.Object({
    id: t.Number(),
    ...CommonNewsFields,
    thumbnail: t.Nullable(t.String()),
    highlightURL: t.Optional(t.Nullable(t.String())),
    ...FocalPointResponseFields,
    ...CardFocalPointResponseFields,
    tagID: t.Numeric(),
    tag: t.Optional(Tag),
    category: t.Optional(t.Nullable(t.Object({ id: t.Number(), code: t.String(), name: t.String() }))),
    images: t.Optional(t.Array(t.Object({
      id: t.Number(), imageID: t.Number(), imageType: t.Union(NewsImageTypes.map((type) => t.Literal(type))),
      imageUrl: t.String(), focalPointX: t.Nullable(t.Number()), focalPointY: t.Nullable(t.Number()), sortOrder: t.Number(),
    }))),
    eventStartAt: t.Optional(t.Nullable(t.Date())),
    eventEndAt: t.Optional(t.Nullable(t.Date())),
  }),
  BaseModelSchema,
]);

export const NewsDTO = t.Object({
  id: t.Number(),
  thumbnailURL: t.Nullable(t.String()),
  highlightURL: t.Optional(t.Nullable(t.String())),
  ...CommonNewsFields,
  ...FocalPointResponseFields,
  ...CardFocalPointResponseFields,
  tag: t.Optional(Tag),
  category: t.Optional(t.Nullable(t.Object({ id: t.Number(), code: t.String(), name: t.String() }))),
  images: t.Optional(t.Array(t.Object({
    id: t.Number(), imageID: t.Number(), imageType: t.Union(NewsImageTypes.map((type) => t.Literal(type))),
    imageUrl: t.String(), focalPointX: t.Nullable(t.Number()), focalPointY: t.Nullable(t.Number()), sortOrder: t.Number(),
  }))),
  eventStartAt: t.Optional(t.Nullable(t.Date())),
  eventEndAt: t.Optional(t.Nullable(t.Date())),
});

export const NewsUpdateDTO = t.Partial(
  t.Object({
    ...CommonNewsFields,
    ...FocalPointInputFields,
    ...CardFocalPointInputFields,
    thumbnail: t.File(),
    cardImage: t.File(),
    thumbnailImage: t.File(),
    tagID: t.Numeric(),
    newsCategoryId: t.Numeric(),
    eventStartAt: t.Date(),
    eventEndAt: t.Nullable(t.Date()),
    deletedAdditionalImagesId: t.Array(t.Number()),
    newAdditionalImages: t.Optional(t.Files()),
    deletedImageIds: t.Optional(t.String()),
    detailImageOrder: t.Optional(t.String()),
    detailImages: t.Optional(t.Files()),
  }),
);

export const NewsQueryParams = t.Object({
  tagID: t.Optional(t.Numeric()),
  ...CommonQueryParams,
  search: t.Optional(t.String()),
  searchBy: t.Optional(t.String()),
});

export const CommonNewsFeatureFields = {
  newsID: t.Numeric(),
  tagID: t.Numeric(),
  ...FocalPointResponseFields,
};

export const UpsertNewsFeatureDTO = t.Object({
  id: t.Optional(t.Numeric()),
  ...CommonNewsFeatureFields,
  thumbnail: t.Union([
    t.String(),
    t.File({
      errorMessage: "Invalid file type. Only image files are allowed.",
    }),
  ]),
});

export const NewsFeatureSchema = t.Intersect([
  t.Object({
    id: t.Number(),
    ...CommonNewsFeatureFields,
    thumbnailURL: t.String(),
    news: NewsSchema,
  }),
  BaseModelSchema,
]);

export const NewsFeatureDTO = t.Object({
  id: t.Number(),
  ...CommonNewsFeatureFields,
  thumbnailURL: t.String(),
  news: NewsDTO,
});

export const QueryNewsFeatureParams = t.Object({
  tagID: t.Optional(t.Numeric()),
  ...CommonQueryParams,
});

export const NewsAdditionalImageSchema = t.Intersect([
  t.Object({
    id: t.Number(),
    newsID: t.Number(),
    imageUrl: t.String(),
  }),
  BaseModelSchema,
]);

export const NewsWithAdditionalImageSchema = t.Intersect([
  NewsSchema,
  t.Object({
    newsAdditionalImages: t.Array(NewsAdditionalImageSchema),
  }),
]);

export const NewsAdditionalImageDTO = t.Intersect([
  t.Object({
    id: t.Number(),
    imageUrl: t.String(),
  }),
]);

export const NewsWithAdditionalImageDTO = t.Object({
  ...NewsDTO.properties,
  newsAdditionalImages: t.Array(NewsAdditionalImageDTO),
});

const NewsImageCreatePayloadSchema = t.Object({
  imageType: t.Union(NewsImageTypes.map((type) => t.Literal(type))),
  media: t.Object({
    provider: t.String(), bucket: t.Optional(t.String()), fileKey: t.Optional(t.String()),
    imageUrl: t.String(), fileName: t.Optional(t.String()), contentType: t.Optional(t.String()), fileSize: t.Optional(t.Number()),
  }),
  focalPointX: t.Optional(t.Nullable(t.Number())),
  focalPointY: t.Optional(t.Nullable(t.Number())),
  sortOrder: t.Optional(t.Number()),
});

export const NewsCreatePayloadSchema = t.Object({
  ...CommonNewsFields,
  ...FocalPointInputFields,
  thumbnail: t.String(),
  tagID: t.Numeric(),
  newsCategoryID: t.Optional(t.Numeric()),
  eventStartAt: t.Optional(t.Date()),
  eventEndAt: t.Optional(t.Nullable(t.Date())),
  images: t.Optional(t.Array(NewsImageCreatePayloadSchema)),
  additionalImageUrls: t.Optional(t.Array(t.String())),
});

export const NewsUpdatePayloadSchema = t.Partial(
  t.Object({
    ...CommonNewsFields,
    ...FocalPointInputFields,
    thumbnail: t.String(),
    tagID: t.Numeric(),
    updatedAt: t.Date(),
    newsCategoryID: t.Numeric(),
    eventStartAt: t.Date(),
    eventEndAt: t.Nullable(t.Date()),
    ...CardFocalPointInputFields,
    thumbnailImageFocalPointX: t.Numeric(),
    thumbnailImageFocalPointY: t.Numeric(),
    images: t.Array(NewsImageCreatePayloadSchema),
    deletedImageIds: t.Array(t.Number()),
    detailImageOrder: t.Array(t.String()),
    additionalImageUrls: t.Array(t.String()),
    deletedAdditionalImagesId: t.Array(t.Number()),
  })
);

export const NewsImageViewSchema = t.Object({
  id: t.Number(), imageID: t.Number(),
  imageType: t.Union(NewsImageTypes.map((type) => t.Literal(type))),
  imageUrl: t.String(), focalPointX: t.Nullable(t.Number()), focalPointY: t.Nullable(t.Number()), sortOrder: t.Number(),
});
export const NewsCategoryViewSchema = t.Object({ id: t.Number(), code: t.String(), name: t.String() });
export const NewsBulletinTypeSchema = t.Union([t.Literal("HIGHLIGHT"), t.Literal("ANNOUNCEMENT")]);
export const NewsBulletinDTO = t.Object({ id: t.Number(), newsID: t.Number(), type: NewsBulletinTypeSchema, news: NewsDTO });

export const NewsFeaturUpsertPayloadSchema = t.Object({
  ...CommonNewsFeatureFields,
  thumbnailURL: t.String(),
});

export type CreateNewsDTO = Static<typeof CreateNewsDTO>;
export type News = Static<typeof NewsSchema>;
export type NewsDTO = Static<typeof NewsDTO>;
export type NewsUpdateDTO = Static<typeof NewsUpdateDTO>;
export type NewsQueryParams = Static<typeof NewsQueryParams>;
export type UpsertNewsFeatureDTO = Static<typeof UpsertNewsFeatureDTO>;
export type NewsFeature = Static<typeof NewsFeatureSchema>;
export type NewsFeatureDTO = Static<typeof NewsFeatureDTO>;
export type QueryNewsFeatureParams = Static<typeof QueryNewsFeatureParams>;
export type NewsCreatePayload = Static<typeof NewsCreatePayloadSchema>;
export type NewsImage = NewsImageView;
export type NewsUpdatePayload = Static<typeof NewsUpdatePayloadSchema> & {
  images?: NewsImageInput[];
};
export type NewsFeatureUpsertPayload = Static<typeof NewsFeaturUpsertPayloadSchema> & {
  media?: NewsImageInput["media"];
};
export type NewsAdditionalImage = Static<typeof NewsAdditionalImageSchema>;
export type NewsWithAdditionalImages = Static<typeof NewsWithAdditionalImageSchema>;
export type NewsWithAdditionalImageDTO = Static<typeof NewsWithAdditionalImageDTO>; 

import { t, Static } from "elysia";
import { BaseModelSchema, CommonQueryParams } from "../../../core/models";
import { NewsPlain } from "../../../generated/prismabox/News";
import { NewsImagePlain } from "../../../generated/prismabox/NewsImage";
import { NewsAdditionalImagePlain } from "../../../generated/prismabox/NewsAdditionalImage";
import { NewsCategoryPlain } from "../../../generated/prismabox/NewsCategory";
import { NewsBulletinPlain } from "../../../generated/prismabox/NewsBulletin";
import { NewsImageType as GeneratedNewsImageType } from "../../../generated/prismabox/NewsImageType";
import { NewsBulletinType as GeneratedNewsBulletinType } from "../../../generated/prismabox/NewsBulletinType";

export const NewsImageTypeSchema = GeneratedNewsImageType;
export type NewsImageType = Static<typeof NewsImageTypeSchema>;
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
export type NewsImageView = Static<typeof NewsImageViewSchema>;
export type NewsCategoryView = Static<typeof NewsCategoryPlain>;
export const NewsBulletinTypeSchema = GeneratedNewsBulletinType;
export type NewsBulletinType = Static<typeof NewsBulletinTypeSchema>;
export type NewsBulletinView = Static<typeof NewsBulletinPlain> & {
  news: News;
};

const CommonNewsFields = {
  ...t.Pick(NewsPlain, ["title", "detail", "startDate"]).properties,
  dueDate: t.Optional(NewsPlain.properties.dueDate),
};

const FocalPointInputFields = {
  thumbnailFocalPointX: t.Optional(t.Numeric({ minimum: 0, maximum: 100 })),
  thumbnailFocalPointY: t.Optional(t.Numeric({ minimum: 0, maximum: 100 })),
};

const FocalPointResponseFields = {
  thumbnailFocalPointX: t.Optional(NewsPlain.properties.thumbnailFocalPointX),
  thumbnailFocalPointY: t.Optional(NewsPlain.properties.thumbnailFocalPointY),
};
const CardFocalPointInputFields = {
  cardFocalPointX: t.Optional(t.Numeric({ minimum: 0, maximum: 100 })),
  cardFocalPointY: t.Optional(t.Numeric({ minimum: 0, maximum: 100 })),
};
const CardFocalPointResponseFields = {
  cardFocalPointX: t.Optional(t.Nullable(t.Number())),
  cardFocalPointY: t.Optional(t.Nullable(t.Number())),
};

export const CreateNewsDTO = t.Object(
  {
    ...t.Pick(NewsPlain, ["title", "detail"]).properties,
    startDate: t.Optional(t.Date()),
    dueDate: t.Optional(t.Nullable(t.Date())),
    ...FocalPointInputFields,
    ...CardFocalPointInputFields,
    tagID: t.Optional(t.Never()),
    thumbnail: t.Optional(t.File()),
    cardImage: t.Optional(t.File()),
    thumbnailImage: t.Optional(t.File()),
    additionalImages: t.Optional(t.Files()),
    detailImages: t.Optional(t.Files()),
    newsCategoryId: t.Numeric({ minimum: 1, multipleOf: 1 }),
    eventStartAt: t.Optional(t.Date()),
    eventEndAt: t.Optional(t.Nullable(t.Date())),
  },
  { additionalProperties: false },
);

export const NewsSchema = t.Object({
  ...t.Pick(NewsPlain, ["id", "thumbnail"]).properties,
  ...CommonNewsFields,
  highlightURL: t.Optional(t.Nullable(t.String())),
  ...FocalPointResponseFields,
  ...CardFocalPointResponseFields,
  category: t.Nullable(NewsCategoryPlain),
  images: t.Optional(
    t.Array(
      t.Object({
        ...t.Pick(NewsImagePlain, [
          "id",
          "imageID",
          "imageType",
          "focalPointX",
          "focalPointY",
          "sortOrder",
        ]).properties,
        imageUrl: t.String(),
      }),
    ),
  ),
  eventStartAt: t.Optional(NewsPlain.properties.eventStartAt),
  eventEndAt: t.Optional(NewsPlain.properties.eventEndAt),
  ...BaseModelSchema.properties,
});

export const NewsDTO = t.Object({
  ...t.Pick(NewsPlain, ["id"]).properties,
  thumbnailURL: NewsPlain.properties.thumbnail,
  highlightURL: t.Optional(t.Nullable(t.String())),
  ...CommonNewsFields,
  ...FocalPointResponseFields,
  ...CardFocalPointResponseFields,
  category: t.Nullable(NewsCategoryPlain),
  images: t.Optional(
    t.Array(
      t.Object({
        ...t.Pick(NewsImagePlain, [
          "id",
          "imageID",
          "imageType",
          "focalPointX",
          "focalPointY",
          "sortOrder",
        ]).properties,
        imageUrl: t.String(),
      }),
    ),
  ),
  eventStartAt: t.Optional(NewsPlain.properties.eventStartAt),
  eventEndAt: t.Optional(NewsPlain.properties.eventEndAt),
});

export const NewsUpdateDTO = t.Partial(
  t.Object(
    {
      ...CommonNewsFields,
      ...FocalPointInputFields,
      ...CardFocalPointInputFields,
      tagID: t.Optional(t.Never()),
      thumbnail: t.File(),
      cardImage: t.File(),
      thumbnailImage: t.File(),
      newsCategoryId: t.Numeric({ minimum: 1, multipleOf: 1 }),
      eventStartAt: t.Date(),
      eventEndAt: t.Nullable(t.Date()),
      deletedAdditionalImagesId: t.Array(t.Number()),
      newAdditionalImages: t.Optional(t.Files()),
      deletedImageIds: t.Optional(t.String()),
      detailImageOrder: t.Optional(t.String()),
      detailImages: t.Optional(t.Files()),
    },
    { additionalProperties: false },
  ),
);

export const NewsQueryParams = t.Object(
  {
    newsCategoryId: t.Optional(t.Numeric({ minimum: 1, multipleOf: 1 })),
    ...CommonQueryParams,
    search: t.Optional(t.String()),
    searchBy: t.Optional(t.String()),
  },
  { additionalProperties: false },
);

export const NewsAdditionalImageSchema = t.Object({
  ...t.Pick(NewsAdditionalImagePlain, ["id", "newsID", "imageUrl"]).properties,
  ...BaseModelSchema.properties,
});

export const NewsWithAdditionalImageSchema = t.Object({
  ...NewsSchema.properties,
  newsAdditionalImages: t.Array(NewsAdditionalImageSchema),
});

export const NewsAdditionalImageDTO = t.Pick(NewsAdditionalImagePlain, [
  "id",
  "imageUrl",
]);

export const NewsWithAdditionalImageDTO = t.Object({
  ...NewsDTO.properties,
  newsAdditionalImages: t.Array(NewsAdditionalImageDTO),
});

const NewsImageCreatePayloadSchema = t.Object({
  imageType: NewsImageTypeSchema,
  media: t.Object({
    provider: t.String(),
    bucket: t.Optional(t.String()),
    fileKey: t.Optional(t.String()),
    imageUrl: t.String(),
    fileName: t.Optional(t.String()),
    contentType: t.Optional(t.String()),
    fileSize: t.Optional(t.Number()),
  }),
  focalPointX: t.Optional(t.Nullable(t.Number())),
  focalPointY: t.Optional(t.Nullable(t.Number())),
  sortOrder: t.Optional(t.Number()),
});

export const NewsCreatePayloadSchema = t.Object(
  {
    ...CommonNewsFields,
    ...FocalPointInputFields,
    thumbnail: t.String(),
    newsCategoryID: t.Numeric({ minimum: 1, multipleOf: 1 }),
    eventStartAt: t.Optional(t.Date()),
    eventEndAt: t.Optional(t.Nullable(t.Date())),
    images: t.Optional(t.Array(NewsImageCreatePayloadSchema)),
    additionalImageUrls: t.Optional(t.Array(t.String())),
  },
  { additionalProperties: false },
);

export const NewsUpdatePayloadSchema = t.Partial(
  t.Object(
    {
      ...CommonNewsFields,
      ...FocalPointInputFields,
      thumbnail: t.String(),
      updatedAt: t.Date(),
      newsCategoryID: t.Numeric({ minimum: 1, multipleOf: 1 }),
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
    },
    { additionalProperties: false },
  ),
);

export const NewsImageViewSchema = t.Object({
  ...t.Pick(NewsImagePlain, [
    "id",
    "imageID",
    "imageType",
    "focalPointX",
    "focalPointY",
    "sortOrder",
  ]).properties,
  imageUrl: t.String(),
});
export const NewsCategoryViewSchema = NewsCategoryPlain;
export const NewsBulletinDTO = t.Object({
  ...t.Pick(NewsBulletinPlain, ["id", "newsID", "type"]).properties,
  news: NewsDTO,
});

export type CreateNewsDTO = Static<typeof CreateNewsDTO>;
export type News = Static<typeof NewsSchema>;
export type NewsDTO = Static<typeof NewsDTO>;
export type NewsUpdateDTO = Static<typeof NewsUpdateDTO>;
export type NewsQueryParams = Static<typeof NewsQueryParams>;
export type NewsCreatePayload = Static<typeof NewsCreatePayloadSchema>;
export type NewsImage = NewsImageView;
export type NewsUpdatePayload = Static<typeof NewsUpdatePayloadSchema> & {
  images?: NewsImageInput[];
};
export type NewsAdditionalImage = Static<typeof NewsAdditionalImageSchema>;
export type NewsWithAdditionalImages = Static<
  typeof NewsWithAdditionalImageSchema
>;
export type NewsWithAdditionalImageDTO = Static<
  typeof NewsWithAdditionalImageDTO
>;

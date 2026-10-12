import { BaseModelSchema } from "../../../core/models";
import { Static, t } from "elysia";
import { RoleSchema } from "../../../core/models/role";
import { PrefixSchema } from "../../../core/models/prefix";
import { ImageMediaSchema } from "./image-media";
import { UserPlain } from "../../../generated/prismabox/User";
import { UserRolePlain } from "../../../generated/prismabox/UserRole";

export const FocalPointInputFields = {
  imageFocalPointX: t.Optional(t.Numeric()),
  imageFocalPointY: t.Optional(t.Numeric()),
};

export const CommonUserFields = {
  ...t.Pick(UserPlain, [
    "prefixID",
    "firstNameTh",
    "lastNameTh",
    "firstNameEn",
    "lastNameEn",
    "email",
    "nickName",
  ]).properties,
  prefixID: t.Optional(t.Nullable(t.Numeric())),
  firstNameTh: t.String({
    minLength: 1,
  }),
  lastNameTh: t.String({
    minLength: 1,
  }),
  firstNameEn: t.Optional(UserPlain.properties.firstNameEn),
  lastNameEn: t.Optional(UserPlain.properties.lastNameEn),
  email: t.String({
    minLength: 5,
    format: "email",
    examples: ["acs.com@kmutt.ac.th"],
  }),
  nickName: t.Optional(
    t.Nullable(t.String({ minLength: 1, examples: ["Ace"] })),
  ),
};

export const CreateUserDTO = t.Object({
  ...CommonUserFields,
});

export const CreateSuperUserDTO = t.Object({
  ...CommonUserFields,
  password: t.String({
    minLength: 4,
    examples: ["P@ssw0rd"],
  }),
});

export const CommonUserRoleFields = {
  ...t.Pick(UserRolePlain, ["id", "userID", "roleID"]).properties,
};

export const UserRoleSchema = t.Object({
  ...CommonUserRoleFields,
  role: RoleSchema,
  ...BaseModelSchema.properties,
});

export type UserRole = Static<typeof UserRoleSchema>;

export const UserSchema = t.Object({
  ...t.Pick(UserPlain, ["id"]).properties,
  ...CommonUserFields,
  imageUrl: t.Optional(UserPlain.properties.imageUrl),
  imageID: t.Optional(UserPlain.properties.imageID),
  imageMedia: t.Optional(
    t.Nullable(t.Pick(ImageMediaSchema, ["provider", "imageUrl"])),
  ),
  imageFocalPointX: t.Optional(UserPlain.properties.imageFocalPointX),
  imageFocalPointY: t.Optional(UserPlain.properties.imageFocalPointY),
  prefix: t.Optional(t.Nullable(PrefixSchema)),
  userRoles: t.Optional(t.Array(UserRoleSchema)),
  ...BaseModelSchema.properties,
});

export const CreateUserModel = t.Object({
  ...CommonUserFields,
  imageID: t.Optional(UserPlain.properties.imageID),
  imageUrl: t.Optional(UserPlain.properties.imageUrl),
  imageFocalPointX: t.Optional(UserPlain.properties.imageFocalPointX),
  imageFocalPointY: t.Optional(UserPlain.properties.imageFocalPointY),
});

export const CreateUserRoleModel = t.Object({
  userID: t.Number(),
  roleID: t.Number(),
});

export const UpdateUserModel = t.Partial(
  t.Object({
    ...CommonUserFields,
    imageID: UserPlain.properties.imageID,
    imageUrl: UserPlain.properties.imageUrl,
    imageFocalPointX: UserPlain.properties.imageFocalPointX,
    imageFocalPointY: UserPlain.properties.imageFocalPointY,
  }),
);

export const UserDTO = t.Object({
  ...t.Pick(UserPlain, ["id"]).properties,
  ...CommonUserFields,
  prefix: t.Optional(t.Nullable(PrefixSchema)),
  imageUrl: t.Optional(UserPlain.properties.imageUrl),
  imageFocalPointX: t.Optional(UserPlain.properties.imageFocalPointX),
  imageFocalPointY: t.Optional(UserPlain.properties.imageFocalPointY),
});

export const UserProfileDTO = t.Object({
  ...UserDTO.properties,
  roles: t.Array(RoleSchema),
});

export type CreateUserDTO = Static<typeof CreateUserDTO>;
export type User = Static<typeof UserSchema>;
export type CreateUserModel = Static<typeof CreateUserModel>;
export type CreateUserRoleModel = Static<typeof CreateUserRoleModel>;
export type UpdateUserModel = Static<typeof UpdateUserModel>;
export type UserDTO = Static<typeof UserDTO>;
export type UserProfileDTO = Static<typeof UserProfileDTO>;
export type CreateSuperUserDTO = Static<typeof CreateSuperUserDTO>;

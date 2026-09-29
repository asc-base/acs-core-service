import { BaseModelSchema } from "../../../core/models";
import { Static, t } from "elysia";
import { RoleSchema } from "../../../core/models/role";
import { PrefixSchema } from "../../../core/models/prefix";

export const FocalPointInputFields = {
  imageFocalPointX: t.Optional(t.Numeric()),
  imageFocalPointY: t.Optional(t.Numeric()),
};

export const CommonUserFields = {
  prefixID: t.Optional(t.Nullable(t.Numeric())),
  firstNameTh: t.String({
    minLength: 1,
  }),
  lastNameTh: t.String({
    minLength: 1,
  }),
  firstNameEn: t.Optional(t.Nullable(t.String())),
  lastNameEn: t.Optional(t.Nullable(t.String())),
  email: t.String({
    minLength: 5,
    format: "email",
    examples: ["acs.com@kmutt.ac.th"],
  }),
  nickName: t.Optional(
    t.Nullable(
      t.String({
        minLength: 1,
        examples: ["Ace"],
      }),
    ),
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
  id: t.Number(),
  userID: t.Number(),
  roleID: t.Number(),
};

export const UserRoleSchema = t.Intersect([
  t.Object({
    ...CommonUserRoleFields,
    role: RoleSchema,
  }),
  BaseModelSchema,
]);

export type UserRole = Static<typeof UserRoleSchema>;

export const UserSchema = t.Intersect([
  t.Object({
    id: t.Number(),
    ...CommonUserFields,
    imageUrl: t.Optional(t.Nullable(t.String())),
    imageFocalPointX: t.Optional(t.Nullable(t.Number())),
    imageFocalPointY: t.Optional(t.Nullable(t.Number())),
    prefix: t.Optional(t.Nullable(PrefixSchema)),
    userRoles: t.Optional(t.Array(UserRoleSchema)),
  }),
  BaseModelSchema,
]);

export const CreateUserModel = t.Object({
  ...CommonUserFields,
  imageUrl: t.Optional(t.Nullable(t.String())),
  imageFocalPointX: t.Optional(t.Nullable(t.Number())),
  imageFocalPointY: t.Optional(t.Nullable(t.Number())),
  prefix: t.Optional(t.Nullable(PrefixSchema)),
});

export const CreateUserRoleModel = t.Object({
  userID: t.Number(),
  roleID: t.Number(),
});

export const UpdateUserModel = t.Partial(
  t.Object({
    ...CommonUserFields,
    imageUrl: t.Optional(t.Nullable(t.String())),
    imageFocalPointX: t.Optional(t.Nullable(t.Number())),
    imageFocalPointY: t.Optional(t.Nullable(t.Number())),
  }),
);

export const UserDTO = t.Object({
  id: t.Number(),
  ...CommonUserFields,
  imageUrl: t.Optional(t.Nullable(t.String())),
  imageFocalPointX: t.Optional(t.Nullable(t.Number())),
  imageFocalPointY: t.Optional(t.Nullable(t.Number())),
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

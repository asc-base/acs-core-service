import { Static, t } from "elysia";

export const CommonAuthFields = {
  email: t.String({ format: "email" }),
  password: t.String(),
};

export const AuthRequestDTO = t.Object({
  ...CommonAuthFields,
});

export const CreateCredentialsDTO = t.Object({
  email: t.String({ format: "email" }),
});

export const ResetPasswordDTO = t.Object({
  newPassword: t.String(),
});

export const AuthResponseDTO = t.Intersect([
  t.Object({
    accessToken: t.String(),
    refreshToken: t.String(),
  }),
]);

export type AuthRequestDTO = Static<typeof AuthRequestDTO>;
export type CreateCredentialsDTO = Static<typeof CreateCredentialsDTO>;
export type ResetPasswordDTO = Static<typeof ResetPasswordDTO>;
export type AuthResponseDTO = Static<typeof AuthResponseDTO>;

import { t, Static } from "elysia";

export const CommonPrefix = {
  id: t.Number(),
  sequence: t.Number(),
  nameTh: t.String(),
  nameEn: t.String(),
  shortNameTh: t.String(),
  shortNameEn: t.String(),
};

export const PrefixSchema = t.Object({
  ...CommonPrefix,
});

export type Prefix = Static<typeof PrefixSchema>;

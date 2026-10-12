import { Static } from "elysia";
import { PrefixPlain } from "../../generated/prismabox/Prefix";

export const CommonPrefix = PrefixPlain.properties;

export const PrefixSchema = PrefixPlain;

export type Prefix = Static<typeof PrefixSchema>;

import { Static } from "elysia";
import { RolePlain } from "../../generated/prismabox/Role";

export const RoleSchema = RolePlain;

export type Role = Static<typeof RoleSchema>;

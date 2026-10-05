-- Prisma manages @updatedAt values for Better Auth records. Remove the
-- database-side defaults left by the initial Better Auth migration so the
-- database matches prisma/schema.prisma.
ALTER TABLE "auth_accounts" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "auth_sessions" ALTER COLUMN "updated_at" DROP DEFAULT;
ALTER TABLE "auth_verifications" ALTER COLUMN "updated_at" DROP DEFAULT;

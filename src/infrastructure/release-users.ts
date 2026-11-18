import { Prisma } from "../generated/prisma/client";

export async function releaseUsers(
  tx: Prisma.TransactionClient,
  userIDs: number[],
  deletedAt: Date,
): Promise<void> {
  if (userIDs.length === 0) return;
  const stillActive = await tx.user.findMany({
    where: {
      id: { in: userIDs },
      OR: [
        { student: { is: { deletedAt: null } } },
        { professor: { is: { deletedAt: null } } },
      ],
    },
    select: { id: true },
  });
  const keep = new Set(stillActive.map((user) => user.id));
  const releasable = userIDs.filter((id) => !keep.has(id));
  if (releasable.length === 0) return;
  await tx.user.updateMany({
    where: { id: { in: releasable }, deletedAt: null },
    data: { deletedAt },
  });
  await tx.authUser.deleteMany({ where: { id: { in: releasable } } });
}

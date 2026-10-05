import { PrismaInstance } from "../lib/db";
import { IImageMediaRepository } from "../modules/users/domain/image-media.repository";
import { ImageMedia, ImageMediaCreate, StoredImageMedia } from "../modules/users/domain/image-media";
import { Prisma } from "../generated/prisma/client";

export async function ensureImageMedia(tx: Prisma.TransactionClient, data: StoredImageMedia): Promise<number> {
  const image = await tx.imageMedia.upsert({
    where: { imageUrl: data.imageUrl },
    create: data,
    update: {},
    select: { id: true },
  });
  return image.id;
}

export class ImageMediaRepository implements IImageMediaRepository {
  constructor(private readonly db: PrismaInstance) {}

  async create(data: ImageMediaCreate): Promise<ImageMedia> {
    return (await this.db.imageMedia.create({ data })) as ImageMedia;
  }
}

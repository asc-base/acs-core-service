import { RustFSRepository } from "./rustfs.repository";
import { SupabaseService } from "../core/utils/supabase";
import { config } from "../core/config/config";

export type ProfileImageProvider = "rustfs" | "supabase";

export type StoredImage = {
  provider: ProfileImageProvider;
  bucket: string;
  fileKey: string;
  imageUrl: string;
};

export interface ProfileImageStorage {
  readonly provider: ProfileImageProvider;
  upload(file: File, contentType: string): Promise<StoredImage>;
  delete(bucket: string, fileKey: string): Promise<void>;
}

class RustFSProfileImageStorage implements ProfileImageStorage {
  readonly provider = "rustfs" as const;
  private readonly repository: RustFSRepository;

  constructor(
    private readonly bucket: string,
    private readonly publicBaseUrl: string,
    endpoint: string,
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
  ) {
    this.repository = new RustFSRepository({
      endpoint,
      bucket,
      region,
      accessKeyId,
      secretAccessKey,
    });
  }

  async upload(file: File, contentType: string): Promise<StoredImage> {
    const fileKey = await this.repository.uploadFile(file, "profiles", contentType);
    return {
      provider: this.provider,
      bucket: this.bucket,
      fileKey,
      imageUrl: `${this.publicBaseUrl}/${fileKey}`,
    };
  }

  async delete(bucket: string, fileKey: string): Promise<void> {
    if (bucket !== this.bucket) throw new Error("Invalid RustFS bucket");
    await this.repository.deleteFile(fileKey);
  }
}

class SupabaseProfileImageStorage implements ProfileImageStorage {
  readonly provider = "supabase" as const;

  constructor(
    private readonly service: SupabaseService,
    private readonly bucket: string,
  ) {}

  async upload(file: File, contentType: string): Promise<StoredImage> {
    return {
      provider: this.provider,
      ...(await this.service.uploadFileWithMetadata(file, "profiles", contentType)),
    };
  }

  async delete(bucket: string, fileKey: string): Promise<void> {
    if (bucket !== this.bucket) throw new Error("Invalid Supabase bucket");
    await this.service.deleteFile(fileKey);
  }
}

export function createProfileImageStorage(): ProfileImageStorage {
  if (config.PROFILE_MEDIA_PROVIDER === "supabase") {
    if (!config.SUPABASE_URL || !config.SUPABASE_KEY || !config.BUCKET_NAME || config.BUCKET_NAME === "undefined") {
      throw new Error("Supabase profile media configuration is incomplete");
    }
    return new SupabaseProfileImageStorage(
      new SupabaseService(),
      config.BUCKET_NAME,
    );
  }

  if (config.PROFILE_MEDIA_PROVIDER !== "rustfs") {
    throw new Error("PROFILE_MEDIA_PROVIDER must be rustfs or supabase");
  }

  const {
    RUSTFS_ENDPOINT: endpoint,
    RUSTFS_BUCKET: bucket,
    RUSTFS_ACCESS_KEY_ID: accessKeyId,
    RUSTFS_SECRET_ACCESS_KEY: secretAccessKey,
    RUSTFS_PUBLIC_BASE_URL: publicBaseUrl,
  } = config;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicBaseUrl) {
    throw new Error("RustFS profile media configuration is incomplete");
  }
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new Error("RUSTFS_BUCKET must be a valid bucket name");
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(publicBaseUrl);
  } catch {
    throw new Error("RUSTFS_PUBLIC_BASE_URL must be an absolute HTTP(S) URL");
  }
  if (
    !["http:", "https:"].includes(baseUrl.protocol) ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    throw new Error("RUSTFS_PUBLIC_BASE_URL must be an absolute HTTP(S) URL");
  }
  if (!baseUrl.pathname.replace(/\/+$/, "").endsWith(`/${bucket}`)) {
    throw new Error("RUSTFS_PUBLIC_BASE_URL must end with the configured bucket");
  }

  return new RustFSProfileImageStorage(
    bucket,
    `${baseUrl.origin}${baseUrl.pathname.replace(/\/+$/, "")}`,
    endpoint,
    config.RUSTFS_REGION,
    accessKeyId,
    secretAccessKey,
  );
}

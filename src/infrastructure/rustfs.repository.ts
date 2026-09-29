import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

type RustFSConfig = {
  endpoint: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
};

export class RustFSRepository {
  private readonly client: S3Client;

  constructor(private readonly config: RustFSConfig) {
    let endpoint: URL;
    try {
      endpoint = new URL(config.endpoint);
    } catch {
      throw new Error("RustFS endpoint must be an absolute HTTP(S) URL");
    }
    if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
      throw new Error("RustFS endpoint must use HTTP or HTTPS");
    }
    if (!config.bucket || !config.accessKeyId || !config.secretAccessKey) {
      throw new Error("RustFS bucket and credentials are required");
    }

    this.client = new S3Client({
      endpoint: endpoint.toString(),
      region: config.region || "us-east-1",
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
    });
  }

  async uploadFile(file: File, folder = "uploads"): Promise<string> {
    if (!/^[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/.test(folder)) {
      throw new Error("Invalid RustFS folder");
    }

    const fileKey = `public/${folder}/${randomUUID()}`;
    // ponytail: buffers one file; switch to multipart streaming if large uploads become common.
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: fileKey,
        Body: new Uint8Array(await file.arrayBuffer()),
        ContentType: file.type || "application/octet-stream",
      }),
    );

    return fileKey;
  }

  async deleteFile(fileKey: string): Promise<void> {
    const segments = fileKey.split("/");
    if (
      segments[0] !== "public" ||
      segments.length < 3 ||
      segments.some((segment) => !segment || segment === "." || segment === "..")
    ) {
      throw new Error("Invalid RustFS file key");
    }

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.config.bucket,
        Key: fileKey,
      }),
    );
  }
}

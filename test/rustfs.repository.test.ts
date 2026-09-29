import { afterEach, describe, expect, test, vi } from "vitest";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { RustFSRepository } from "../src/infrastructure/rustfs.repository";

describe("RustFSRepository", () => {
  afterEach(() => vi.restoreAllMocks());

  test("uploads under the public prefix and deletes by file key", async () => {
    const send = vi
      .spyOn(S3Client.prototype, "send")
      .mockResolvedValue({} as never);
    const repository = new RustFSRepository({
      endpoint: "http://localhost:9000",
      bucket: "media",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
    });

    const fileKey = await repository.uploadFile(
      new File(["image"], "image.png", { type: "image/png" }),
      "news/images",
    );

    expect(fileKey).toMatch(/^public\/news\/images\/[0-9a-f-]{36}$/);
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(PutObjectCommand);
    expect((send.mock.calls[0]?.[0] as PutObjectCommand).input).toMatchObject({
      Bucket: "media",
      Key: fileKey,
      ContentType: "image/png",
    });

    await repository.deleteFile(fileKey);

    expect(send.mock.calls[1]?.[0]).toBeInstanceOf(DeleteObjectCommand);
    expect((send.mock.calls[1]?.[0] as DeleteObjectCommand).input).toEqual({
      Bucket: "media",
      Key: fileKey,
    });
  });

  test("rejects keys outside public storage", async () => {
    const send = vi.spyOn(S3Client.prototype, "send");
    const repository = new RustFSRepository({
      endpoint: "http://localhost:9000",
      bucket: "media",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
    });

    await expect(repository.deleteFile("private/secret")).rejects.toThrow(
      "Invalid RustFS file key",
    );
    await expect(
      repository.uploadFile(new File(["image"], "image.png"), "../private"),
    ).rejects.toThrow("Invalid RustFS folder");
    expect(send).not.toHaveBeenCalled();
  });
});

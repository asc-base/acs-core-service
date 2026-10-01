import { describe, expect, test } from "vitest";
import { validateProfileImage, MAX_PROFILE_IMAGE_SIZE } from "../../src/modules/users/profile-image-validation";

describe("validateProfileImage", () => {
  test("uses the file signature instead of the client MIME type", async () => {
    const pngBytes = Uint8Array.from(
      atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="),
      (byte) => byte.charCodeAt(0),
    );
    const png = new File(
      [pngBytes],
      "profile.png",
      { type: "text/plain" },
    );
    await expect(validateProfileImage(png)).resolves.toBe("image/png");

    const forged = new File(["<svg></svg>"], "profile.png", {
      type: "image/png",
    });
    await expect(validateProfileImage(forged)).rejects.toMatchObject({
      statusCode: 415,
    });
  });

  test("rejects profile images over 5 MiB before reading the file", async () => {
    const oversized = new File([new Uint8Array(MAX_PROFILE_IMAGE_SIZE + 1)], "large.png");
    await expect(validateProfileImage(oversized)).rejects.toMatchObject({
      statusCode: 413,
    });
  });
});

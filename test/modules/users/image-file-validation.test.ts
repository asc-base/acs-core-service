import { describe, expect, test } from "vitest";
import { detectImageContentType } from "../../../src/modules/users/image-file-validation";

describe("central image content detection", () => {
  test("accepts SVG and raster image bytes even when names have no useful suffix", async () => {
    const svg = new File(["<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"], "image.bin");
    expect(await detectImageContentType(svg)).toBe("image/svg+xml");

    const png = new File([Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"))], "image.bin");
    expect(await detectImageContentType(png)).toBe("image/png");
  });

  test("rejects content that is not an image", async () => {
    await expect(detectImageContentType(new File(["<html>bad</html>"], "fake.png", { type: "image/png" })))
      .rejects.toMatchObject({ statusCode: 415 });
  });
});

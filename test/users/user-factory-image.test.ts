import { describe, expect, test } from "vitest";
import { UserFactory } from "../../src/modules/users/user.factory";
import { User } from "../../src/modules/users/domain/user";

const user = (imageUrl: string | null, provider: "rustfs" | "legacy_url") =>
  ({
    id: 1,
    firstNameTh: "ชื่อ",
    lastNameTh: "สกุล",
    firstNameEn: null,
    lastNameEn: null,
    email: "user@example.com",
    imageUrl,
    imageMedia: imageUrl
      ? { imageUrl, provider }
      : null,
    imageFocalPointX: null,
    imageFocalPointY: null,
  }) as User;

describe("UserFactory profile image mapping", () => {
  test("returns the central media URL when present", () => {
    const media = "https://acs.kmutt.ac.th/media/acs-media/public/profiles/id";
    const source = user("https://legacy.example/old.jpg", "rustfs");
    source.imageMedia = { imageUrl: media, provider: "rustfs" };
    expect(new UserFactory().mapUserToDTO(source).imageUrl).toBe(media);
  });

  test("falls back to the legacy user URL until backfill runs", () => {
    const legacy = "https://old-storage.example/profile.jpg";
    const source = user(legacy, "legacy_url");
    source.imageMedia = null;
    expect(new UserFactory().mapUserToDTO(source).imageUrl).toBe(legacy);
  });
});

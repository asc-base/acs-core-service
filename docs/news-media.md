# News media rollout

News uploads use the shared `image_media` table and the `NEWS_MEDIA_PROVIDER` setting (default `rustfs`). New objects use `public/news/images/`; the existing provider credentials and public URL base are shared with profile media.

1. Back up the database and RustFS volume. Deploy the additive Prisma migration with the normal service entrypoint while keeping `NEWS_MEDIA_PROVIDER=rustfs` and the portal on its current build.
2. Run `npm run news-media:backfill -- --dry-run`, review the counts and warnings, then run `npm run news-media:backfill -- --apply`. The command reuses existing URLs as `legacy_url`; it does not move objects. It maps news-group tag IDs to category IDs, legacy feature tags to bulletins, and old thumbnails/additional images to CARD, THUMBNAIL, and DETAIL roles.
3. Ensure the RustFS application identity permits `PutObject` and `DeleteObject` under `acs-media/public/news/*`. The bootstrap policy grants public reads only under `public/profiles/*` and `public/news/*`. The proxy serves GET/HEAD for those paths only.
4. Deploy the portal build that loads source image URLs in the browser, verify news images and bulletin toggles in staging, then promote it. Keep the legacy columns, feature rows, and additional-image rows through the compatibility period.

The backfill reports missing thumbnails, categories outside the legacy news group, and galleries above the new 10-image limit. It preserves existing gallery images; reduce an oversized gallery before adding more images.

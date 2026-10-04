# Central media migration

The shared `image_media` catalog serves profile, news, project, curriculum and classbook images. Deploy the additive database migration and compatible core-service and portal builds before linking or copying existing objects. `MEDIA_PROVIDER`, `PROFILE_MEDIA_PROVIDER` and `NEWS_MEDIA_PROVIDER` select upload storage independently and default to RustFS. Legacy URLs and source objects remain available during the rollback period.

## Prepare storage

Set `MEDIA_PROVIDER=rustfs` and configure the RustFS endpoint, bucket, application credentials and public base URL. Run `media:bootstrap-rustfs` with the administrator credentials once so RustFS allows public reads on the approved image prefixes. The application identity needs object read/write permissions required by the migration under the source and destination prefixes. The public proxy exposes only approved GET/HEAD paths; the portal displays browser reachable image URLs directly.

The migration reads only the configured Supabase bucket, the configured RustFS public base path, or origins explicitly listed in `MEDIA_SOURCE_ALLOWED_ORIGINS`. Source requests reject redirects. External URLs outside those source paths stay at their original URL. Do not add broad or untrusted origins to the allowlist.

## Preview and migrate

Back up PostgreSQL and the source and destination object stores. Deploy the additive schema first. Check source access, row counts and duplicate references with:

```sh
docker compose exec servers npm run media:migrate -- --dry-run
docker compose exec servers npm run media:migrate -- --dry-run --groups projects,curriculums,class-books
```

The preview reports legacy rows, central media, duplicate references and source URLs outside the allowlist. Set `MEDIA_SOURCE_ALLOWED_ORIGINS` in the service environment when media lives on an approved origin beyond the configured Supabase and RustFS paths. Deploy the new portal image build before enabling migrated URLs.

Stop media writes while applying. Use the same manifest path for apply, retries, verification and rollback:

```sh
docker compose exec servers npm run media:migrate -- --apply --manifest /var/lib/acs-media-migration/production.jsonl
docker compose exec servers npm run media:migrate -- --verify --manifest /var/lib/acs-media-migration/production.jsonl
docker compose exec servers npm run media:migrate -- --rollback --manifest /var/lib/acs-media-migration/production.jsonl
```

The manifest is append-only, contains source URLs and metadata, and is written with owner-only permissions. In Compose deployments, store it under `/var/lib/acs-media-migration/`; the infrastructure Compose files mount this location on a persistent volume. Back up that volume with the database and object stores, and do not commit production manifests. Apply checks source access and image bytes, verifies destination SHA-256 and size, then updates central metadata and compatibility URLs in a database transaction. Its object key is deterministic, so reruns reuse copied data. Soft-deleted records are included with their deletion state preserved. Non-image document URLs stay unchanged.

An apply exits with an error if an allowlisted image cannot be read or verified. Correct the source or credentials and rerun with the same manifest. The source and destination objects are retained on rollback. Restore only affected references that still match the migrated value; review records changed after migration separately. Finish with profile, news bulletin/gallery, project gallery, curriculum and classbook smoke tests before reopening media writes.

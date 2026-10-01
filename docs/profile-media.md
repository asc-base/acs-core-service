# Profile media rollout

New profile uploads are routed by `PROFILE_MEDIA_PROVIDER`; keep it set to `supabase` until RustFS is provisioned. Image URLs and `image_id` are stored together, and existing `image_url` values remain available to older portal builds and Better Auth.

## Local setup

1. Set unique `RUSTFS_ADMIN_ACCESS_KEY` and `RUSTFS_ADMIN_SECRET_KEY` values in the infrastructure environment file, then start the RustFS service and portal with the dev Compose file. The RustFS console is bound to `127.0.0.1:19001`.
2. Set `PROFILE_MEDIA_PROVIDER=supabase` initially. Use the RustFS root credentials only to bootstrap the bucket and public object policy. From the same Compose project, run `npm run media:bootstrap-rustfs` in the server container with `RUSTFS_BOOTSTRAP_ACCESS_KEY` and `RUSTFS_BOOTSTRAP_SECRET_KEY` set to the administrator credentials.
3. In the RustFS console, create an application identity restricted to `s3:PutObject` and `s3:DeleteObject` on `acs-media/public/profiles/*`. Put that identity in `RUSTFS_APP_ACCESS_KEY_ID` and `RUSTFS_APP_SECRET_ACCESS_KEY`.
4. Set `PROFILE_MEDIA_PROVIDER=rustfs` and restart the server. Use `RUSTFS_PUBLIC_BASE_URL=http://localhost:3000/media/acs-media`; Next rewrites that path to the RustFS S3 endpoint in development.

The official RustFS console is available over an SSH tunnel to host port `19001`. The database migration runs through the existing startup entrypoint; legacy URL linking is an explicit command.

## Backfill existing profiles

Preview the number of distinct URLs first:

```sh
npm run media:backfill -- --dry-run
```

After deployment and review, link those URLs without downloading the files:

```sh
npm run media:backfill -- --apply
```

Both modes leave `users.image_url` untouched. `--apply` is safe to rerun; it only assigns `image_id` to users whose current URL still matches the metadata record.

## Staging and production

The deployment Compose files pin RustFS `1.0.0`, keep its data in a named volume, expose S3 only on the application network, and bind the console to localhost. Staging uses `127.0.0.1:19002:9001`; production uses `127.0.0.1:9001:9001`. A proxy on the same host can reach the console through an SSH tunnel.

Create the bucket and read-only policy with `npm run media:bootstrap-rustfs` using the RustFS administrator credentials. Then create a separate application identity with only profile-prefix `s3:PutObject` and `s3:DeleteObject` access and save its key in the deployment environment. Keep `PROFILE_MEDIA_PROVIDER=supabase` through schema deployment and backfill. Promote a portal build containing both staging and production origins, verify its media path, then change the core service to `rustfs`.

Set the portal GitHub variable `MEDIA_PUBLIC_ORIGINS` to the comma-separated HTTPS origins that serve the portal (staging and `https://acs.kmutt.ac.th`). The Docker build allowlists only `/media/acs-media/public/profiles/**` on those hosts.

Back up the database and the `acs-profile-media-*` volume before enabling RustFS in production. Restoring the previous portal and setting `PROFILE_MEDIA_PROVIDER=supabase` leaves both old and RustFS-backed profile URLs readable because each URL is persisted with its media record.

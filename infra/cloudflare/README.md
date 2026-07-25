# Cloudflare relay stack

This stack deploys `apps/server` as a Cloudflare Worker, creates the
SQLite-backed `GameRoom` Durable Object namespace, binds it as `GAMES`, and
enables the relay at its account-scoped `workers.dev` address. It also uploads
the production Vite build from `apps/web/dist` as a static-assets Worker with
single-page application routing. Each room code deterministically routes to one
Durable Object instance. A custom domain can be added later without replacing
the Worker or its Durable Objects.

Wrangler owns local development and bundling only. Terraform owns production
uploads, Durable Object migrations, bindings, observability, and routing. Do
not run `wrangler deploy` or edit those resources in the Cloudflare dashboard
after Terraform takes ownership.

## Authentication

The Cloudflare provider reads `CLOUDFLARE_API_TOKEN` from the process. Pull it
from the `infra` Doppler project rather than placing it in `tfvars`. The
token needs Workers Scripts write access for the account. It does not need zone
permissions while the relay uses `workers.dev`.

The account ID and account `workers.dev` subdomain are not secrets. Copy
`terraform.tfvars.example` to `terraform.tfvars` and fill in those two values;
the local file is ignored. In the Cloudflare dashboard, find both under
**Workers & Pages**. If the account does not have a `workers.dev` subdomain yet,
Cloudflare prompts you to choose one there.

Terraform state is stored in Cloudflare R2 so local deploys and GitHub Actions
share the same resource history. The `infra/github` bootstrap stack creates the
bucket, its bucket-scoped API token, and the GitHub credentials. Copy
`backend.hcl.example` to the ignored `backend.hcl`, fill in the bucket and
account ID, and expose the generated token's S3 credentials only to the current
shell:

```bash
export AWS_ACCESS_KEY_ID="your-r2-access-key-id"
export AWS_SECRET_ACCESS_KEY="your-r2-secret-access-key"
```

If this stack already has local state, migrate it once before deploying from
CI. Do not run this command against an empty or unrelated local state file:

```bash
terraform -chdir=infra/cloudflare init -migrate-state \
  -backend-config=backend.hcl
```

If the Workers already exist but their prior local state is unavailable, build
both applications, initialize the empty R2 backend, and import the four existing
resources before the first plan:

```bash
doppler run --project infra --config prod -- \
  terraform -chdir=infra/cloudflare import \
  cloudflare_workers_script.relay "<ACCOUNT_ID>/aom-relay"
doppler run --project infra --config prod -- \
  terraform -chdir=infra/cloudflare import \
  cloudflare_workers_script_subdomain.relay "<ACCOUNT_ID>/aom-relay"
doppler run --project infra --config prod -- \
  terraform -chdir=infra/cloudflare import \
  cloudflare_workers_script.web "<ACCOUNT_ID>/aom"
doppler run --project infra --config prod -- \
  terraform -chdir=infra/cloudflare import \
  cloudflare_workers_script_subdomain.web "<ACCOUNT_ID>/aom"
```

Before the first deploy, put the API token at
`aom_infra.common.CLOUDFLARE_API_TOKEN` in the SOPS payload and use the targeted
bootstrap in `infra/README.md` to copy it into the Doppler `infra` project.

## Local development

From the repository root:

```bash
bun install
bun run --cwd apps/server dev
```

The Worker listens on `http://localhost:3002`; the browser uses
`ws://localhost:3002/ws` and adds the room query parameter automatically.
Wrangler persists local Durable Object data beneath `.wrangler/`, which is
ignored by Git.

## Plan and deploy

Terraform uploads both build outputs, so build them before every plan. The web
build must run through its production Doppler config because Vite embeds
`VITE_RELAY_URL` into the browser bundle at build time:

```bash
bun run --cwd apps/server build
doppler run --project web --config prod -- \
  bun run --cwd apps/web build
cp infra/cloudflare/terraform.tfvars.example infra/cloudflare/terraform.tfvars
cp infra/cloudflare/backend.hcl.example infra/cloudflare/backend.hcl
doppler run --project infra --config prod -- \
  terraform -chdir=infra/cloudflare init -backend-config=backend.hcl
doppler run --project infra --config prod -- \
  terraform -chdir=infra/cloudflare plan
doppler run --project infra --config prod -- \
  terraform -chdir=infra/cloudflare apply
```

After the apply, `web_url` reports the public site URL and
`relay_websocket_url` reports the relay URL embedded by the web build. Both are
public configuration, not secrets.

## GitHub Actions

`.github/workflows/deploy-cloudflare.yml` deploys every push to `main` and can
also be run manually. The `infra/github` Terraform stack creates its
`production` environment and manages these values:

| Kind     | Name                               | Value                                                    |
| -------- | ---------------------------------- | -------------------------------------------------------- |
| Secret   | `DOPPLER_WEB_TOKEN`                | Read-only Doppler service token scoped to `web/prod`     |
| Secret   | `DOPPLER_INFRA_TOKEN`              | Read-only Doppler service token scoped to `infra/prod`   |
| Secret   | `CLOUDFLARE_R2_ACCESS_KEY_ID`      | Bucket-scoped R2 access key ID                           |
| Secret   | `CLOUDFLARE_R2_SECRET_ACCESS_KEY`  | Bucket-scoped R2 secret access key                       |
| Variable | `TF_STATE_BUCKET`                  | R2 bucket that stores Terraform state                    |
| Variable | `CLOUDFLARE_ACCOUNT_ID`            | Cloudflare account ID                                    |
| Variable | `CLOUDFLARE_WORKERS_DEV_SUBDOMAIN` | Account subdomain without `.workers.dev`                 |

For a relay custom domain, also set both optional environment variables
`CLOUDFLARE_ZONE_ID` and `RELAY_HOSTNAME`. The Doppler `infra/prod` config must
continue to provide `CLOUDFLARE_API_TOKEN`, and `web/prod` must provide
`VITE_RELAY_URL`.

## Add a custom domain later

Set both optional values in `terraform.tfvars` and apply again:

```hcl
cloudflare_zone_id = "your-zone-id"
relay_hostname     = "relay.example.com"
```

The API token will also need permission to manage that zone. Terraform keeps
the `workers.dev` route enabled as a fallback and makes the custom hostname the
reported `relay_websocket_url`.

The initial `v1` migration created `GameRoom` with SQLite-backed storage.
`wrangler.jsonc` retains the full migration history for local/Wrangler tooling,
while Terraform's direct-upload API describes only the next transition. At
steady state, `main.tf` asserts `old_tag = "v1"` and `new_tag = "v1"` with no
migration operations, preventing ordinary code or web deploys from replaying
the initial class creation.

For a future `v2` migration, first set Terraform's `old_tag` to `v1`, `new_tag`
to `v2`, and add only the new operations; append the matching `v2` entry to
`wrangler.jsonc`. After it applies successfully, leave both Terraform tags at
`v2` and remove the already-applied operations from `main.tf`.

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
doppler run --project infra --config prod -- \
  terraform -chdir=infra/cloudflare init
doppler run --project infra --config prod -- \
  terraform -chdir=infra/cloudflare plan
doppler run --project infra --config prod -- \
  terraform -chdir=infra/cloudflare apply
```

After the apply, `web_url` reports the public site URL and
`relay_websocket_url` reports the relay URL embedded by the web build. Both are
public configuration, not secrets.

## Add a custom domain later

Set both optional values in `terraform.tfvars` and apply again:

```hcl
cloudflare_zone_id = "your-zone-id"
relay_hostname     = "relay.example.com"
```

The API token will also need permission to manage that zone. Terraform keeps
the `workers.dev` route enabled as a fallback and makes the custom hostname the
reported `relay_websocket_url`.

The initial `v1` migration creates `GameRoom` with SQLite-backed storage. Future
Durable Object class changes must append a migration in both `wrangler.jsonc`
and `main.tf`; never rewrite an applied migration tag.

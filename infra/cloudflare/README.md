# Cloudflare stack

This stack will own the two Worker applications, their versions/deployments,
the relay's Durable Object namespace and migration, and both custom domains.

It currently contains the provider and input boundary only. The deployable
resources land with the Cloudflare runtime port: today's `apps/server` entry
point is Bun-specific and cannot be uploaded as a Worker yet.

## Authentication

The Cloudflare provider reads `CLOUDFLARE_API_TOKEN` from the process. Pull it
from the `aom-infra` Doppler project rather than placing it in `tfvars`:

```bash
doppler run --project aom-infra --config prod -- terraform init
doppler run --project aom-infra --config prod -- terraform plan
```

Account IDs, zone IDs, and hostnames are not secrets. Copy
`terraform.tfvars.example` to `terraform.tfvars` and fill in the real values.
The local file is ignored because deployment environments will eventually use
separate values; it is safe to commit a populated non-secret file later if we
decide there is only one environment.

Do not deploy or configure the same Worker through Wrangler or the Cloudflare
dashboard after Terraform takes ownership. Mixing owners will cause drift and
can overwrite bindings or routes.

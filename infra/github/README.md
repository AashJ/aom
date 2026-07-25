# GitHub deployment configuration

This local-state bootstrap stack creates:

- the R2 bucket that stores Cloudflare deployment state;
- a bucket-scoped R2 API token and its S3 credentials;
- read-only Doppler service tokens for `web/prod` and `infra/prod`;
- the `production` GitHub Actions environment and every variable and secret
  consumed by `.github/workflows/deploy-cloudflare.yml`.

The repository and the Doppler projects/configs already exist and remain
outside this stack.

## Authentication and inputs

Authenticate the GitHub CLI with an account that can administer Actions
environments, variables, and secrets for the repository:

```bash
gh auth login
export GITHUB_TOKEN="$(gh auth token)"
```

Expose the authenticated Doppler CLI token to the provider. It must be allowed
to create service tokens in both `web/prod` and `infra/prod`:

```bash
export DOPPLER_TOKEN="$(doppler configure get token --plain --scope /)"
```

Set a Cloudflare bootstrap API token with `API Tokens Read`, `API Tokens Write`,
and `Workers R2 Storage Write` permissions:

```bash
export CLOUDFLARE_API_TOKEN="REPLACE_ME"
```

Copy the public configuration template and fill it in:

```bash
cp infra/github/terraform.tfvars.example infra/github/terraform.tfvars
```

These three environment variables are the credential-zero layer: Terraform
needs them to create and synchronize the narrower deployment credentials, but
they are not copied into GitHub.

## Apply

```bash
terraform -chdir=infra/github init
terraform -chdir=infra/github plan
terraform -chdir=infra/github apply
unset GITHUB_TOKEN DOPPLER_TOKEN CLOUDFLARE_API_TOKEN
```

To initialize or migrate the Cloudflare deployment backend locally, load the
generated R2 credentials from the bootstrap outputs:

```bash
export AWS_ACCESS_KEY_ID="$(
  terraform -chdir=infra/github output -raw cloudflare_r2_access_key_id
)"
export AWS_SECRET_ACCESS_KEY="$(
  terraform -chdir=infra/github output -raw cloudflare_r2_secret_access_key
)"
```

If the `production` environment already exists, import it before the first
plan:

```bash
terraform -chdir=infra/github import \
  github_repository_environment.production aom:production
```

## State warning

The GitHub provider stores the managed secret values in Terraform state. This
stack deliberately uses ignored local state because it bootstraps the remote
deployment credentials themselves. Keep its state on a FileVault-protected,
non-synced disk and do not copy it into the repository. Losing this state will
also lose Terraform's record of the generated Doppler and Cloudflare tokens;
back it up in encrypted storage before relying on CI.

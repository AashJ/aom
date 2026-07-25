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

The Terraform Doppler provider needs the authenticated CLI token and must be
allowed to create service tokens in both `web/prod` and `infra/prod`. The
Cloudflare provider reads its privileged account-owned bootstrap API token from
the Terraform-managed `github-bootstrap/prod` Doppler config. The token needs
`Account API Tokens Write` and `Workers R2 Storage Write` for the target
account. Store it as
`aom_github_bootstrap.prod.CLOUDFLARE_API_TOKEN` in the SOPS payload and apply
`infra/doppler` before continuing.

Copy the public configuration template and fill it in:

```bash
cp infra/github/terraform.tfvars.example infra/github/terraform.tfvars
```

The GitHub CLI login, Doppler CLI login, and SOPS-encrypted Cloudflare token are
the credential-zero layer. Terraform needs them to create and synchronize the
narrower deployment credentials, but the privileged Cloudflare token is not
copied into GitHub.

## Apply

```bash
terraform -chdir=infra/github init
doppler run --project github-bootstrap --config prod -- \
  env GITHUB_TOKEN="$(gh auth token)" \
      DOPPLER_TOKEN="$(doppler configure get token --plain --scope /)" \
  terraform -chdir=infra/github plan
doppler run --project github-bootstrap --config prod -- \
  env GITHUB_TOKEN="$(gh auth token)" \
      DOPPLER_TOKEN="$(doppler configure get token --plain --scope /)" \
  terraform -chdir=infra/github apply
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

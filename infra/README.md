# AoM infrastructure

Terraform owns the external configuration for AoM. Doppler is the runtime
configuration store, and `infra/doppler/secrets.sops.yaml` is the Git-tracked
source of truth for values written into Doppler.

## Stacks

| Stack | Responsibility |
| --- | --- |
| [`doppler/`](doppler/) | Creates explicit `web`, `server`, and `infra` projects, their `dev`/`staging`/`prod` configs, and fans the SOPS values into each config. Each project lives in its own Terraform file, matching the AIS infrastructure layout. |
| [`cloudflare/`](cloudflare/) | Builds and deploys the static web application and relay Worker, including the per-game Durable Object binding and migration, observability, and `workers.dev` routes. Custom domains can be added later. |

Each directory is an independent Terraform stack and therefore has independent
state.

## Tooling

Install the local tools once:

```bash
brew install terraform sops age
brew install dopplerhq/cli/doppler
```

Then authenticate Doppler:

```bash
doppler login
```

The Terraform provider reads `DOPPLER_TOKEN`. For a local apply, bridge the
logged-in CLI token into the provider process:

```bash
export DOPPLER_TOKEN="$(doppler configure get token --plain --scope /)"
```

Do not persist that export in a shell profile.

## First-time secret bootstrap

The bootstrap creates an age identity, stores the private identity in macOS
Keychain under service `com.aom.sops.age`, writes only the public recipient to
`.sops.yaml`, and creates the initial encrypted payload:

```bash
cd infra/doppler
./bootstrap-keychain.sh
./decrypt.sh
```

Edit `secrets.decrypted.yaml`, replacing every `REPLACE_ME`, then:

```bash
./encrypt.sh
export SOPS_AGE_KEY_CMD="$PWD/keychain-age-key.sh"
export DOPPLER_TOKEN="$(doppler configure get token --plain --scope /)"
terraform init
terraform plan
terraform apply
unset DOPPLER_TOKEN SOPS_AGE_KEY_CMD
```

Commit `.sops.yaml` and `secrets.sops.yaml`. Never commit
`secrets.decrypted.yaml`.

Subsequent changes use the same decrypt/edit/encrypt/apply loop.

If you only have the Cloudflare credential during the initial bootstrap, replace
`aom_infra.common.CLOUDFLARE_API_TOKEN`, encrypt the file, and apply just the
three empty projects plus the `infra` configs and secret first:

```bash
export SOPS_AGE_KEY_CMD="$PWD/keychain-age-key.sh"
export DOPPLER_TOKEN="$(doppler configure get token --plain --scope /)"
terraform init
terraform apply \
  -target=doppler_project.aom_web \
  -target=doppler_project.aom_relay \
  -target=doppler_secret.aom_infra
unset DOPPLER_TOKEN SOPS_AGE_KEY_CMD
```

This targeted apply is only for breaking the first-deploy dependency cycle.
Return to an ordinary full `terraform plan` and `terraform apply` after the
relay URL and future web origins are known.

## Local application configuration

Doppler projects are intentionally split by deployment boundary:

- `web`: public Vite build configuration such as `VITE_RELAY_URL`.
- `server`: relay Worker runtime configuration and future secrets.
- `infra`: provider credentials used only while provisioning and deploying.

Run local processes through the relevant Doppler config instead of creating app
`.env` files:

```bash
doppler run --project web --config dev -- bun run dev:web
doppler run --project infra --config prod -- terraform -chdir=infra/cloudflare plan
```

`VITE_*` values are public and baked into the browser bundle even though they
are transported through Doppler.

## Redeploy production

Run one of these commands from the repository root:

```bash
bun run deploy:web     # site only
bun run deploy:server  # relay only
bun run deploy         # site and relay
```

Each command builds the relevant application before running Terraform. Review
the Terraform plan before entering `yes`. `deploy:server` and `deploy` update
the relay Worker, so running either during an active match will disconnect that
match until relay draining and reconnect/resume support are in place.

## Terraform state warning

The Doppler Terraform provider stores managed secret values in Terraform state.
The Keychain-backed age identity protects the SOPS file; it does **not** encrypt
Terraform state.

For the initial single-developer bootstrap, local state is ignored by Git and
must remain on a FileVault-protected, non-synced disk. Before CI, collaboration,
or production secrets are introduced, migrate both stacks to an encrypted
remote backend. Cloudflare R2's S3-compatible Terraform backend is a suitable
interim option; an encrypted S3 backend can replace it later.

## Moving SOPS from Keychain to AWS KMS

The Keychain integration is only an unlock adapter. When the project warrants
AWS infrastructure:

1. Add the KMS recipient to `infra/doppler/.sops.yaml`.
2. Run `sops updatekeys infra/doppler/secrets.sops.yaml` while the Keychain age
   identity is still available.
3. Verify KMS decryption, then remove the age recipient and run `updatekeys`
   again.
4. Retire the `com.aom.sops.age` Keychain item.

No Doppler resources or secret layout need to change.

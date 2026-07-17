# AoM infrastructure

Terraform owns the external configuration for AoM. Doppler is the runtime
configuration store, and `infra/doppler/secrets.sops.yaml` is the Git-tracked
source of truth for values written into Doppler.

## Stacks

| Stack | Responsibility |
| --- | --- |
| [`doppler/`](doppler/) | Creates the `aom-web`, `aom-relay`, and `aom-infra` projects, their `dev`/`staging`/`prod` environments, and fans the SOPS values into each config. |
| [`cloudflare/`](cloudflare/) | Cloudflare account resources and, after the Worker port lands, the web and relay Worker versions, deployments, Durable Object binding, and custom domains. |

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
export DOPPLER_TOKEN="$(doppler configure get token --plain)"
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
terraform init
terraform plan
terraform apply
```

Commit `.sops.yaml` and `secrets.sops.yaml`. Never commit
`secrets.decrypted.yaml`.

Subsequent changes use the same decrypt/edit/encrypt/apply loop.

## Local application configuration

Doppler projects are intentionally split by deployment boundary:

- `aom-web`: public Vite build configuration such as `VITE_RELAY_URL`.
- `aom-relay`: relay Worker runtime configuration and future secrets.
- `aom-infra`: provider credentials used only while provisioning and deploying.

Run local processes through the relevant Doppler config instead of creating app
`.env` files:

```bash
doppler run --project aom-web --config dev -- bun run dev:web
doppler run --project aom-infra --config prod -- terraform -chdir=infra/cloudflare plan
```

`VITE_*` values are public and baked into the browser bundle even though they
are transported through Doppler.

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

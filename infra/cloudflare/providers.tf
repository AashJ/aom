# Run this stack through `doppler run --project aom-infra --config prod -- ...`.
# The provider reads CLOUDFLARE_API_TOKEN directly from that process environment,
# keeping the credential out of Terraform configuration.
provider "cloudflare" {}

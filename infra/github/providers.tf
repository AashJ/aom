# The provider reads GITHUB_TOKEN from the process. See README.md for the
# recommended GitHub CLI authentication flow.
provider "github" {
  owner = var.github_owner
}

# The Doppler and Cloudflare providers read DOPPLER_TOKEN and
# CLOUDFLARE_API_TOKEN from the process. See README.md for bootstrap permissions.
provider "doppler" {}

provider "cloudflare" {}

terraform {
  required_version = ">= 1.9.8"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.22"
    }

    doppler = {
      source  = "DopplerHQ/doppler"
      version = "~> 1.21"
    }

    github = {
      source  = "integrations/github"
      version = "~> 6.13"
    }
  }
}

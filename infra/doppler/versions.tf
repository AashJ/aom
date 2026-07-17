terraform {
  required_version = ">= 1.9.8"

  required_providers {
    doppler = {
      source  = "DopplerHQ/doppler"
      version = "~> 1.21"
    }
    sops = {
      source  = "carlpett/sops"
      version = ">= 1.0.0, < 2.0.0"
    }
  }
}

/** Credential-zero secrets used only by the local GitHub bootstrap stack. */

resource "doppler_project" "aom_github_bootstrap" {
  name        = "github-bootstrap"
  description = "AoM local GitHub and Cloudflare credential bootstrap"
}

resource "doppler_environment" "aom_github_bootstrap_prod" {
  project = doppler_project.aom_github_bootstrap.name
  slug    = "prod"
  name    = "Production"
}

locals {
  aom_github_bootstrap_configs = {
    prod = doppler_environment.aom_github_bootstrap_prod.slug
  }

  aom_github_bootstrap_secrets_by_config = {
    prod = merge(
      try(local.sops_secrets.aom_github_bootstrap.common, {}),
      try(local.sops_secrets.aom_github_bootstrap.prod, {}),
    )
  }

  aom_github_bootstrap_keys_by_config = {
    for config_name, secrets in local.aom_github_bootstrap_secrets_by_config :
    config_name => nonsensitive(keys(secrets))
  }

  aom_github_bootstrap_secret_pairs = merge([
    for config_name, secret_keys in local.aom_github_bootstrap_keys_by_config : {
      for secret_key in secret_keys :
      "${config_name}/${secret_key}" => {
        config = config_name
        key    = secret_key
      }
    }
  ]...)
}

resource "doppler_secret" "aom_github_bootstrap" {
  for_each = local.aom_github_bootstrap_secret_pairs

  project    = doppler_project.aom_github_bootstrap.name
  config     = local.aom_github_bootstrap_configs[each.value.config]
  name       = each.value.key
  value      = local.aom_github_bootstrap_secrets_by_config[each.value.config][each.value.key]
  visibility = "masked"

  lifecycle {
    precondition {
      condition = (
        local.aom_github_bootstrap_secrets_by_config[each.value.config][each.value.key] != "REPLACE_ME"
      )
      error_message = "Replace aom_github_bootstrap/${each.value.config}/${each.value.key} in secrets.sops.yaml before applying."
    }
  }
}

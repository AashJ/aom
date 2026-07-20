/** AoM relay Doppler project: Worker runtime configuration for each environment. */

resource "doppler_project" "aom_relay" {
  name        = "server"
  description = "AoM relay Worker runtime configuration"
}

resource "doppler_environment" "aom_relay_dev" {
  project = doppler_project.aom_relay.name
  slug    = "dev"
  name    = "Development"
}

resource "doppler_environment" "aom_relay_staging" {
  project = doppler_project.aom_relay.name
  slug    = "staging"
  name    = "Staging"
}

resource "doppler_environment" "aom_relay_prod" {
  project = doppler_project.aom_relay.name
  slug    = "prod"
  name    = "Production"
}

locals {
  aom_relay_configs = {
    dev     = doppler_environment.aom_relay_dev.slug
    staging = doppler_environment.aom_relay_staging.slug
    prod    = doppler_environment.aom_relay_prod.slug
  }

  aom_relay_secrets_by_config = {
    for config_name in keys(local.aom_relay_configs) :
    config_name => merge(
      try(local.sops_secrets.aom_relay.common, {}),
      try(local.sops_secrets.aom_relay[config_name], {}),
    )
  }

  aom_relay_keys_by_config = {
    for config_name, secrets in local.aom_relay_secrets_by_config :
    config_name => nonsensitive(keys(secrets))
  }

  aom_relay_secret_pairs = merge([
    for config_name, secret_keys in local.aom_relay_keys_by_config : {
      for secret_key in secret_keys :
      "${config_name}/${secret_key}" => {
        config = config_name
        key    = secret_key
      }
    }
  ]...)
}

resource "doppler_secret" "aom_relay" {
  for_each = local.aom_relay_secret_pairs

  project    = doppler_project.aom_relay.name
  config     = local.aom_relay_configs[each.value.config]
  name       = each.value.key
  value      = local.aom_relay_secrets_by_config[each.value.config][each.value.key]
  visibility = "masked"

  lifecycle {
    precondition {
      condition = (
        local.aom_relay_secrets_by_config[each.value.config][each.value.key] != "REPLACE_ME"
      )
      error_message = "Replace aom_relay/${each.value.config}/${each.value.key} in secrets.sops.yaml before applying."
    }
  }
}

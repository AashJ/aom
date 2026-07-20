/** AoM web Doppler project: browser build configuration for each environment. */

resource "doppler_project" "aom_web" {
  name        = "web"
  description = "AoM browser build configuration"
}

resource "doppler_environment" "aom_web_dev" {
  project = doppler_project.aom_web.name
  slug    = "dev"
  name    = "Development"
}

resource "doppler_environment" "aom_web_staging" {
  project = doppler_project.aom_web.name
  slug    = "staging"
  name    = "Staging"
}

resource "doppler_environment" "aom_web_prod" {
  project = doppler_project.aom_web.name
  slug    = "prod"
  name    = "Production"
}

locals {
  aom_web_configs = {
    dev     = doppler_environment.aom_web_dev.slug
    staging = doppler_environment.aom_web_staging.slug
    prod    = doppler_environment.aom_web_prod.slug
  }

  aom_web_secrets_by_config = {
    for config_name in keys(local.aom_web_configs) :
    config_name => merge(
      try(local.sops_secrets.aom_web.common, {}),
      try(local.sops_secrets.aom_web[config_name], {}),
    )
  }

  aom_web_keys_by_config = {
    for config_name, secrets in local.aom_web_secrets_by_config :
    config_name => nonsensitive(keys(secrets))
  }

  aom_web_secret_pairs = merge([
    for config_name, secret_keys in local.aom_web_keys_by_config : {
      for secret_key in secret_keys :
      "${config_name}/${secret_key}" => {
        config = config_name
        key    = secret_key
      }
    }
  ]...)
}

resource "doppler_secret" "aom_web" {
  for_each = local.aom_web_secret_pairs

  project    = doppler_project.aom_web.name
  config     = local.aom_web_configs[each.value.config]
  name       = each.value.key
  value      = local.aom_web_secrets_by_config[each.value.config][each.value.key]
  visibility = "masked"

  lifecycle {
    precondition {
      condition = (
        local.aom_web_secrets_by_config[each.value.config][each.value.key] != "REPLACE_ME"
      )
      error_message = "Replace aom_web/${each.value.config}/${each.value.key} in secrets.sops.yaml before applying."
    }
  }
}

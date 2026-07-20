/** AoM infrastructure Doppler project: provider credentials for Terraform. */

resource "doppler_project" "aom_infra" {
  name        = "infra"
  description = "AoM infrastructure provider credentials"
}

resource "doppler_environment" "aom_infra_dev" {
  project = doppler_project.aom_infra.name
  slug    = "dev"
  name    = "Development"
}

resource "doppler_environment" "aom_infra_staging" {
  project = doppler_project.aom_infra.name
  slug    = "staging"
  name    = "Staging"
}

resource "doppler_environment" "aom_infra_prod" {
  project = doppler_project.aom_infra.name
  slug    = "prod"
  name    = "Production"
}

locals {
  aom_infra_configs = {
    dev     = doppler_environment.aom_infra_dev.slug
    staging = doppler_environment.aom_infra_staging.slug
    prod    = doppler_environment.aom_infra_prod.slug
  }

  aom_infra_secrets_by_config = {
    for config_name in keys(local.aom_infra_configs) :
    config_name => merge(
      try(local.sops_secrets.aom_infra.common, {}),
      try(local.sops_secrets.aom_infra[config_name], {}),
    )
  }

  aom_infra_keys_by_config = {
    for config_name, secrets in local.aom_infra_secrets_by_config :
    config_name => nonsensitive(keys(secrets))
  }

  aom_infra_secret_pairs = merge([
    for config_name, secret_keys in local.aom_infra_keys_by_config : {
      for secret_key in secret_keys :
      "${config_name}/${secret_key}" => {
        config = config_name
        key    = secret_key
      }
    }
  ]...)
}

resource "doppler_secret" "aom_infra" {
  for_each = local.aom_infra_secret_pairs

  project    = doppler_project.aom_infra.name
  config     = local.aom_infra_configs[each.value.config]
  name       = each.value.key
  value      = local.aom_infra_secrets_by_config[each.value.config][each.value.key]
  visibility = "masked"

  lifecycle {
    precondition {
      condition = (
        local.aom_infra_secrets_by_config[each.value.config][each.value.key] != "REPLACE_ME"
      )
      error_message = "Replace aom_infra/${each.value.config}/${each.value.key} in secrets.sops.yaml before applying."
    }
  }
}

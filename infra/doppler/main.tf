data "sops_file" "secrets" {
  source_file = "${path.module}/secrets.sops.yaml"
}

locals {
  sops_secrets = yamldecode(data.sops_file.secrets.raw)

  projects = {
    web = {
      name        = "aom-web"
      description = "AoM browser build configuration"
    }
    relay = {
      name        = "aom-relay"
      description = "AoM relay Worker runtime configuration"
    }
    infra = {
      name        = "aom-infra"
      description = "AoM infrastructure provider credentials"
    }
  }

  # Keep sensitive SOPS values outside `projects` so Terraform can safely use
  # the non-sensitive project definition map for resource `for_each` keys.
  secret_roots = {
    web   = local.sops_secrets.aom_web
    relay = local.sops_secrets.aom_relay
    infra = local.sops_secrets.aom_infra
  }

  environments = {
    dev = {
      name = "Development"
    }
    staging = {
      name = "Staging"
    }
    prod = {
      name = "Production"
    }
  }

  project_environments = merge([
    for project_key, project in local.projects : {
      for environment_key, environment in local.environments :
      "${project_key}/${environment_key}" => {
        project_key      = project_key
        environment_key  = environment_key
        project_name     = project.name
        environment_name = environment.name
      }
    }
  ]...)

  secrets_by_project_environment = {
    for instance_key, instance in local.project_environments :
    instance_key => merge(
      try(local.secret_roots[instance.project_key].common, {}),
      try(local.secret_roots[instance.project_key][instance.environment_key], {}),
    )
  }

  secret_keys_by_project_environment = {
    for instance_key, secrets in local.secrets_by_project_environment :
    instance_key => nonsensitive(keys(secrets))
  }

  secret_pairs = merge([
    for instance_key, secret_keys in local.secret_keys_by_project_environment : {
      for secret_key in secret_keys :
      "${instance_key}/${secret_key}" => {
        instance_key = instance_key
        secret_key   = secret_key
      }
    }
  ]...)
}

resource "doppler_project" "project" {
  for_each = local.projects

  name        = each.value.name
  description = each.value.description
}

resource "doppler_environment" "environment" {
  for_each = local.project_environments

  project = doppler_project.project[each.value.project_key].name
  slug    = each.value.environment_key
  name    = each.value.environment_name
}

resource "doppler_secret" "secret" {
  for_each = local.secret_pairs

  project = doppler_project.project[
    local.project_environments[each.value.instance_key].project_key
  ].name
  config = doppler_environment.environment[each.value.instance_key].slug
  name   = each.value.secret_key
  value = local.secrets_by_project_environment[each.value.instance_key][
    each.value.secret_key
  ]

  visibility = "masked"

  lifecycle {
    precondition {
      condition = local.secrets_by_project_environment[each.value.instance_key][
        each.value.secret_key
      ] != "REPLACE_ME"
      error_message = "Replace ${each.value.instance_key}/${each.value.secret_key} in secrets.sops.yaml before applying."
    }
  }
}

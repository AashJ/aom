locals {
  production_variables = merge(
    {
      CLOUDFLARE_ACCOUNT_ID            = var.cloudflare_account_id
      CLOUDFLARE_WORKERS_DEV_SUBDOMAIN = var.cloudflare_workers_dev_subdomain
      TF_STATE_BUCKET                  = var.terraform_state_bucket
    },
    var.cloudflare_zone_id == null ? {} : {
      CLOUDFLARE_ZONE_ID = var.cloudflare_zone_id
    },
    var.relay_hostname == null ? {} : {
      RELAY_HOSTNAME = var.relay_hostname
    },
  )

  r2_bucket_resource = "com.cloudflare.edge.r2.bucket.${var.cloudflare_account_id}_default_${cloudflare_r2_bucket.terraform_state.name}"
}

check "custom_domain_inputs" {
  assert {
    condition     = (var.cloudflare_zone_id == null) == (var.relay_hostname == null)
    error_message = "cloudflare_zone_id and relay_hostname must either both be set or both be omitted."
  }
}

data "cloudflare_api_token_permission_groups_list" "r2_bucket_item_write" {
  name      = "Workers%20R2%20Storage%20Bucket%20Item%20Write"
  scope     = "com.cloudflare.edge.r2.bucket"
  max_items = 1
}

resource "cloudflare_r2_bucket" "terraform_state" {
  account_id = var.cloudflare_account_id
  name       = var.terraform_state_bucket
}

resource "cloudflare_api_token" "terraform_state" {
  name = "aom-terraform-state"

  policies = [{
    effect = "allow"
    permission_groups = [{
      id = one(data.cloudflare_api_token_permission_groups_list.r2_bucket_item_write.result).id
    }]
    resources = jsonencode({
      (local.r2_bucket_resource) = "*"
    })
  }]
}

resource "doppler_service_token" "web_production" {
  project = "web"
  config  = "prod"
  name    = "GitHub Actions production web"
  access  = "read"
}

resource "doppler_service_token" "infra_production" {
  project = "infra"
  config  = "prod"
  name    = "GitHub Actions production infrastructure"
  access  = "read"
}

resource "github_repository_environment" "production" {
  repository  = var.github_repository
  environment = var.github_environment
}

resource "github_actions_environment_variable" "production" {
  for_each = local.production_variables

  repository    = var.github_repository
  environment   = github_repository_environment.production.environment
  variable_name = each.key
  value         = each.value
}

resource "github_actions_environment_secret" "doppler_web_token" {
  repository  = var.github_repository
  environment = github_repository_environment.production.environment
  secret_name = "DOPPLER_WEB_TOKEN"
  value       = doppler_service_token.web_production.key
}

resource "github_actions_environment_secret" "doppler_infra_token" {
  repository  = var.github_repository
  environment = github_repository_environment.production.environment
  secret_name = "DOPPLER_INFRA_TOKEN"
  value       = doppler_service_token.infra_production.key
}

resource "github_actions_environment_secret" "cloudflare_r2_access_key_id" {
  repository  = var.github_repository
  environment = github_repository_environment.production.environment
  secret_name = "CLOUDFLARE_R2_ACCESS_KEY_ID"
  value       = cloudflare_api_token.terraform_state.id
}

resource "github_actions_environment_secret" "cloudflare_r2_secret_access_key" {
  repository  = var.github_repository
  environment = github_repository_environment.production.environment
  secret_name = "CLOUDFLARE_R2_SECRET_ACCESS_KEY"
  value       = sha256(cloudflare_api_token.terraform_state.value)
}

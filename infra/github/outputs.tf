output "deployment_environment" {
  description = "GitHub Actions environment managed by this stack."
  value       = github_repository_environment.production.environment
}

output "deployment_variables" {
  description = "Names of the GitHub Actions environment variables managed by this stack."
  value       = sort(keys(github_actions_environment_variable.production))
}

output "deployment_secrets" {
  description = "Names of the GitHub Actions environment secrets managed by this stack."
  value = [
    github_actions_environment_secret.doppler_web_token.secret_name,
    github_actions_environment_secret.doppler_infra_token.secret_name,
    github_actions_environment_secret.cloudflare_r2_access_key_id.secret_name,
    github_actions_environment_secret.cloudflare_r2_secret_access_key.secret_name,
  ]
}

output "terraform_state_bucket" {
  description = "R2 bucket used by the Cloudflare deployment backend."
  value       = cloudflare_r2_bucket.terraform_state.name
}

output "cloudflare_r2_access_key_id" {
  description = "Access key ID for local access to the R2 Terraform-state bucket."
  value       = cloudflare_account_token.terraform_state.id
  sensitive   = true
}

output "cloudflare_r2_secret_access_key" {
  description = "Secret access key for local access to the R2 Terraform-state bucket."
  value       = sha256(cloudflare_account_token.terraform_state.value)
  sensitive   = true
}

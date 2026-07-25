variable "github_owner" {
  description = "GitHub user or organization that owns the repository."
  type        = string
}

variable "github_repository" {
  description = "GitHub repository that contains the deployment workflow."
  type        = string
}

variable "github_environment" {
  description = "GitHub Actions environment used for production deployments."
  type        = string
  default     = "production"
}

variable "cloudflare_account_id" {
  description = "Cloudflare account that owns the AoM Workers and R2 state bucket."
  type        = string
}

variable "cloudflare_workers_dev_subdomain" {
  description = "Cloudflare account subdomain without the .workers.dev suffix."
  type        = string
}

variable "terraform_state_bucket" {
  description = "R2 bucket to create for the Cloudflare Terraform backend."
  type        = string
  default     = "aom-terraform-state"
}

variable "cloudflare_zone_id" {
  description = "Optional Cloudflare zone used by the relay custom domain."
  type        = string
  default     = null
  nullable    = true
}

variable "relay_hostname" {
  description = "Optional custom hostname for the relay Worker."
  type        = string
  default     = null
  nullable    = true
}

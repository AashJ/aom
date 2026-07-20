variable "cloudflare_account_id" {
  description = "Cloudflare account that owns the AoM Workers."
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Optional Cloudflare zone used by the relay custom domain. Omit while using workers.dev."
  type        = string
  default     = null
  nullable    = true
}

variable "relay_hostname" {
  description = "Optional custom hostname for the relay Worker. Omit while using workers.dev."
  type        = string
  default     = null
  nullable    = true
}

variable "workers_dev_subdomain" {
  description = "Cloudflare account subdomain, without the .workers.dev suffix."
  type        = string

  validation {
    condition = (
      length(var.workers_dev_subdomain) <= 63 &&
      can(regex("^[a-z0-9]([a-z0-9-]*[a-z0-9])?$", var.workers_dev_subdomain))
    )
    error_message = "workers_dev_subdomain must be a valid lowercase DNS label without .workers.dev."
  }
}

variable "relay_worker_name" {
  description = "Cloudflare Worker script name for the multiplayer relay."
  type        = string
  default     = "aom-relay"
}

variable "web_worker_name" {
  description = "Cloudflare Worker script name for the static web application."
  type        = string
  default     = "aom"
}

variable "workers_compatibility_date" {
  description = "Workers runtime compatibility date used by the relay bundle."
  type        = string
  default     = "2026-07-17"
}

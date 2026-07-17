variable "cloudflare_account_id" {
  description = "Cloudflare account that owns the AoM Workers."
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone used by the web and relay custom domains."
  type        = string
}

variable "web_hostname" {
  description = "Production hostname for the static web Worker."
  type        = string
}

variable "relay_hostname" {
  description = "Production hostname for the relay Worker."
  type        = string
}

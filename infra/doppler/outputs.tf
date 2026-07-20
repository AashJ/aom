output "aom_web_doppler_project" {
  description = "Doppler project name for the browser build."
  value       = doppler_project.aom_web.name
}

output "aom_web_doppler_configs" {
  description = "Doppler config slugs for the browser build."
  value       = local.aom_web_configs
}

output "aom_relay_doppler_project" {
  description = "Doppler project name for the Cloudflare relay Worker."
  value       = doppler_project.aom_relay.name
}

output "aom_relay_doppler_configs" {
  description = "Doppler config slugs for the Cloudflare relay Worker."
  value       = local.aom_relay_configs
}

output "aom_infra_doppler_project" {
  description = "Doppler project name for Terraform provider credentials."
  value       = doppler_project.aom_infra.name
}

output "aom_infra_doppler_configs" {
  description = "Doppler config slugs for Terraform provider credentials."
  value       = local.aom_infra_configs
}

output "projects" {
  description = "All Doppler project names managed by this stack."
  value = {
    web   = doppler_project.aom_web.name
    relay = doppler_project.aom_relay.name
    infra = doppler_project.aom_infra.name
  }
}

output "configs" {
  description = "All Doppler config slugs managed by this stack."
  value = {
    web   = local.aom_web_configs
    relay = local.aom_relay_configs
    infra = local.aom_infra_configs
  }
}

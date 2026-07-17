output "projects" {
  description = "Doppler project names managed by this stack."
  value = {
    for project_key, project in doppler_project.project :
    project_key => project.name
  }
}

output "configs" {
  description = "Doppler root config slugs managed by this stack."
  value = {
    for instance_key, environment in doppler_environment.environment :
    instance_key => environment.slug
  }
}

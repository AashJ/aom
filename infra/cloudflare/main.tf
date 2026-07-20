locals {
  relay_bundle         = "${path.module}/../../apps/server/dist/index.js"
  web_assets           = "${path.module}/../../apps/web/dist"
  use_custom_domain    = var.cloudflare_zone_id != null && var.relay_hostname != null
  workers_dev_hostname = "${var.relay_worker_name}.${var.workers_dev_subdomain}.workers.dev"
  web_hostname         = "${var.web_worker_name}.${var.workers_dev_subdomain}.workers.dev"
  relay_hostname       = local.use_custom_domain ? var.relay_hostname : local.workers_dev_hostname
}

check "custom_domain_inputs" {
  assert {
    condition     = (var.cloudflare_zone_id == null) == (var.relay_hostname == null)
    error_message = "cloudflare_zone_id and relay_hostname must either both be set or both be omitted."
  }
}

resource "cloudflare_workers_script" "relay" {
  account_id     = var.cloudflare_account_id
  script_name    = var.relay_worker_name
  content_file   = local.relay_bundle
  content_sha256 = filesha256(local.relay_bundle)
  main_module    = "index.js"

  compatibility_date = var.workers_compatibility_date

  bindings = [
    {
      name       = "GAMES"
      type       = "durable_object_namespace"
      class_name = "GameRoom"
    }
  ]

  migrations = {
    new_tag            = "v1"
    new_sqlite_classes = ["GameRoom"]
  }

  observability = {
    enabled = true
  }
}

resource "cloudflare_workers_script_subdomain" "relay" {
  account_id       = var.cloudflare_account_id
  script_name      = cloudflare_workers_script.relay.script_name
  enabled          = true
  previews_enabled = false
}

resource "cloudflare_workers_script" "web" {
  account_id  = var.cloudflare_account_id
  script_name = var.web_worker_name

  compatibility_date = var.workers_compatibility_date

  assets = {
    directory = local.web_assets
    config = {
      not_found_handling = "single-page-application"
    }
  }
}

resource "cloudflare_workers_script_subdomain" "web" {
  account_id       = var.cloudflare_account_id
  script_name      = cloudflare_workers_script.web.script_name
  enabled          = true
  previews_enabled = false
}

resource "cloudflare_workers_custom_domain" "relay" {
  count = local.use_custom_domain ? 1 : 0

  account_id = var.cloudflare_account_id
  zone_id    = var.cloudflare_zone_id
  hostname   = var.relay_hostname
  service    = cloudflare_workers_script.relay.script_name
}

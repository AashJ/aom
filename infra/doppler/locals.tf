data "sops_file" "secrets" {
  source_file = "${path.module}/secrets.sops.yaml"
}

locals {
  sops_secrets = yamldecode(data.sops_file.secrets.raw)
}

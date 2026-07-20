output "relay_websocket_url" {
  description = "WebSocket URL to store as web/VITE_RELAY_URL."
  value       = "wss://${local.relay_hostname}/ws"
}

output "relay_http_url" {
  description = "HTTP URL for relay health checks."
  value       = "https://${local.relay_hostname}"
}

output "relay_worker_name" {
  description = "Cloudflare Worker that owns the per-game Durable Objects."
  value       = cloudflare_workers_script.relay.script_name
}

output "web_url" {
  description = "Public URL for the AoM web application."
  value       = "https://${local.web_hostname}"
}

output "web_worker_name" {
  description = "Cloudflare Worker that serves the web application assets."
  value       = cloudflare_workers_script.web.script_name
}

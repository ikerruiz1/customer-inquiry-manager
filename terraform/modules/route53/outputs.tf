output "zone_id" {
  description = "Route 53 Public Hosted Zone ID"
  value       = aws_route53_zone.primary.zone_id
}

output "name_servers" {
  description = "Authoritative AWS Name Servers to delegate in get.tech registrar"
  value       = aws_route53_zone.primary.name_servers
}

output "arn" {
  description = "Route 53 Public Hosted Zone ARN"
  value       = aws_route53_zone.primary.arn
}

resource "aws_route53_zone" "primary" {
  name          = var.domain_name
  force_destroy = true

  tags = {
    Name        = "${var.project_name}-zone-${var.environment}"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

# Route 53 evaluates ALB health independently of the target group health checks, so a loss of
# capacity in one Availability Zone withdraws the zone from DNS instead of serving 5xx to
# every user until an Auto Scaling policy reacts. This is the only control that fails over
# faster than the Auto Scaling cooldown.
#
# The check targets `/health/live` rather than `/health/ready` on purpose: the readiness probe
# couples application liveness to database reachability, so a database blip would mark the
# whole load balancer unhealthy and withdraw DNS for the entire application, converting a
# degraded database into a total outage.
resource "aws_route53_health_check" "alb" {
  type              = "HTTP"
  fqdn              = var.alb_dns_name
  port              = 80
  resource_path     = "/health/live"
  measure_latency   = false
  failure_threshold = 3
  request_interval  = 10

  tags = {
    Name        = "${var.project_name}-${var.environment}-alb-health-check"
    Environment = var.environment
    ManagedBy   = "Terraform"
  }
}

resource "aws_route53_record" "app_alias" {
  count = var.manage_app_record ? 1 : 0

  zone_id = aws_route53_zone.primary.zone_id
  name    = var.app_record_name
  type    = "A"

  alias {
    name                   = var.alb_dns_name
    zone_id                = var.alb_zone_id
    evaluate_target_health = false
  }

  # Attaching the health check moves evaluation from the alias target to the record itself,
  # which is what allows Route 53 to serve the other zone during a partial failure.
  health_check_id = aws_route53_health_check.alb.id

  depends_on = [aws_route53_health_check.alb]
}

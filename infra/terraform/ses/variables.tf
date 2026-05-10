variable "aws_region" {
  type        = string
  description = "SES regional endpoint (must match DOUBOW_SMTP_HOST region and API deployment)."
  default     = "eu-west-3"
}

variable "domain_name" {
  type        = string
  description = "Domain to verify in SES (e.g. yourverifieddomain.com). Add DNS records from Terraform output before mail sends succeed."
}

variable "smtp_iam_user_name" {
  type        = string
  description = "IAM user that holds SMTP credentials (Access key ID + secret). Use SES console “SMTP settings” or derive SMTP password from secret per AWS docs."
  default     = "doubow-ses-smtp"
}

variable "create_smtp_iam_user" {
  type        = bool
  description = "If true, create IAM user + access key for sending via SES SMTP (ses:SendRawEmail scoped to this identity)."
  default     = true
}

variable "extra_tags" {
  type        = map(string)
  description = "Additional tags merged into default_tags on all resources."
  default     = {}
}

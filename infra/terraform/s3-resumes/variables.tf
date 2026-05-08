variable "aws_region" {
  type        = string
  description = "AWS region where the bucket is created (must match DOUBOW_S3_REGION in the API)."
  default     = "eu-west-3"
}

variable "resume_bucket_name" {
  type        = string
  description = "Globally unique S3 bucket name for raw résumés (e.g. s3-resumes-888687695411)."
}

variable "resume_object_prefix" {
  type        = string
  description = "First path segment for résumé object keys (must match API: resumes/{user_id}/...)."
  default     = "resumes"
}

variable "iam_enforce_tls" {
  type        = bool
  description = "If true, deny S3 calls unless aws:SecureTransport is true (recommended for AWS credentials)."
  default     = true
}

variable "extra_tags" {
  type        = map(string)
  description = "Additional tags merged into default_tags on all resources."
  default     = {}
}

variable "grant_s3_access_user_name" {
  type        = string
  default     = ""
  description = <<-EOT
    IAM user name (not full ARN) to attach the prefix-scoped résumé policy to.
    Leave empty if you attach output iam_policy_json to a role/user yourself, or use OIDC/IRSA.
  EOT
}

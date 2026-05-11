variable "aws_region" {
  type        = string
  description = "AWS region where the bucket is created (must match DOUBOW_S3_REGION in the API)."
  default     = "eu-west-3"
}

variable "resume_bucket_name" {
  type        = string
  description = "Globally unique S3 bucket name for raw résumés (e.g. s3-resumes-888687695411)."
}

variable "s3_access_point_name" {
  type        = string
  default     = ""
  description = "Optional existing S3 access point name used by the API/worker."
}

variable "s3_access_point_alias" {
  type        = string
  default     = ""
  description = "Optional S3 access point alias. Can be used as DOUBOW_S3_BUCKET_RESUMES."
}

variable "resume_object_prefix" {
  type        = string
  description = "First path segment for résumé object keys (must match API: resumes/{user_id}/...)."
  default     = "resumes"
}

variable "job_html_object_prefix" {
  type        = string
  description = "First path segment for scraped job HTML (must match API DOUBOW_S3_JOB_HTML_PREFIX / job-html/*)."
  default     = "job-html"
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

variable "app_iam_user_name" {
  type        = string
  default     = ""
  description = <<-EOT
    Optional IAM user name dedicated to the API/worker S3 credentials.
    When set, Terraform can create the user, attach the least-privilege S3 policy,
    and optionally create an access key for DOUBOW_S3_ACCESS_KEY_ID /
    DOUBOW_S3_SECRET_ACCESS_KEY.
  EOT
}

variable "create_app_iam_user" {
  type        = bool
  default     = false
  description = "Create app_iam_user_name as an IAM user. Set false to attach/use an existing user."
}

variable "create_app_iam_access_key" {
  type        = bool
  default     = false
  description = "Create an access key for app_iam_user_name. Secret is stored in Terraform state."
}

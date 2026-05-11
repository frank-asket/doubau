output "bucket_id" {
  description = "S3 bucket name (use as DOUBOW_S3_BUCKET_RESUMES)."
  value       = aws_s3_bucket.resumes.id
}

output "bucket_arn" {
  description = "S3 bucket ARN (for IAM policies)."
  value       = aws_s3_bucket.resumes.arn
}

output "bucket_region" {
  description = "Region where the bucket lives."
  value       = var.aws_region
}

output "s3_access_point_alias" {
  description = "S3 access point alias when configured. Can be used as DOUBOW_S3_BUCKET_RESUMES."
  value       = trimspace(var.s3_access_point_alias) != "" ? trimspace(var.s3_access_point_alias) : null
}

output "s3_access_point_arn" {
  description = "S3 access point ARN included in IAM policy when configured."
  value       = local.access_point_arn
}

output "resume_object_prefix" {
  description = "Path prefix used in IAM policy (must match API DOUBOW_S3_RESUME_OBJECT_PREFIX)."
  value       = trim(var.resume_object_prefix, "/")
}

output "job_html_object_prefix" {
  description = "Path prefix for scraped HTML (must match API DOUBOW_S3_JOB_HTML_PREFIX)."
  value       = trim(var.job_html_object_prefix, "/")
}

output "iam_policy_json" {
  description = "IAM policy JSON: s3:GetObject + s3:PutObject on résumé + job-html prefixes only (attach to API/worker user or role)."
  value       = data.aws_iam_policy_document.resume_app.json
}

output "iam_managed_policy_arn" {
  description = "ARN of the managed policy created when an S3 access user is configured; null otherwise."
  value       = try(aws_iam_policy.resume_app[0].arn, null)
}

output "app_iam_user_name" {
  description = "IAM user used for API/worker S3 access when configured."
  value       = local.s3_access_user_name != "" ? local.s3_access_user_name : null
}

output "app_access_key_id" {
  description = "Use as DOUBOW_S3_ACCESS_KEY_ID when create_app_iam_access_key=true."
  value       = try(aws_iam_access_key.app[0].id, null)
}

output "app_secret_access_key" {
  description = "Use as DOUBOW_S3_SECRET_ACCESS_KEY when create_app_iam_access_key=true. Stored in Terraform state."
  value       = try(aws_iam_access_key.app[0].secret, null)
  sensitive   = true
}

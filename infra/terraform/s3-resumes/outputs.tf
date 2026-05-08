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

output "resume_object_prefix" {
  description = "Path prefix used in IAM policy (must match API DOUBOW_S3_RESUME_OBJECT_PREFIX)."
  value       = trim(var.resume_object_prefix, "/")
}

output "iam_policy_json" {
  description = "IAM policy JSON: s3:GetObject + s3:PutObject on bucket/prefix/* only (attach to API/worker user or role)."
  value       = data.aws_iam_policy_document.resume_app.json
}

output "iam_managed_policy_arn" {
  description = "ARN of the managed policy created when grant_s3_access_user_name is set; null otherwise."
  value       = try(aws_iam_policy.resume_app[0].arn, null)
}

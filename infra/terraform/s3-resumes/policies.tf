# Least-privilege access for the Doubow API + Celery worker against raw résumés and job HTML.
#
# Résumé keys: `{resume_object_prefix}/{user_id}/{uuid}-{filename}` (see api/app/api/me.py).
# Job scrape keys: `{job_html_object_prefix}/{url_hash}.html` (see api/app/tasks.py).
# Only GetObject + PutObject under those prefixes — no DeleteObject, no bucket-wide /*.
#
# No s3:ListBucket: the app skips HeadBucket on real AWS (see app/storage/s3.py ensure_bucket),
# so PutObject/GetObject work without ListBucket. MinIO dev uses a separate endpoint path.
#
# Attach the rendered JSON (output iam_policy_json) to the IAM user or role used by the API/worker.

locals {
  resume_prefix           = trim(var.resume_object_prefix, "/")
  job_html_prefix         = trim(var.job_html_object_prefix, "/")
  access_point_configured = trimspace(var.s3_access_point_name) != ""
  access_point_arn        = local.access_point_configured ? "arn:aws:s3:${var.aws_region}:${data.aws_caller_identity.current.account_id}:accesspoint/${trimspace(var.s3_access_point_name)}" : null
  s3_object_resources = concat(
    [
      "${aws_s3_bucket.resumes.arn}/${local.resume_prefix}/*",
      "${aws_s3_bucket.resumes.arn}/${local.job_html_prefix}/*",
    ],
    local.access_point_configured
    ? [
      "${local.access_point_arn}/object/${local.resume_prefix}/*",
      "${local.access_point_arn}/object/${local.job_html_prefix}/*",
    ]
    : [],
  )
}

data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "resume_app" {
  statement {
    sid    = "ReadWriteResumeObjectsUnderPrefix"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:PutObject",
    ]

    resources = local.s3_object_resources

    dynamic "condition" {
      for_each = var.iam_enforce_tls ? [1] : []
      content {
        test     = "Bool"
        variable = "aws:SecureTransport"
        values   = ["true"]
      }
    }
  }
}

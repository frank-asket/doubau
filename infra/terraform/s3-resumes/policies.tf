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
  resume_prefix   = trim(var.resume_object_prefix, "/")
  job_html_prefix = trim(var.job_html_object_prefix, "/")
}

data "aws_iam_policy_document" "resume_app" {
  statement {
    sid    = "ReadWriteResumeObjectsUnderPrefix"
    effect = "Allow"

    actions = [
      "s3:GetObject",
      "s3:PutObject",
    ]

    resources = [
      "${aws_s3_bucket.resumes.arn}/${local.resume_prefix}/*",
      "${aws_s3_bucket.resumes.arn}/${local.job_html_prefix}/*",
    ]

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

locals {
  attach_resume_policy = var.grant_s3_access_user_name != ""
}

resource "aws_iam_policy" "resume_app" {
  count = local.attach_resume_policy ? 1 : 0

  name_prefix = "doubow-resume-s3-"
  description = "Doubow résumé S3 Get/Put under prefix ${var.resume_object_prefix}/ (${var.resume_bucket_name})"
  policy      = data.aws_iam_policy_document.resume_app.json
}

resource "aws_iam_user_policy_attachment" "resume_app" {
  count = local.attach_resume_policy ? 1 : 0

  user       = var.grant_s3_access_user_name
  policy_arn = aws_iam_policy.resume_app[0].arn
}

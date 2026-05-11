locals {
  s3_access_user_name  = var.app_iam_user_name != "" ? var.app_iam_user_name : var.grant_s3_access_user_name
  create_app_iam_user  = var.create_app_iam_user && var.app_iam_user_name != ""
  attach_resume_policy = local.s3_access_user_name != ""
  create_access_key    = var.create_app_iam_access_key && local.s3_access_user_name != ""
}

resource "aws_iam_user" "app" {
  count = local.create_app_iam_user ? 1 : 0

  name = var.app_iam_user_name

  tags = {
    Component = "api-worker-s3"
  }
}

resource "aws_iam_policy" "resume_app" {
  count = local.attach_resume_policy ? 1 : 0

  name_prefix = "doubow-resume-s3-"
  description = "Doubow résumé S3 Get/Put under prefix ${var.resume_object_prefix}/ (${var.resume_bucket_name})"
  policy      = data.aws_iam_policy_document.resume_app.json
}

resource "aws_iam_user_policy_attachment" "resume_app" {
  count = local.attach_resume_policy ? 1 : 0

  user       = local.s3_access_user_name
  policy_arn = aws_iam_policy.resume_app[0].arn

  depends_on = [aws_iam_user.app]
}

resource "aws_iam_access_key" "app" {
  count = local.create_access_key ? 1 : 0

  user = local.s3_access_user_name

  depends_on = [
    aws_iam_user.app,
    aws_iam_user_policy_attachment.resume_app,
  ]
}

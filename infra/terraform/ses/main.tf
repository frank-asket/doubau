locals {
  create_smtp = var.create_smtp_iam_user
}

resource "aws_ses_domain_identity" "main" {
  domain = var.domain_name
}

resource "aws_ses_domain_dkim" "main" {
  domain = aws_ses_domain_identity.main.domain
}

resource "aws_iam_user" "ses_smtp" {
  count = local.create_smtp ? 1 : 0

  name = var.smtp_iam_user_name
}

resource "aws_iam_user_policy" "ses_send" {
  count = local.create_smtp ? 1 : 0

  name   = "doubow-ses-send-${replace(var.domain_name, ".", "-")}"
  user   = aws_iam_user.ses_smtp[0].name
  policy = data.aws_iam_policy_document.ses_send_identity.json
}

resource "aws_iam_access_key" "ses_smtp" {
  count = local.create_smtp ? 1 : 0

  user = aws_iam_user.ses_smtp[0].name
}

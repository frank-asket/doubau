data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "ses_send_identity" {
  statement {
    sid    = "SendFromVerifiedIdentity"
    effect = "Allow"

    actions = [
      "ses:SendEmail",
      "ses:SendRawEmail",
    ]

    resources = [
      "arn:aws:ses:${var.aws_region}:${data.aws_caller_identity.current.account_id}:identity/${var.domain_name}",
    ]
  }
}

output "domain_name" {
  description = "SES domain identity (must show Verified in SES console after DNS propagates)."
  value       = aws_ses_domain_identity.main.domain
}

output "ses_verification_dns" {
  description = "Add this TXT record at your DNS provider to prove domain ownership (_amazonses.<domain>)."
  value = {
    name  = "_amazonses.${aws_ses_domain_identity.main.domain}"
    type  = "TXT"
    value = aws_ses_domain_identity.main.verification_token
  }
}

output "ses_dkim_cname_records" {
  description = "Three CNAME records for Easy DKIM (recommended for deliverability)."
  value = [
    for token in aws_ses_domain_dkim.main.dkim_tokens : {
      name  = "${token}._domainkey.${aws_ses_domain_identity.main.domain}"
      type  = "CNAME"
      value = "${token}.dkim.amazonses.com"
    }
  ]
}

output "smtp_host" {
  description = "Set DOUBOW_SMTP_HOST (STARTTLS 587 or SSL 465 per api/.env.example)."
  value       = "email-smtp.${var.aws_region}.amazonaws.com"
}

output "smtp_iam_access_key_id" {
  description = "SMTP username for SES (same as AWS access key id). Set DOUBOW_SMTP_USER."
  value       = try(aws_iam_access_key.ses_smtp[0].id, null)
}

# Provider computes SES SMTP password from the IAM access key (same value SES console would give).
output "ses_smtp_password_v4" {
  description = "Set DOUBOW_SMTP_PASSWORD — SES SMTP password derived from the IAM access key."
  value       = try(aws_iam_access_key.ses_smtp[0].ses_smtp_password_v4, null)
  sensitive   = true
}

output "smtp_iam_secret_access_key" {
  description = <<-EOT
    IAM secret access key (sensitive). For SES SMTP you must convert this to the SMTP password
    using AWS’s algorithm (see Amazon SES docs “Obtaining SMTP credentials”), or create SMTP
    credentials in the SES console for this IAM user.
  EOT
  value       = try(aws_iam_access_key.ses_smtp[0].secret, null)
  sensitive   = true
}

output "ses_region" {
  description = "Region used for this identity (must match api worker region)."
  value       = var.aws_region
}

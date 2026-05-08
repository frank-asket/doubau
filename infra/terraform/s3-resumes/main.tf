resource "aws_s3_bucket" "resumes" {
  bucket = var.resume_bucket_name
}

resource "aws_s3_bucket_public_access_block" "resumes" {
  bucket = aws_s3_bucket.resumes.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "resumes" {
  bucket = aws_s3_bucket.resumes.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_versioning" "resumes" {
  bucket = aws_s3_bucket.resumes.id

  versioning_configuration {
    status = "Enabled"
  }
}

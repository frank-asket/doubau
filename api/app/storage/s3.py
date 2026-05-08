from __future__ import annotations

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.settings import settings


def s3_client():
    """
    MinIO: set DOUBOW_S3_ENDPOINT_URL + access key/secret.
    AWS S3: leave endpoint empty; optional access key/secret, or use default credential chain
    (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY, ~/.aws/credentials, AWS_PROFILE, IAM role, …).
    """
    kwargs: dict = {
        "service_name": "s3",
        "region_name": settings.s3_region,
        "config": Config(signature_version="s3v4"),
    }
    if settings.s3_endpoint_url:
        kwargs["endpoint_url"] = settings.s3_endpoint_url
    if settings.s3_access_key_id and settings.s3_secret_access_key:
        kwargs["aws_access_key_id"] = settings.s3_access_key_id
        kwargs["aws_secret_access_key"] = settings.s3_secret_access_key
    return boto3.client(**kwargs)


def ensure_bucket(client, bucket: str) -> None:
    # Real AWS: bucket is created by Terraform — skip HeadBucket so production IAM can omit
    # s3:ListBucket (see infra/terraform/s3-resumes/policies.tf). MinIO/dev still bootstraps here.
    if not settings.s3_endpoint_url:
        return

    try:
        client.head_bucket(Bucket=bucket)
        return
    except ClientError as e:
        code = (e.response or {}).get("Error", {}).get("Code")
        if str(code) not in {"404", "NoSuchBucket", "NotFound"}:
            raise

    # MinIO and similar: simple CreateBucket is enough.
    if settings.s3_endpoint_url:
        client.create_bucket(Bucket=bucket)
        return

    # AWS: us-east-1 uses the legacy global endpoint; other regions need LocationConstraint.
    region = settings.s3_region
    if region == "us-east-1":
        client.create_bucket(Bucket=bucket)
    else:
        client.create_bucket(
            Bucket=bucket,
            CreateBucketConfiguration={"LocationConstraint": region},
        )


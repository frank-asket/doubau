# Infrastructure (AWS)

This folder contains **starter templates** for an AWS ECS + RDS + ElastiCache deployment.

The repo is structured to run as two services:
- `doubow-web` (Next.js standalone Docker image)
- `doubow-api` (FastAPI Docker image)

## Target shape
- **ECS/Fargate**: two services behind an **ALB**
- **RDS Postgres**: primary relational store
- **ElastiCache Redis**: queues/caching
- **S3**: file storage (résumés, raw HTML, artifacts)

## What’s included
- `ecs/`: task definition templates and environment variable checklist

## Next steps (manual)
- Create ECR repos and push images.
- Create an ALB + target groups.
- Create ECS cluster, task defs, and services.
- Provision RDS + ElastiCache and wire env vars.

This is intentionally lightweight so you can choose Terraform / CDK / CloudFormation later.


import os
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parent
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

# Tests should never silently point at Railway/staging credentials from api/.env.
# Use the local Docker Compose Postgres by default; override with
# DOUBOW_TEST_DATABASE_URL when a different disposable test database is intended.
os.environ["DOUBOW_DATABASE_URL"] = os.getenv(
    "DOUBOW_TEST_DATABASE_URL",
    "postgresql+psycopg://postgres:postgres@127.0.0.1:5433/doubow",
)
os.environ.setdefault("DOUBOW_REDIS_URL", "redis://localhost:6379/0")

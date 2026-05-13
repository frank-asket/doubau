import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.applications import router as applications_router
from app.api.auth import router as auth_router
from app.api.copilot import router as copilot_router
from app.api.jobs import router as jobs_router
from app.api.me import router as me_router
from app.api.me_google import router as me_google_router
from app.api.me_linkedin import router as me_linkedin_router
from app.core.settings import settings
from app.middleware.idempotency import IdempotencyMiddleware
from app.startup_bootstrap import run_startup_bootstrap_ingest


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        await asyncio.to_thread(run_startup_bootstrap_ingest)
        yield

    app = FastAPI(title="Doubow API", version="0.1.0", lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_allow_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_middleware(IdempotencyMiddleware)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth_router)
    app.include_router(applications_router)
    app.include_router(copilot_router)
    app.include_router(jobs_router)
    app.include_router(me_router)
    app.include_router(me_google_router)
    app.include_router(me_linkedin_router)

    return app


app = create_app()


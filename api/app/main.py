from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.applications import router as applications_router
from app.api.auth import router as auth_router
from app.api.copilot import router as copilot_router
from app.api.jobs import router as jobs_router
from app.api.me import router as me_router
from app.core.settings import settings
from app.middleware.idempotency import IdempotencyMiddleware


def create_app() -> FastAPI:
    app = FastAPI(title="Doubow API", version="0.1.0")

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

    return app


app = create_app()


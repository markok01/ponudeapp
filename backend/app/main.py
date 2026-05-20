from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import router
from app.config import settings
from app.services.job_manager import job_manager
from app.utils.logging_config import setup_logging


@asynccontextmanager
async def lifespan(_app: FastAPI):
    setup_logging()
    settings.temp_dir.mkdir(parents=True, exist_ok=True)
    yield
    job_manager.cleanup_expired()


app = FastAPI(
    title="PDF to Excel Converter",
    description="Professional PDF table extraction and Excel export service",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

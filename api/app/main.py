from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.logging import configure_logging, log
from app.routers import auth as auth_router
from app.routers import accounts as accounts_router
from app.routers import credit_cards as cc_router
from app.routers import categories as categories_router
from app.routers import transactions as transactions_router
from app.routers import dashboard as dashboard_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging(settings.app_env)
    log.info("startup", env=settings.app_env)
    yield
    log.info("shutdown")


app = FastAPI(title="Finance Dashboard API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(accounts_router.router)
app.include_router(cc_router.router)
app.include_router(categories_router.router)
app.include_router(transactions_router.router)
app.include_router(dashboard_router.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}

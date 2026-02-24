from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import IntegrityError
from starlette.requests import Request
from starlette.responses import JSONResponse
from app.core.config import settings
from app.core.logging import configure_logging, log
from app.routers import auth as auth_router
from app.routers import accounts as accounts_router
from app.routers import credit_cards as cc_router
from app.routers import categories as categories_router
from app.routers import transactions as transactions_router
from app.routers import dashboard as dashboard_router
from app.routers import documents as documents_router
from app.routers import parse as parse_router
from app.routers import statements as statements_router
from app.routers import budgets as budgets_router
from app.routers import notifications as notifications_router
from app.routers import analytics as analytics_router
from app.routers import recurring_transactions as recurring_router
from app.models import credit_line as _credit_line_model  # noqa: F401


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
app.include_router(documents_router.router)
app.include_router(parse_router.router)
app.include_router(statements_router.router)
app.include_router(budgets_router.router)
app.include_router(notifications_router.router)
app.include_router(analytics_router.router)
app.include_router(recurring_router.router)


@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError) -> JSONResponse:
    log.warning("integrity_error", detail=str(exc.orig))
    return JSONResponse(
        status_code=409,
        content={"detail": "Operation conflicts with existing data. Check related records."},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    log.error("unhandled_exception", detail=str(exc), exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}

from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(FileNotFoundError)
    async def file_not_found_handler(
        request: Request,
        exc: FileNotFoundError,
    ):
        logger.warning("Requested resource not found: %s", exc)

        return JSONResponse(
            status_code=404,
            content={
                "error": "Not Found",
                "detail": str(exc),
            },
        )

    @app.exception_handler(ValueError)
    async def value_error_handler(
        request: Request,
        exc: ValueError,
    ):
        logger.exception("ValueError")

        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal Server Error",
                "detail": str(exc),
            },
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(
        request: Request,
        exc: Exception,
    ):
        logger.exception("Unhandled exception")

        return JSONResponse(
            status_code=500,
            content={
                "error": "Internal Server Error",
                "detail": "Unexpected server error.",
            },
        )
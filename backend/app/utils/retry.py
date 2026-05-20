import asyncio
import time
from collections.abc import Callable
from typing import TypeVar

from app.config import settings
from app.utils.logging_config import get_logger

logger = get_logger(__name__)

T = TypeVar("T")


def with_retry(
    fn: Callable[[], T],
    *,
    label: str,
    max_retries: int | None = None,
    delay: float | None = None,
) -> T:
    attempts = max_retries if max_retries is not None else settings.max_retries
    wait = delay if delay is not None else settings.retry_delay_seconds
    last_error: Exception | None = None

    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001 — retry wrapper catches all strategy failures
            last_error = exc
            logger.warning("%s attempt %s/%s failed: %s", label, attempt, attempts, exc)
            if attempt < attempts:
                time.sleep(wait * attempt)

    assert last_error is not None
    raise last_error


async def with_retry_async(
    fn: Callable[[], T],
    *,
    label: str,
    max_retries: int | None = None,
    delay: float | None = None,
) -> T:
    attempts = max_retries if max_retries is not None else settings.max_retries
    wait = delay if delay is not None else settings.retry_delay_seconds
    last_error: Exception | None = None

    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            logger.warning("%s attempt %s/%s failed: %s", label, attempt, attempts, exc)
            if attempt < attempts:
                await asyncio.sleep(wait * attempt)

    assert last_error is not None
    raise last_error

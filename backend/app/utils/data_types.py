from __future__ import annotations

import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any

import pandas as pd

CURRENCY_SYMBOLS = {"€", "$", "£", "¥", "RSD", "EUR", "USD", "GBP", "CHF", "din", "din."}
DATE_PATTERNS = [
    re.compile(r"^\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4}$"),
    re.compile(r"^\d{4}[./\-]\d{1,2}[./\-]\d{1,2}$"),
]
NUMERIC_RE = re.compile(r"^[\d\s.,\-+()€$£¥%]+$")


def clean_cell(value: Any) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    text = str(value).strip()
    return re.sub(r"\s+", " ", text)


def normalize_header(value: Any, index: int) -> str:
    text = clean_cell(value)
    return text if text else f"Column_{index + 1}"


def infer_column_type(values: list[str]) -> str:
    non_empty = [v for v in values if v]
    if not non_empty:
        return "text"

    date_hits = sum(1 for v in non_empty[:50] if any(p.match(v) for p in DATE_PATTERNS))
    if date_hits / len(non_empty[:50]) > 0.6:
        return "date"

    currency_hits = sum(
        1
        for v in non_empty[:50]
        if any(sym in v for sym in CURRENCY_SYMBOLS) or v.endswith((" RSD", " EUR", " USD"))
    )
    numeric_hits = sum(1 for v in non_empty[:50] if _is_numeric(v))

    if currency_hits / max(len(non_empty[:50]), 1) > 0.4:
        return "currency"
    if numeric_hits / max(len(non_empty[:50]), 1) > 0.7:
        return "number"
    return "text"


def _is_numeric(value: str) -> bool:
    if not NUMERIC_RE.match(value.replace(" ", "")):
        return False
    try:
        normalized = (
            value.replace(" ", "")
            .replace(".", "")
            .replace(",", ".")
            .replace("€", "")
            .replace("$", "")
            .replace("£", "")
            .replace("RSD", "")
            .replace("EUR", "")
            .replace("%", "")
        )
        Decimal(normalized)
        return True
    except (InvalidOperation, ValueError):
        return False


def parse_number(value: str) -> float | None:
    if not value:
        return None
    cleaned = (
        value.replace(" ", "")
        .replace("RSD", "")
        .replace("EUR", "")
        .replace("USD", "")
        .replace("€", "")
        .replace("$", "")
        .replace("£", "")
        .replace("%", "")
    )
    if "," in cleaned and "." in cleaned:
        if cleaned.rfind(",") > cleaned.rfind("."):
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    elif "," in cleaned:
        parts = cleaned.split(",")
        cleaned = parts[0].replace(".", "") + "." + parts[1] if len(parts) == 2 else cleaned.replace(",", ".")
    try:
        return float(Decimal(cleaned))
    except (InvalidOperation, ValueError):
        return None


def parse_date(value: str) -> datetime | None:
    for fmt in ("%d.%m.%Y", "%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def dataframe_to_table(df: pd.DataFrame, *, name: str, page: int, strategy: str) -> dict[str, Any]:
    if df.empty:
        return {"name": name, "page": page, "columns": [], "rows": [], "strategy": strategy}

    df = df.copy()
    df = df.dropna(how="all").dropna(axis=1, how="all")
    df = df.map(lambda x: clean_cell(x))

    if df.empty:
        return {"name": name, "page": page, "columns": [], "rows": [], "strategy": strategy}

    # Promote first row to header if it looks like headers
    first_row = df.iloc[0].tolist()
    if sum(1 for c in first_row if c) >= max(2, len(first_row) // 2):
        columns = [normalize_header(c, i) for i, c in enumerate(first_row)]
        data_rows = df.iloc[1:].values.tolist()
    else:
        columns = [f"Column_{i + 1}" for i in range(len(df.columns))]
        data_rows = df.values.tolist()

    return {
        "name": name,
        "page": page,
        "columns": columns,
        "rows": data_rows,
        "strategy": strategy,
    }

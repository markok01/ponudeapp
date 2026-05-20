from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    api_key: str = ""
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "INFO"

    max_pdf_size_mb: int = 50
    job_ttl_seconds: int = 3600
    conversion_timeout_seconds: int = 300

    ocr_enabled: bool = True
    ocr_lang: str = "en"

    max_retries: int = 3
    retry_delay_seconds: float = 1.5

    temp_dir: Path = Path("/tmp/pdf-converter")

    @property
    def max_pdf_bytes(self) -> int:
        return self.max_pdf_size_mb * 1024 * 1024


settings = Settings()
settings.temp_dir.mkdir(parents=True, exist_ok=True)

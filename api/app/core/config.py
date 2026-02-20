from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    app_env: str = "development"
    database_url: str
    test_database_url: str = ""
    redis_url: str

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 30

    cookie_secure: bool = False
    cookie_domain: str = "localhost"

    cors_origins: str = "http://localhost:3000"

    gemini_api_key: str = ""
    claude_api_key: str = ""
    discord_webhook_url: str = ""

    vapid_private_key: str = ""
    vapid_contact_email: str = "admin@fintrack.app"

    upload_dir: str = "uploads"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()

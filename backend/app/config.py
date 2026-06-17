from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    MONGODB_URI: str
    REDIS_URL: str = "redis://localhost:6379"
    JWT_SECRET: str
    JWT_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHAT_ID: str = ""
    FRONTEND_URL: str = "http://localhost:3000"
    ALERT_CHECK_INTERVAL: int = 60  # seconds

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

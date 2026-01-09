"""
Adminless Backend - Configuration
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # E2B Configuration
    e2b_api_key: str = ""
    
    # Google Configuration
    google_api_key: str = ""
    # Model ID declared in code as requested, but we'll include a setting for it just in case
    # Defaulting to the requested model
    gemini_model: str = "gemini-3-flash-preview"
    
    # CORS Configuration
    frontend_url: str = "http://localhost:3000"
    
    # Server Configuration
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = True
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # Ignore extra fields like old openrouter_api_key


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_VERSION: str = "v1"
    DATABASE_URL: str = "mysql+pymysql://root:root1234@db:3306/mengnyang"

    class Config:
        env_file = ".env"


settings = Settings()
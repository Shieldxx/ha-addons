import os

class Config:
    # No fallback: nothing in the app signs sessions or cookies, so the key is
    # unused today, and the code is public. If a feature ever starts relying on
    # it, Flask refuses outright without one - better than silently signing with
    # a key anyone can read on GitHub.
    SECRET_KEY = os.environ.get('SECRET_KEY')
    STORAGE_BACKEND = os.environ.get('STORAGE_BACKEND', 'json')
    JSON_DATA_DIR = os.environ.get('JSON_DATA_DIR', os.path.join(os.path.dirname(__file__), 'data'))
    POSTGRES_URL = os.environ.get('DATABASE_URL', 'postgresql://localhost/barf_companion')
    DEFAULT_LANG = os.environ.get('DEFAULT_LANG', 'en')
    INGRESS_PORT = int(os.environ.get('INGRESS_PORT', 8099))

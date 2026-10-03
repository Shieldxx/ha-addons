from config import Config

def get_storage():
    if Config.STORAGE_BACKEND == 'postgres':
        from storage.postgres_storage import PostgresStorage
        return PostgresStorage(Config.POSTGRES_URL)
    else:
        from storage.json_storage import JsonStorage
        return JsonStorage(Config.JSON_DATA_DIR)

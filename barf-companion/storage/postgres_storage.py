import json
import uuid
import psycopg2
import psycopg2.extras
from storage.base import BaseStorage


class PostgresStorage(BaseStorage):

    SCHEMA = """
    CREATE TABLE IF NOT EXISTS dogs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        age_group TEXT NOT NULL,
        body_pct REAL NOT NULL,
        ratios JSONB NOT NULL,
        weights JSONB NOT NULL DEFAULT '[]',
        stock JSONB NOT NULL DEFAULT '{}',
        birth_date TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL
    );
    """

    def __init__(self, db_url):
        self.db_url = db_url
        self._init_db()

    def _conn(self):
        return psycopg2.connect(self.db_url)

    def _init_db(self):
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(self.SCHEMA)
                cur.execute("ALTER TABLE dogs ADD COLUMN IF NOT EXISTS birth_date TEXT NOT NULL DEFAULT ''")
            conn.commit()

    # --- Dogs ---
    def get_dogs(self):
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT * FROM dogs ORDER BY name")
                rows = cur.fetchall()
                return [self._row_to_dog(r) for r in rows]

    def get_dog(self, dog_id):
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT * FROM dogs WHERE id = %s", (dog_id,))
                row = cur.fetchone()
                return self._row_to_dog(row) if row else None

    def save_dog(self, dog):
        if 'id' not in dog or not dog['id']:
            dog['id'] = str(uuid.uuid4())[:8]
            dog.setdefault('weights', [])
            dog.setdefault('stock', {
                'meat': 0, 'bones': 0, 'liver': 0,
                'organs': 0, 'veggies': 0, 'nuts': 0, 'fruit': 0
            })
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO dogs (id, name, age_group, body_pct, ratios, weights, stock, birth_date)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        age_group = EXCLUDED.age_group,
                        body_pct = EXCLUDED.body_pct,
                        ratios = EXCLUDED.ratios,
                        birth_date = EXCLUDED.birth_date
                """, (
                    dog['id'], dog['name'], dog['age_group'],
                    dog['body_pct'], json.dumps(dog.get('ratios', [])),
                    json.dumps(dog.get('weights', [])),
                    json.dumps(dog.get('stock', {})),
                    dog.get('birth_date', '')
                ))
            conn.commit()
        return dog

    def delete_dog(self, dog_id):
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM dogs WHERE id = %s", (dog_id,))
            conn.commit()

    # --- Weight history ---
    def get_weights(self, dog_id):
        dog = self.get_dog(dog_id)
        if not dog:
            return []
        return sorted(dog.get('weights', []), key=lambda w: w['date'])

    def add_weight(self, dog_id, entry):
        dog = self.get_dog(dog_id)
        if not dog:
            return None
        weights = [w for w in dog.get('weights', []) if w['date'] != entry['date']]
        weights.append(entry)
        weights.sort(key=lambda w: w['date'])
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE dogs SET weights = %s WHERE id = %s",
                            (json.dumps(weights), dog_id))
            conn.commit()
        return entry

    def delete_weight(self, dog_id, date):
        dog = self.get_dog(dog_id)
        if not dog:
            return False
        weights = [w for w in dog.get('weights', []) if w['date'] != date]
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE dogs SET weights = %s WHERE id = %s",
                            (json.dumps(weights), dog_id))
            conn.commit()
        return True

    def add_weights_bulk(self, dog_id, entries):
        dog = self.get_dog(dog_id)
        if not dog:
            return None
        weights = dog.get('weights', [])
        for entry in entries:
            weights = [w for w in weights if w['date'] != entry['date']]
            weights.append(entry)
        weights.sort(key=lambda w: w['date'])
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE dogs SET weights = %s WHERE id = %s",
                            (json.dumps(weights), dog_id))
            conn.commit()
        return len(entries)

    # --- Freezer stock ---
    def get_stock(self, dog_id):
        dog = self.get_dog(dog_id)
        return dog.get('stock', {}) if dog else {}

    def save_stock(self, dog_id, stock):
        if not self.get_dog(dog_id):
            return None
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE dogs SET stock = %s WHERE id = %s",
                            (json.dumps(stock), dog_id))
            conn.commit()
        return stock

    # --- Settings ---
    def get_settings(self):
        with self._conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SELECT * FROM settings WHERE key = 'global'")
                row = cur.fetchone()
                if row:
                    return row['value']
        return {
            'lang': 'cs',
            'theme': 'system',
            'output_mode': 'A',
            'presets': {
                'adult': {'label': 'Dospělý', 'pct': 3, 'ratios': [72, 10, 5, 5, 7, 0, 1]},
                'junior': {'label': 'Dorostek', 'pct': 5, 'ratios': [68, 12, 6, 6, 7, 0, 1]},
                'puppy': {'label': 'Štěně', 'pct': 7, 'ratios': [60, 17, 7, 7, 7, 0, 1]},
            }
        }

    def save_settings(self, settings):
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO settings (key, value) VALUES ('global', %s)
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
                """, (json.dumps(settings),))
            conn.commit()
        return settings

    # --- Full export/import ---
    def export_all(self):
        return {
            'dogs': self.get_dogs(),
            'settings': self.get_settings()
        }

    def import_all(self, data):
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM dogs")
                cur.execute("DELETE FROM settings")
            conn.commit()
        for dog in data.get('dogs', []):
            self.save_dog(dog)
        if 'settings' in data:
            self.save_settings(data['settings'])

    def _row_to_dog(self, row):
        if not row:
            return None
        return {
            'id': row['id'],
            'name': row['name'],
            'age_group': row['age_group'],
            'body_pct': row['body_pct'],
            'birth_date': row.get('birth_date', ''),
            'ratios': row['ratios'] if isinstance(row['ratios'], list) else json.loads(row['ratios']),
            'weights': row['weights'] if isinstance(row['weights'], list) else json.loads(row['weights']),
            'stock': row['stock'] if isinstance(row['stock'], dict) else json.loads(row['stock']),
        }

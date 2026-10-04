import json
import os
import shutil
import tempfile
import uuid
import copy
from datetime import datetime
from storage.base import BaseStorage


class JsonStorage(BaseStorage):

    def __init__(self, data_dir):
        self.data_dir = data_dir
        os.makedirs(data_dir, exist_ok=True)
        self.file = os.path.join(data_dir, 'data.json')
        self._data = self._load()

    def _load(self):
        if os.path.exists(self.file):
            with open(self.file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return self._default_data()

    def _save(self):
        # Write a sibling file and swap it in. Opening data.json with 'w'
        # truncated it first, so a crash or power cut mid-write left it empty
        # or half written - and it is the only copy of every weight recorded.
        # os.replace is atomic on POSIX and Windows alike, so data.json is
        # always either the old complete file or the new one. The sibling has
        # to be in the same directory: os.replace cannot cross filesystems.
        fd, tmp = tempfile.mkstemp(dir=self.data_dir, prefix='.data-', suffix='.tmp')
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                json.dump(self._data, f, ensure_ascii=False, indent=2)
                f.flush()
                os.fsync(f.fileno())
            if os.path.exists(self.file):
                shutil.copymode(self.file, tmp)  # mkstemp makes it owner-only
            os.replace(tmp, self.file)
        except BaseException:
            if os.path.exists(tmp):
                os.remove(tmp)
            raise

    def _default_data(self):
        return {
            'dogs': [],
            'settings': {
                'lang': 'cs',
                'theme': 'dark',
                'output_mode': 'A',
                'presets': {
                    'adult': {'label': 'Dospělý', 'pct': 3, 'ratios': [72, 10, 5, 5, 7, 0, 1]},
                    'junior': {'label': 'Dorostek', 'pct': 5, 'ratios': [68, 12, 6, 6, 7, 0, 1]},
                    'puppy': {'label': 'Štěně', 'pct': 7, 'ratios': [60, 17, 7, 7, 7, 0, 1]},
                }
            }
        }

    # --- Dogs ---
    def get_dogs(self):
        # `.get`, not `[...]`: a data.json that lost its dogs key — written by
        # hand, or by a version before the import validator — would otherwise
        # 500 every single request with no way back through the UI.
        return copy.deepcopy(self._data.get('dogs', []))

    def get_dog(self, dog_id):
        for dog in self._data['dogs']:
            if dog['id'] == dog_id:
                return copy.deepcopy(dog)
        return None

    def save_dog(self, dog):
        if 'id' not in dog or not dog['id']:
            dog['id'] = str(uuid.uuid4())[:8]
            dog.setdefault('weights', [])
            dog.setdefault('stock', {
                'meat': 0, 'bones': 0, 'liver': 0,
                'organs': 0, 'veggies': 0, 'nuts': 0, 'fruit': 0
            })
            self._data['dogs'].append(dog)
        else:
            for i, d in enumerate(self._data['dogs']):
                if d['id'] == dog['id']:
                    dog['weights'] = d.get('weights', [])
                    dog['stock'] = d.get('stock', dog.get('stock', {}))
                    self._data['dogs'][i] = dog
                    break
        self._save()
        return copy.deepcopy(dog)

    def delete_dog(self, dog_id):
        self._data['dogs'] = [d for d in self._data['dogs'] if d['id'] != dog_id]
        self._save()

    # --- Weight history ---
    def get_weights(self, dog_id):
        dog = self.get_dog(dog_id)
        if not dog:
            return []
        weights = dog.get('weights', [])
        return sorted(weights, key=lambda w: w['date'])

    def add_weight(self, dog_id, entry):
        for dog in self._data['dogs']:
            if dog['id'] == dog_id:
                weights = dog.setdefault('weights', [])
                weights = [w for w in weights if w['date'] != entry['date']]
                weights.append(entry)
                dog['weights'] = sorted(weights, key=lambda w: w['date'])
                self._save()
                return entry
        return None

    def delete_weight(self, dog_id, date):
        for dog in self._data['dogs']:
            if dog['id'] == dog_id:
                dog['weights'] = [w for w in dog.get('weights', []) if w['date'] != date]
                self._save()
                return True
        return False

    def add_weights_bulk(self, dog_id, entries):
        for dog in self._data['dogs']:
            if dog['id'] == dog_id:
                weights = dog.setdefault('weights', [])
                for entry in entries:
                    weights = [w for w in weights if w['date'] != entry['date']]
                    weights.append(entry)
                dog['weights'] = sorted(weights, key=lambda w: w['date'])
                self._save()
                return len(entries)
        return None

    # --- Freezer stock ---
    def get_stock(self, dog_id):
        dog = self.get_dog(dog_id)
        if not dog:
            return {}
        return dog.get('stock', {})

    def save_stock(self, dog_id, stock):
        for dog in self._data['dogs']:
            if dog['id'] == dog_id:
                dog['stock'] = stock
                self._save()
                return stock
        return None

    # --- Settings ---
    def get_settings(self):
        return copy.deepcopy(self._data.get('settings', {}))

    def save_settings(self, settings):
        self._data['settings'] = settings
        self._save()
        return settings

    # --- Full export/import ---
    def export_all(self):
        return copy.deepcopy(self._data)

    def import_all(self, data):
        # The copy is taken before anything is replaced, so an import the owner
        # regrets is a rename away from undone. Callers validate the payload
        # first; this method only guarantees the old data survives.
        self._backup()
        self._data = data
        self._save()

    def _backup(self):
        """Copy the current data file into backups/ before it is replaced."""
        if not os.path.exists(self.file):
            return None
        backup_dir = os.path.join(self.data_dir, 'backups')
        os.makedirs(backup_dir, exist_ok=True)

        stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
        path = os.path.join(backup_dir, f'pre-import-{stamp}.json')
        # Two imports inside the same second would otherwise overwrite the copy
        # holding the original data — the one file this exists to protect.
        n = 1
        while os.path.exists(path):
            path = os.path.join(backup_dir, f'pre-import-{stamp}-{n}.json')
            n += 1

        shutil.copy2(self.file, path)
        return path

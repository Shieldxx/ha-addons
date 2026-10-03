import os
from datetime import datetime
from flask import Flask, jsonify, render_template, request, send_from_directory
from config import Config
from storage import get_storage

app = Flask(__name__, static_folder='static', template_folder='templates')
app.config.from_object(Config)

# The live data file is 8 KB. Nothing this app sends is near a megabyte, so a
# wrong file that happens to be huge is refused before Flask parses it.
app.config['MAX_CONTENT_LENGTH'] = 1024 * 1024

# Jinja caches compiled templates unless DEBUG is on, and this app runs with it
# off — so editing index.html would otherwise need a server restart to show up,
# which it never did back when the page was served straight off disk. One stat
# per request is not worth that surprise.
app.config['TEMPLATES_AUTO_RELOAD'] = True

storage = get_storage()


# --- Serve SPA ---
@app.template_global()
def asset(filename):
    """A relative static URL stamped with the file's mtime.

    There is no build step, so the page loads its modules by plain path. A
    browser holding one of them from a previous version against fresh markup
    does not degrade gracefully: an element id removed from the HTML makes the
    stale module throw partway through init, *before* it binds its buttons, so
    the page renders and its controls quietly do nothing. The stamp changes
    whenever the file does, which is the whole fix.

    Relative, not rooted at /: under Home Assistant ingress the page is served
    from /api/hassio_ingress/<token>/, and a leading slash would send the
    browser to Home Assistant's own root instead of this add-on.
    """
    path = os.path.join(app.static_folder, filename)
    try:
        stamp = int(os.path.getmtime(path))
    except OSError:
        # Missing file: let the 404 happen on its own terms rather than here.
        return f'static/{filename}'
    return f'static/{filename}?v={stamp}'


@app.route('/')
def index():
    return render_template('index.html')


# --- i18n ---
@app.route('/i18n/<lang>.json')
def i18n(lang):
    if lang not in ('cs', 'en'):
        return jsonify({'error': 'unsupported language'}), 400
    return send_from_directory('i18n', f'{lang}.json')


# --- Dogs API ---
@app.route('/api/dogs', methods=['GET'])
def list_dogs():
    return jsonify(storage.get_dogs())


@app.route('/api/dogs', methods=['POST'])
def create_dog():
    dog = request.get_json()
    return jsonify(storage.save_dog(dog)), 201


@app.route('/api/dogs/<dog_id>', methods=['GET'])
def get_dog(dog_id):
    dog = storage.get_dog(dog_id)
    if not dog:
        return jsonify({'error': 'not found'}), 404
    return jsonify(dog)


@app.route('/api/dogs/<dog_id>', methods=['PUT'])
def update_dog(dog_id):
    dog = request.get_json()
    dog['id'] = dog_id
    return jsonify(storage.save_dog(dog))


@app.route('/api/dogs/<dog_id>', methods=['DELETE'])
def delete_dog(dog_id):
    storage.delete_dog(dog_id)
    return jsonify({'ok': True})


# --- Weight API ---
@app.route('/api/dogs/<dog_id>/weights', methods=['GET'])
def list_weights(dog_id):
    return jsonify(storage.get_weights(dog_id))


@app.route('/api/dogs/<dog_id>/weights', methods=['POST'])
def add_weight(dog_id):
    entry = request.get_json()
    result = storage.add_weight(dog_id, entry)
    if result is None:
        return jsonify({'error': 'dog not found'}), 404
    return jsonify(result), 201


@app.route('/api/dogs/<dog_id>/weights/bulk', methods=['POST'])
def add_weights_bulk(dog_id):
    entries = request.get_json()
    result = storage.add_weights_bulk(dog_id, entries)
    if result is None:
        return jsonify({'error': 'dog not found'}), 404
    return jsonify({'count': result}), 201


@app.route('/api/dogs/<dog_id>/weights/<date>', methods=['DELETE'])
def remove_weight(dog_id, date):
    storage.delete_weight(dog_id, date)
    return jsonify({'ok': True})


# --- Stock API ---
@app.route('/api/dogs/<dog_id>/stock', methods=['GET'])
def get_stock(dog_id):
    return jsonify(storage.get_stock(dog_id))


@app.route('/api/dogs/<dog_id>/stock', methods=['PUT'])
def update_stock(dog_id):
    stock = request.get_json()
    result = storage.save_stock(dog_id, stock)
    if result is None:
        return jsonify({'error': 'dog not found'}), 404
    return jsonify(result)


# --- Settings API ---
@app.route('/api/settings', methods=['GET'])
def get_settings():
    return jsonify(storage.get_settings())


@app.route('/api/settings', methods=['PUT'])
def update_settings():
    settings = request.get_json()
    return jsonify(storage.save_settings(settings))


# --- Export / Import ---
@app.route('/api/export', methods=['GET'])
def export_data():
    return jsonify(storage.export_all())


def _is_date(val):
    # A pattern match would accept '2022-13-99'. The frontend sorts these as
    # strings but formats them through Date(), so an impossible date reaches
    # the UI as "Invalid Date" — parse it properly instead.
    if not isinstance(val, str):
        return False
    try:
        datetime.strptime(val, '%Y-%m-%d')
    except ValueError:
        return False
    return True


def _is_number(val):
    # bool is an int in Python, and `true` is not a weight.
    return isinstance(val, (int, float)) and not isinstance(val, bool)


def _validate_import(data):
    """Check an import payload. Returns a reason code, or None if it is safe to write.

    Required are the fields the app dereferences without a default — the JSON
    backend on `dogs`/`id`/`date`, the Postgres one additionally on
    `name`/`age_group`/`body_pct`/`birth_date` — plus `settings`, which only
    `_default_data()` ever writes: a payload without it would drop the
    calculator presets for good, with no way back through the UI. Everything
    else already has a fallback, so a thinner but genuine export still imports
    while a file from somewhere else is turned away before anything is
    overwritten.
    """
    if not isinstance(data, dict):
        return 'not_object'
    if not isinstance(data.get('dogs'), list):
        return 'no_dogs'

    seen_ids = set()
    for dog in data['dogs']:
        if not isinstance(dog, dict):
            return 'bad_dog'
        if not isinstance(dog.get('id'), str) or not dog['id']:
            return 'bad_dog'
        # Two dogs with one id would hit the Postgres upsert branch, which does
        # not carry weights across — the second dog's history would vanish.
        if dog['id'] in seen_ids:
            return 'bad_dog'
        seen_ids.add(dog['id'])
        if not isinstance(dog.get('name'), str):
            return 'bad_dog'
        if not isinstance(dog.get('age_group'), str):
            return 'bad_dog'
        if not _is_number(dog.get('body_pct')):
            return 'bad_dog'
        # A JSON null here is not a missing key — it would violate NOT NULL.
        if not isinstance(dog.get('birth_date', ''), str):
            return 'bad_dog'
        if not isinstance(dog.get('ratios', []), list):
            return 'bad_dog'
        if not isinstance(dog.get('stock', {}), dict):
            return 'bad_dog'
        if not isinstance(dog.get('weights', []), list):
            return 'bad_dog'

        for entry in dog.get('weights', []):
            if not isinstance(entry, dict):
                return 'bad_weight'
            if not _is_date(entry.get('date')):
                return 'bad_weight'
            if not _is_number(entry.get('weight')):
                return 'bad_weight'

    if not isinstance(data.get('settings'), dict):
        return 'bad_settings'
    return None


@app.route('/api/import', methods=['POST'])
def import_data():
    # silent=True so a body that is not JSON at all comes back as our own JSON
    # error rather than werkzeug's HTML one, which the frontend cannot parse.
    data = request.get_json(silent=True)
    reason = _validate_import(data)
    if reason:
        return jsonify({'error': 'invalid import', 'reason': reason}), 400
    storage.import_all(data)
    return jsonify({'ok': True})


if __name__ == '__main__':
    port = Config.INGRESS_PORT
    debug = os.environ.get('FLASK_DEBUG', 'true').lower() == 'true'
    app.run(host='0.0.0.0', port=port, debug=debug)

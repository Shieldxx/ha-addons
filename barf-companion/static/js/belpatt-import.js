/* === Belpatt.fr Import Module === */

const BelpattImport = {
  PATTERN: /(\d+)\s+year\(s\),\s*(\d+)\s+month\(s\)\s+and\s+(\d+)\s+day\(s\)\s*(\d+(?:\.\d+)?)\s*kg/g,

  _parsedEntries: [],
  _keyHandler: null,

  init() {
    document.getElementById('btn-belpatt-import').addEventListener('click', () => this.open());
  },

  open() {
    if (!App.dog) {
      App.errorModal(App.t('errors.no_dog'), App.t('errors.go_settings'), 'settings');
      return;
    }
    if (!App.dog.birth_date) {
      App.errorModal(App.t('belpatt_import.no_birth_date'), App.t('errors.go_settings'), 'settings');
      return;
    }
    this._showModal();
  },

  _showModal() {
    const existing = document.getElementById('belpatt-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'belpatt-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal modal-belpatt" role="dialog">
        <div class="modal-header-bar"></div>
        <div class="modal-body">
          <h3 class="modal-title">${App.t('belpatt_import.title')}</h3>
          <div id="belpatt-paste-state">
            <textarea id="belpatt-textarea" class="belpatt-textarea"
              placeholder="${App.t('belpatt_import.placeholder')}"></textarea>
            <div class="modal-actions">
              <button id="belpatt-parse-btn" class="btn btn-primary">${App.t('belpatt_import.parse_btn')}</button>
              <button id="belpatt-cancel-btn" class="btn btn-secondary">${App.t('common.cancel')}</button>
            </div>
          </div>
          <div id="belpatt-preview-state" style="display:none">
            <p id="belpatt-summary" class="belpatt-summary"></p>
            <div id="belpatt-preview-list" class="belpatt-preview-list"></div>
            <div class="modal-actions">
              <button id="belpatt-import-btn" class="btn btn-primary">${App.t('belpatt_import.import_btn')}</button>
              <button id="belpatt-cancel2-btn" class="btn btn-secondary">${App.t('common.cancel')}</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', e => { if (e.target === overlay) this._close(); });

    this._keyHandler = e => { if (e.key === 'Escape') this._close(); };
    document.addEventListener('keydown', this._keyHandler);

    overlay.querySelector('#belpatt-parse-btn').addEventListener('click', () => this._parse());
    overlay.querySelector('#belpatt-cancel-btn').addEventListener('click', () => this._close());
  },

  _parse() {
    const text = document.getElementById('belpatt-textarea').value;
    const parsed = this._parseText(text);

    if (parsed.length === 0) {
      App.toast(App.t('belpatt_import.no_records'));
      return;
    }

    const existingDates = new Set((App.dog.weights || []).map(w => w.date));
    const newEntries = parsed.filter(e => !existingDates.has(e.date));
    const dupeCount = parsed.length - newEntries.length;

    this._parsedEntries = newEntries;

    let summary = App.t('belpatt_import.records_found').replace('{count}', parsed.length);
    if (dupeCount > 0) {
      summary += ' · ' + App.t('belpatt_import.duplicates_note').replace('{dupes}', dupeCount);
    }
    document.getElementById('belpatt-summary').textContent = summary;

    const listEl = document.getElementById('belpatt-preview-list');
    listEl.innerHTML = parsed.map(e => {
      const isDupe = existingDates.has(e.date);
      return `<div class="weight-entry${isDupe ? ' belpatt-dupe' : ''}">
        <span class="date">${App.formatDate(e.date)}</span>
        <span class="value">${e.weight} kg</span>
        ${isDupe ? `<span class="belpatt-dupe-label">${App.t('belpatt_import.duplicate')}</span>` : ''}
      </div>`;
    }).join('');

    document.getElementById('belpatt-paste-state').style.display = 'none';
    document.getElementById('belpatt-preview-state').style.display = '';

    const overlay = document.getElementById('belpatt-modal-overlay');
    overlay.querySelector('#belpatt-import-btn').addEventListener('click', () => this._import());
    overlay.querySelector('#belpatt-cancel2-btn').addEventListener('click', () => this._close());
  },

  _parseText(text) {
    const results = [];
    const re = new RegExp(this.PATTERN.source, 'g');
    let match;
    while ((match = re.exec(text)) !== null) {
      const years = parseInt(match[1], 10);
      const months = parseInt(match[2], 10);
      const days = parseInt(match[3], 10);
      const weight = parseFloat(match[4]);
      const date = this._addAge(App.dog.birth_date, years, months, days);
      results.push({ date, weight });
    }
    return results;
  },

  _addAge(birthDateStr, years, months, days) {
    const d = new Date(birthDateStr);
    d.setFullYear(d.getFullYear() + years);
    d.setMonth(d.getMonth() + months);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  },

  async _import() {
    const entries = this._parsedEntries;
    if (!entries || entries.length === 0) {
      this._close();
      return;
    }

    await App.api(`api/dogs/${App.dog.id}/weights/bulk`, {
      method: 'POST',
      body: entries
    });

    this._close();
    await Weight.render();
    App.clearCalcResult();
    App.toast(App.t('belpatt_import.success').replace('{count}', entries.length));
  },

  _close() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    const overlay = document.getElementById('belpatt-modal-overlay');
    if (overlay) overlay.remove();
  },
};

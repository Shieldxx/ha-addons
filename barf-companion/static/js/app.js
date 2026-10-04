/* === BARF Companion — Main App Module === */

const App = {
  lang: 'en',
  strings: {},
  theme: 'dark',        // resolved: always 'dark' or 'light'
  themePref: 'dark',    // the setting: 'dark', 'light' or 'system'
  dog: null,
  settings: null,
  calcResult: null,
  currentPage: 'weight',
  _highlightDogName: false,
  _booting: false,
  _tareContainers: [],
  _prefillInputs: [],
  categories: ['meat', 'bones', 'liver', 'organs', 'veggies', 'nuts', 'fruit'],

  async init() {
    this.initNoZoom();

    // Everything below — and every module — assumes settings and the dog are
    // loaded. If this first read fails, init() would stop here anyway and leave
    // the app looking alive with dead buttons, so say so instead. The early
    // return is load-bearing: Settings.init() would throw on a null App.settings.
    this._booting = true;
    try {
      await this.loadSettings();
      await this.loadDog();
    } catch {
      try {
        await this.loadStrings(this.lang);
      } catch {
        // i18n is gone too; the modal falls back to key text, which is still
        // better than the dead shell this replaces.
      }
      this.applyTheme(this.themePref);
      this.errorModal(this.t('errors.load_failed'), this.t('errors.reload'), 'reload');
      return;
    } finally {
      this._booting = false;
    }

    this.restoreCalcResultIfSameDog();
    await this.loadStrings(this.lang);
    this.applyTheme(this.themePref);
    this.initNav();
    this.initThemeToggle();
    this.initLangToggle();
    this.initDateInputs();

    Weight.init();
    Calculator.init();
    Output.init();
    Settings.init();
    Export.init();

    // Restore last active page or default to 'weight'
    const lastPage = localStorage.getItem('barf_currentPage') || 'weight';
    this.navigate(lastPage);
  },

  // --- Zoom lockout ---
  // iOS Safari has ignored `user-scalable=no` since iOS 10, so the meta tag
  // alone does not stop a pinch. These gesture events are the part it does
  // honour; double-tap zoom is handled by `touch-action` in base.css.
  initNoZoom() {
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(evt => {
      document.addEventListener(evt, e => e.preventDefault(), { passive: false });
    });
  },

  // --- API helpers ---
  // The raw request. Hands back whether it succeeded rather than throwing —
  // import is the only caller that needs the distinction, because it is the one
  // endpoint in this app that answers non-2xx by design.
  async apiResult(path, opts = {}) {
    let res;
    try {
      res = await fetch(path, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
    } catch {
      // Phone offline, server stopped, ingress unreachable.
      return { ok: false, status: 0, data: null };
    }
    try {
      return { ok: res.ok, status: res.status, data: await res.json() };
    } catch {
      // A Flask traceback page or a proxy error page instead of JSON.
      return { ok: false, status: res.status, data: null };
    }
  },

  // Everything else goes through here: a failure is toasted once and then
  // thrown, so the caller's success path — its own toast, its re-render, its
  // cleared input — never runs on a request that did not land.
  async api(path, opts = {}) {
    const res = await this.apiResult(path, opts);
    if (!res.ok) {
      // The boot reads run before the strings are loaded, so a toast here would
      // read "errors.api_offline". init()'s modal is the message in that case.
      if (!this._booting) this.toast(this._apiErrorMessage(res));
      throw new Error(`${opts.method || 'GET'} ${path}: HTTP ${res.status}`);
    }
    return res.data;
  },

  _apiErrorMessage(res) {
    if (res.status === 0) return this.t('errors.api_offline');
    if (res.data === null) return this.t('errors.api_bad_response');
    return this.t('errors.api_failed').replace('{status}', res.status);
  },

  // --- Settings ---
  async loadSettings() {
    this.settings = await this.api('api/settings');
    this.lang = this.settings.lang || 'en';
    this.themePref = this.settings.theme || 'dark';
  },

  async saveSettings(s) {
    this.settings = await this.api('api/settings', { method: 'PUT', body: s });
  },

  // --- Dog ---
  // A reload can legitimately come back with no dog, so clear the cached one
  // rather than leaving the pre-import dog in place for writes to land on.
  async loadDog() {
    const dogs = await this.api('api/dogs');
    this.dog = dogs.length > 0 ? dogs[0] : null;
  },

  async saveDog(dog) {
    if (dog.id) {
      this.dog = await this.api(`api/dogs/${dog.id}`, { method: 'PUT', body: dog });
    } else {
      this.dog = await this.api('api/dogs', { method: 'POST', body: dog });
    }
    return this.dog;
  },

  // --- i18n ---
  async loadStrings(lang) {
    this.lang = lang;
    const res = await fetch(`i18n/${lang}.json`);
    this.strings = await res.json();
    this.applyStrings();

    // Re-render dynamic content affected by language change
    this._rerenderOnLanguageChange();
  },

  _rerenderOnLanguageChange() {
    // Reformat date inputs to the newly selected language format
    this._reformatDateInputs();

    // Re-render tare calculator labels for all stored containers
    this._tareContainers.forEach(container => this._updateTareLabels(container));

    // Re-render calculation results if they exist
    if (this.calcResult) {
      Calculator.renderResults();
    }

    // Re-render weight table if data exists
    if (this.dog && this.dog.weights && this.dog.weights.length > 0) {
      Weight.renderList(this.dog.weights);
      Weight.renderChart(this.dog.weights);
    }
  },

  t(key) {
    const parts = key.split('.');
    let val = this.strings;
    for (const p of parts) {
      if (!val) return key;
      val = val[p];
    }
    return val || key;
  },

  applyStrings() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      const text = this.t(key);
      if (el.tagName === 'OPTION') {
        el.textContent = text;
      } else if (el.tagName === 'INPUT' && el.type !== 'checkbox') {
        el.placeholder = text;
      } else {
        el.textContent = text;
      }
    });
    // Screen readers and the browser pick pronunciation and hyphenation from
    // this; the template ships "en", and Czech is the usual language.
    document.documentElement.lang = this.lang;

    // The button switches language, so it names the one it switches to: on a
    // Czech screen it read CS and produced English.
    const btnLang = document.getElementById('btn-lang');
    btnLang.textContent = this.lang === 'cs' ? 'EN' : 'CS';
    btnLang.title = this.t('common.switch_lang');
    this._updateThemeTitle();
  },

  // --- Theme ---
  // The setting is dark, light or system; App.theme is always the resolved
  // dark or light, which is what the stylesheet and the chart colours need.
  _systemDark: window.matchMedia('(prefers-color-scheme: dark)'),

  applyTheme(pref) {
    this.themePref = pref;
    const theme = pref === 'system' ? (this._systemDark.matches ? 'dark' : 'light') : pref;
    this.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.setAttribute('data-theme-pref', pref);
    // For the inline script in index.html, which paints before settings load.
    try { localStorage.setItem('barf_themePref', pref); } catch {}
    this._updateThemeTitle();
  },

  _updateThemeTitle() {
    document.getElementById('btn-theme').title =
      `${this.t('settings.theme')}: ${this.t('settings.theme_' + this.themePref)}`;
  },

  initThemeToggle() {
    const order = ['dark', 'light', 'system'];
    document.getElementById('btn-theme').addEventListener('click', () => {
      const next = order[(order.indexOf(this.themePref) + 1) % order.length];
      this.applyTheme(next);
      this.settings.theme = next;
      this.saveSettings(this.settings);
      Weight.renderChart(this.dog ? (this.dog.weights || []) : []);
    });

    // In system mode the phone can switch under the app - iOS goes dark at
    // sunset - so follow it live, chart colours included.
    this._systemDark.addEventListener('change', () => {
      if (this.themePref !== 'system') return;
      this.applyTheme('system');
      Weight.renderChart(this.dog ? (this.dog.weights || []) : []);
    });
  },

  initLangToggle() {
    document.getElementById('btn-lang').addEventListener('click', () => {
      const next = this.lang === 'cs' ? 'en' : 'cs';
      this.loadStrings(next);
      this.settings.lang = next;
      this.saveSettings(this.settings);
    });
  },

  // --- Navigation ---
  initNav() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        this.navigate(page);
      });
    });
  },

  navigate(page) {
    // The Output tab is gone and its content is the tail of the Calculator
    // page, so a browser still holding 'output' resumes there rather than
    // dropping through to the generic default below. Fires once per browser;
    // safe to delete after the first launch.
    if (page === 'output') page = 'calculator';

    // The last visited page is restored from localStorage, so a page that has
    // since been removed (Export, now a section of Settings; Output, now part
    // of the Calculator results) would otherwise dereference null here and
    // leave the app blank.
    if (!document.getElementById(`page-${page}`) ||
        !document.querySelector(`.nav-btn[data-page="${page}"]`)) {
      page = 'weight';
    }

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    document.querySelector(`.nav-btn[data-page="${page}"]`).classList.add('active');

    // Save current page to localStorage for persistence across reloads
    // Remember the current page — in memory so a caller that rebuilds the app
    // (import) can re-enter it, and in localStorage across reloads.
    this.currentPage = page;
    localStorage.setItem('barf_currentPage', page);

    if (page === 'settings') Settings.load();
    if (page === 'calculator') Calculator.loadTargetWeight();
  },

  // --- Toast ---
  toast(msg) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  },

  // --- Error Modal ---
  // --- Modals ---
  // Shared shell behind errorModal() and confirmModal(). A lone button keeps the
  // full-width `modal-btn` look the error modal has always had; two or more sit
  // side by side in a `.modal-actions` row, as in the Belpatt import modal.
  // Resolves with the `value` of whichever button was pressed, or with
  // `dismissValue` when the modal is closed without pressing one.
  _modal({ variant, msg, buttons, dismissible = false, dismissValue = null }) {
    return new Promise(resolve => {
      const btns = buttons.map((b, i) =>
        `<button class="btn ${b.cls}" data-idx="${i}">${b.text}</button>`
      ).join('');

      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal modal-${variant}" role="dialog">
          <div class="modal-header-bar"></div>
          <div class="modal-body">
            <p class="modal-message"></p>
            ${buttons.length > 1 ? `<div class="modal-actions">${btns}</div>` : btns}
          </div>
        </div>
      `;
      // The message goes in as text, not markup: the import confirm quotes a
      // dog name read straight out of a file we did not write.
      overlay.querySelector('.modal-message').textContent = msg;
      document.body.appendChild(overlay);

      const close = value => {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
        resolve(value);
      };
      const onKey = e => { if (e.key === 'Escape') close(dismissValue); };

      overlay.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', () => close(buttons[Number(btn.dataset.idx)].value));
      });

      // A question you can back out of also closes on the two gestures that mean
      // "no" — a tap on the backdrop and Escape. The error modal deliberately has
      // neither: its single button is the only way on, and it navigates.
      if (dismissible) {
        overlay.addEventListener('click', e => { if (e.target === overlay) close(dismissValue); });
        document.addEventListener('keydown', onKey);
      }
    });
  },

  errorModal(msg, btnText, targetPage) {
    return this._modal({
      variant: 'error',
      msg,
      buttons: [{ text: btnText, cls: 'btn-primary modal-btn', value: true }],
    }).then(() => {
      // 'reload' is not a page: after a failed boot there is nothing to
      // navigate to, so the only useful action is to try loading again.
      if (targetPage === 'reload') { location.reload(); return; }
      if (targetPage === 'settings') this._highlightDogName = true;
      if (targetPage) this.navigate(targetPage);
    });
  },

  // Blocking yes/no. Resolves true only when the destructive button is pressed —
  // Cancel, the backdrop and Escape all resolve false.
  confirmModal(msg, confirmText) {
    return this._modal({
      variant: 'confirm',
      msg,
      // Cancel first, so it sits on the left as in an iOS alert.
      buttons: [
        { text: this.t('common.cancel'), cls: 'btn-secondary', value: false },
        { text: confirmText, cls: 'btn-danger', value: true },
      ],
      dismissible: true,
      dismissValue: false,
    });
  },

  // --- Weight input pre-fill (shared) ---
  initWeightPrefill(inputId) {
    const input = document.getElementById(inputId);
    if (!this._prefillInputs.includes(input)) {
      this._prefillInputs.push(input);
    }
    this._applyPrefill(input);
    input.addEventListener('focus', () => input.select());
    input.addEventListener('input', () => input.classList.remove('prefilled'));
    input.addEventListener('blur', () => {
      if (!input.value) this._applyPrefill(input);
    });
  },

  // The suggestion is read live, not captured once at init — an import that
  // replaces the whole weight history would otherwise leave the old value
  // sitting in the field, one tap away from being saved as a new entry.
  _applyPrefill(input) {
    const last = this.getCurrentWeight();
    input.value = last > 0 ? last : '';
    input.classList.toggle('prefilled', last > 0);
  },

  refreshWeightPrefill() {
    this._prefillInputs.forEach(input => {
      if (!input.value || input.classList.contains('prefilled')) {
        this._applyPrefill(input);
      }
    });
  },

  // --- Tare calculator (shared) ---
  initTare(container, targetInputId) {
    // Store reference for language change re-render
    if (!this._tareContainers.includes(container)) {
      this._tareContainers.push(container);
    }

    this._updateTareLabels(container);

    const target = targetInputId ? document.getElementById(targetInputId) : null;

    const update = () => {
      const combined = parseFloat(container.querySelector('.tare-combined').value);
      const you = parseFloat(container.querySelector('.tare-you').value);
      const el = container.querySelector('.tare-result-value');
      const dog = combined - you;
      const valid = !isNaN(combined) && !isNaN(you) && dog >= 0;

      el.textContent = valid ? `${dog.toFixed(1)} kg` : '— kg';
      if (target) this._fillFromTare(target, valid ? dog.toFixed(1) : null);
    };

    container.querySelector('.tare-combined').addEventListener('input', update);
    container.querySelector('.tare-you').addEventListener('input', update);
  },

  // Push the tare result into the weight input below it. A null value means
  // the calculator has no usable result, so fall back to the last-known-weight
  // suggestion — the field always mirrors what the calculator shows.
  _fillFromTare(input, value) {
    if (value !== null) {
      input.value = value;
      input.classList.remove('prefilled');
      return;
    }
    this._applyPrefill(input);
  },

  _updateTareLabels(container) {
    const dogName = this.dog?.name || 'dog';
    container.querySelector('.tare-combined-label').textContent =
      this.t('calc.tare_combined').replace('{dog}', dogName);
    container.querySelector('.tare-result-label').textContent =
      this.t('calc.tare_result').replace('{dog}', dogName);
  },

  refreshDogName() {
    this._tareContainers.forEach(container => this._updateTareLabels(container));
    if (this.calcResult) {
      this.calcResult.dog = this.dog?.name || 'Pes';
      this.calcResult.dogName = this.dog?.name;
      this.saveCalcResult();
      // The name is the order text's first line. #output-content is always in
      // the DOM now, so writing to it while the results are hidden is harmless.
      Output.render();
    }
  },

  // --- Storage (calculation results) ---
  saveCalcResult() {
    if (this.calcResult) {
      // Store dog name so we can verify it's the same dog on restore
      this.calcResult.dogName = this.dog?.name;
      localStorage.setItem('barf_calcResult', JSON.stringify(this.calcResult));
    }
  },

  restoreCalcResult() {
    const stored = localStorage.getItem('barf_calcResult');
    if (stored) {
      try {
        this.calcResult = JSON.parse(stored);
      } catch (e) {
        // Corrupt/invalid data, silently discard
        localStorage.removeItem('barf_calcResult');
      }
    }
  },

  restoreCalcResultIfSameDog() {
    const stored = localStorage.getItem('barf_calcResult');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Only restore if it's the same dog
        if (parsed.dogName === this.dog?.name) {
          this.calcResult = parsed;
        } else {
          // Different dog, clear the old results
          localStorage.removeItem('barf_calcResult');
        }
      } catch (e) {
        // Corrupt/invalid data, silently discard
        localStorage.removeItem('barf_calcResult');
      }
    }
  },

  clearCalcResult() {
    this.calcResult = null;
    localStorage.removeItem('barf_calcResult');
    Calculator.clearResults();
  },

  // --- Helpers ---
  formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString(this.lang === 'cs' ? 'cs-CZ' : 'en-US');
  },

  formatG(g) {
    return Math.round(g).toLocaleString() + ' g';
  },

  dayName(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString(this.lang === 'cs' ? 'cs-CZ' : 'en-US', { weekday: 'short' });
  },

  // Converts ISO date string → locale format string for display in text input
  formatDateForInput(isoDate) {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-').map(Number);
    if (this.lang === 'cs') {
      return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
    }
    return `${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}/${y}`;
  },

  // Converts a typed date → ISO string in the current language's field order;
  // returns null if invalid.
  parseDateInput(str) {
    return this._parseDate(str, this.lang === 'cs' ? 'dmy' : 'mdy');
  },

  // Used when reformatting on a language switch, where the field still holds
  // the other language's format: slashes mean month first, anything else day.
  _parseDateAutoFormat(str) {
    return this._parseDate(str, (str || '').includes('/') ? 'mdy' : 'dmy');
  },

  // The one date parser. The date fields bring up the iPhone number pad,
  // which has digits only, and a Czech decimal pad offers a comma, not a dot -
  // so any of . , / - or a space separates the parts, and eight bare digits
  // work too (18092026). A four-digit first part is read as ISO year first.
  // Impossible dates are still refused: 31.02. does not roll over into March.
  _parseDate(str, order) {
    const s = (str || '').trim();
    if (!s) return null;
    const parts = /^\d{8}$/.test(s)
      ? [s.slice(0, 2), s.slice(2, 4), s.slice(4)]
      : s.split(/[\s.,\/-]+/).filter(Boolean);
    if (parts.length !== 3 || !parts.every(p => /^\d+$/.test(p))) return null;
    let d, m, y;
    if (parts[0].length === 4) [y, m, d] = parts.map(Number);
    else if (order === 'dmy') [d, m, y] = parts.map(Number);
    else [m, d, y] = parts.map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  },

  // Show how a typed date was understood: 18092026 becomes 18.09.2026 when
  // the field is left. Something unparseable stays as typed, for Save to flag.
  initDateInputs() {
    ['weight-date', 'calc-date', 'dog-birth-date'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('blur', () => {
        const iso = this.parseDateInput(el.value);
        if (iso) el.value = this.formatDateForInput(iso);
      });
    });
  },

  // Reformat all date text inputs to the current language after a lang switch
  _reformatDateInputs() {
    ['weight-date', 'calc-date', 'dog-birth-date'].forEach(id => {
      const el = document.getElementById(id);
      if (!el || !el.value) return;
      const iso = this._parseDateAutoFormat(el.value);
      if (iso) el.value = this.formatDateForInput(iso);
    });
  },

  getCurrentWeight() {
    if (!this.dog || !this.dog.weights || this.dog.weights.length === 0) return 0;
    const sorted = [...this.dog.weights].sort((a, b) => a.date.localeCompare(b.date));
    return sorted[sorted.length - 1].weight;
  },

  getCalcWeight() {
    if (this.dog && this.dog.target_weight && this.dog.target_weight > 0) {
      return this.dog.target_weight;
    }
    return this.getCurrentWeight();
  },

  getTargetWeight() {
    return (this.dog && this.dog.target_weight) ? this.dog.target_weight : 0;
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());

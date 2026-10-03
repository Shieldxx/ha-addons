/* === M5: Export / Import Module === */

const Export = {
  init() {
    document.getElementById('btn-export').addEventListener('click', () => this.exportData());
    document.getElementById('file-import').addEventListener('change', (e) => this.pickFile(e));
  },

  async exportData() {
    const data = await App.api('api/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `barf-companion-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    App.toast(App.t('export.success'));
  },

  // Picking a file only gets as far as the confirm — nothing is sent until the
  // owner has seen what is about to be replaced.
  async pickFile(e) {
    const input = e.target;
    const file = input.files[0];
    if (!file) return;

    let data;
    try {
      const text = await file.text();
      // Cleared once the file is read, not before: clearing first detaches the
      // File, and not clearing at all means picking the same file twice in a
      // row fires no change event.
      input.value = '';
      data = JSON.parse(text);
    } catch {
      input.value = '';
      App.errorModal(App.t('export.invalid.not_json'), App.t('common.ok'));
      return;
    }

    // Only deep enough to describe the file below — the server validates it
    // properly and is the sole authority on what gets written.
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      App.errorModal(App.t('export.invalid.not_object'), App.t('common.ok'));
      return;
    }
    if (!Array.isArray(data.dogs)) {
      App.errorModal(App.t('export.invalid.no_dogs'), App.t('common.ok'));
      return;
    }

    const msg = App.t('export.import_confirm')
      .replace('{current}', this._summary(App.dog ? [App.dog] : []))
      .replace('{incoming}', this._summary(data.dogs));
    if (await App.confirmModal(msg, App.t('export.import_btn'))) {
      await this.importData(data);
    }
  },

  // "Dexter — 89 záznamů". More than one dog cannot come out of this app's own
  // export, so the first name plus the total entry count is enough to tell two
  // files apart.
  _summary(dogs) {
    if (!dogs || dogs.length === 0) return App.t('export.import_summary_empty');
    const count = dogs.reduce((n, d) => n + ((d && d.weights) ? d.weights.length : 0), 0);
    return App.t('export.import_summary')
      .replace('{name}', (dogs[0] && dogs[0].name) || '?')
      .replace('{count}', count);
  },

  async importData(data) {
    const res = await App.apiResult('api/import', { method: 'POST', body: data });
    if (!res.ok) {
      // Nothing was written — the server validates before it touches storage.
      App.errorModal(this._rejectionMessage(res.data && res.data.reason), App.t('common.ok'));
      return;
    }

    try {
      // Reload everything. The order matters: drop the stale calculation first
      // so nothing below re-renders it, then the App state every view reads
      // (theme before strings, dog before strings), then the views themselves.
      App.clearCalcResult();
      await App.loadSettings();
      App.applyTheme(App.theme);
      await App.loadDog();
      await App.loadStrings(App.lang);
      await Weight.render();
      App.refreshWeightPrefill();

      // The forms on the current page still hold the pre-import values, and
      // Save would write them straight back over the imported data. Re-enter
      // the page rather than patch each field — navigate() already knows how to
      // rebuild a page from App state.
      App.navigate(App.currentPage);
    } catch {
      // The data HAS been replaced; only the screen is stale. api() toasted the
      // reason, but the opposite reading — "the import failed" — is worse.
      App.errorModal(App.t('export.import_reload_error'), App.t('common.ok'));
      return;
    }

    App.toast(App.t('export.import_success'));
  },

  // The server names the reason in a machine-readable code so the wording stays
  // on this side; anything we have no string for falls back to the generic one.
  _rejectionMessage(reason) {
    const msg = App.t(`export.invalid.${reason}`);
    return (typeof msg === 'string' && !msg.startsWith('export.'))
      ? msg
      : App.t('export.invalid.generic');
  },
};

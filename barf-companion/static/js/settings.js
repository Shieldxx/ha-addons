/* === M4: Settings Module === */

const Settings = {
  init() {
    document.getElementById('btn-save-settings').addEventListener('click', () => this.save());

    document.getElementById('dog-preset').addEventListener('change', (e) => {
      this.applyPreset(e.target.value);
    });

    document.getElementById('dog-age').addEventListener('change', (e) => {
      this.applyPreset(e.target.value);
    });

    // Ratio sum live update
    document.querySelectorAll('.ratio-input').forEach(input => {
      input.addEventListener('input', () => this.updateRatioSum());
    });

    this.load();
  },

  load() {
    // Fall back to an empty dog: an import can bring a backup with no profile,
    // and the form must then blank out rather than keep the old dog's values.
    const dog = App.dog || {};
    document.getElementById('dog-name').value = dog.name || '';
    document.getElementById('dog-birth-date').value =
      dog.birth_date ? App.formatDateForInput(dog.birth_date) : '';
    document.getElementById('dog-age').value = dog.age_group || 'adult';
    document.getElementById('dog-pct').value = dog.body_pct || 3;
    document.getElementById('dog-target-weight').value = dog.target_weight || '';

    const ratios = dog.ratios || [72, 10, 5, 5, 7, 0, 1];
    document.querySelectorAll('.ratio-input').forEach(input => {
      const idx = parseInt(input.dataset.cat);
      input.value = ratios[idx];
    });

    const stock = dog.stock || {};
    document.querySelectorAll('.stock-input').forEach(input => {
      input.value = stock[input.dataset.cat] || 0;
    });

    // Output mode
    const mode = App.settings.output_mode || 'A';
    document.getElementById('output-mode').value = mode;

    this.updateRatioSum();

    if (App._highlightDogName) {
      App._highlightDogName = false;
      const nameInput = document.getElementById('dog-name');
      const saveBtn = document.getElementById('btn-save-settings');
      nameInput.classList.add('input-error');
      nameInput.focus();
      nameInput.addEventListener('input', function handler() {
        nameInput.classList.remove('input-error');
        nameInput.removeEventListener('input', handler);
        saveBtn.classList.add('btn-pulse');
      });
    }
  },

  applyPreset(preset) {
    const presets = App.settings.presets || {};
    const p = presets[preset];
    if (!p) return;

    document.getElementById('dog-pct').value = p.pct;
    p.ratios.forEach((val, idx) => {
      const input = document.querySelector(`.ratio-input[data-cat="${idx}"]`);
      if (input) input.value = val;
    });
    this.updateRatioSum();
  },

  updateRatioSum() {
    let sum = 0;
    document.querySelectorAll('.ratio-input').forEach(input => {
      sum += parseFloat(input.value) || 0;
    });
    const el = document.getElementById('ratio-sum');
    el.textContent = sum + '%';
    el.className = 'ratio-sum mono ' + (sum === 100 ? 'valid' : 'invalid');
  },

  async save() {
    const name = document.getElementById('dog-name').value.trim();
    if (!name) return;

    const birthDateRaw = document.getElementById('dog-birth-date').value;
    let birthDate = '';
    if (birthDateRaw.trim()) {
      birthDate = App.parseDateInput(birthDateRaw);
      if (birthDate === null) { App.toast(App.t('errors.invalid_date')); return; }
    }
    const ageGroup = document.getElementById('dog-age').value;
    const bodyPct = parseFloat(document.getElementById('dog-pct').value) || 3;
    const targetWeight = parseFloat(document.getElementById('dog-target-weight').value) || 0;

    const ratios = [];
    document.querySelectorAll('.ratio-input').forEach(input => {
      ratios[parseInt(input.dataset.cat)] = parseFloat(input.value) || 0;
    });

    const stock = {};
    document.querySelectorAll('.stock-input').forEach(input => {
      stock[input.dataset.cat] = parseFloat(input.value) || 0;
    });

    const dog = {
      id: App.dog ? App.dog.id : null,
      name,
      birth_date: birthDate,
      age_group: ageGroup,
      body_pct: bodyPct,
      target_weight: targetWeight,
      ratios,
    };

    await App.saveDog(dog);
    App.refreshDogName();

    // Save stock separately
    if (App.dog) {
      await App.api(`api/dogs/${App.dog.id}/stock`, { method: 'PUT', body: stock });
      App.dog.stock = stock;
    }

    // Save global settings
    App.settings.output_mode = document.getElementById('output-mode').value;
    await App.saveSettings(App.settings);

    // The order text is built from output_mode, so a mode change has to reach a
    // result already sitting on the Calculator page. Before the fold, arriving
    // on the Output tab re-rendered it; nothing does now.
    if (App.calcResult) Calculator.renderResults();

    document.getElementById('btn-save-settings').classList.remove('btn-pulse');
    App.toast(App.t('settings.saved'));
  },
};

/* === M1: Weight Module === */

const Weight = {
  chart: null,
  _tsLeft: 0,
  _tsRight: 100,
  _deleting: false,

  init() {
    document.getElementById('weight-date').value =
      App.formatDateForInput(new Date().toISOString().slice(0, 10));
    document.getElementById('btn-add-weight').addEventListener('click', () => this.addWeight());
    this.initTare();
    App.initWeightPrefill('weight-value');
    this.render();
    BelpattImport.init();
  },

  initTare() {
    App.initTare(document.querySelector('#page-weight .tare-card'), 'weight-value');
  },

  async render() {
    if (!App.dog) {
      // Empty renders rather than a hand-written message: this also resets the
      // entry count and destroys a chart left over from the previous dog.
      this.renderList([]);
      this.renderChart([]);
      return;
    }

    const weights = await App.api(`api/dogs/${App.dog.id}/weights`);
    App.dog.weights = weights;
    this._initTriSlider(weights);
    this.renderList(weights);
    this.renderChart(weights);
  },

  // --- Tri-slider ---

  _initTriSlider(weights) {
    this._tsRight = 100;
    if (weights && weights.length >= 2) {
      const oldest = new Date(weights[0].date);
      const today = new Date();
      const totalDays = Math.max(1, (today - oldest) / 86400000);
      const yearPct = (365 / totalDays) * 100;
      this._tsLeft = Math.max(0, 100 - yearPct);
    } else {
      this._tsLeft = 0;
    }
    this._positionThumbs();
    this._bindTriSlider();
  },

  _positionThumbs() {
    const container = document.getElementById('weight-tri-slider');
    if (!container) return;
    // Relative to the slider, never a measured width: the chart is also redrawn
    // while the Weight page is hidden (after an import, say), where the slider
    // measures 0px and every thumb piled up at the left edge. Relative positions
    // also follow the slider when it is resized - a rotated phone, or Home
    // Assistant's sidebar opening. The 8px inset matches .tri-slider-track.
    const inset = 8;
    const at = pct => `calc(${inset}px + (100% - ${2 * inset}px) * ${pct / 100})`;

    document.getElementById('tslider-left').style.left = at(this._tsLeft);
    document.getElementById('tslider-right').style.left = at(this._tsRight);
    document.getElementById('tslider-mid').style.left = at((this._tsLeft + this._tsRight) / 2);

    const rangeEl = document.getElementById('tri-slider-range');
    rangeEl.style.left = this._tsLeft + '%';
    rangeEl.style.width = (this._tsRight - this._tsLeft) + '%';
  },

  _bindTriSlider() {
    const container = document.getElementById('weight-tri-slider');
    if (!container || container.dataset.bound) return;
    container.dataset.bound = '1';

    const getUsablePct = clientX => {
      const rect = container.getBoundingClientRect();
      const inset = 8;
      const usable = rect.width - 2 * inset;
      return Math.min(100, Math.max(0, (clientX - rect.left - inset) / usable * 100));
    };

    const MIN_GAP = 1;

    ['tslider-left', 'tslider-mid', 'tslider-right'].forEach(id => {
      const thumb = document.getElementById(id);
      thumb.addEventListener('pointerdown', e => {
        e.preventDefault();
        thumb.setPointerCapture(e.pointerId);
        let lastPct = getUsablePct(e.clientX);

        const onMove = e => {
          const pct = getUsablePct(e.clientX);
          const delta = pct - lastPct;
          lastPct = pct;

          if (id === 'tslider-left') {
            this._tsLeft = Math.min(this._tsRight - MIN_GAP, Math.max(0, pct));
          } else if (id === 'tslider-right') {
            this._tsRight = Math.max(this._tsLeft + MIN_GAP, Math.min(100, pct));
          } else {
            let newL = this._tsLeft + delta;
            let newR = this._tsRight + delta;
            if (newL < 0) { newR -= newL; newL = 0; }
            if (newR > 100) { newL -= (newR - 100); newR = 100; }
            this._tsLeft = Math.max(0, newL);
            this._tsRight = Math.min(100, newR);
          }
          this._positionThumbs();
          this.renderChart(App.dog ? App.dog.weights : []);
        };

        const onUp = () => {
          thumb.removeEventListener('pointermove', onMove);
          thumb.removeEventListener('pointerup', onUp);
        };

        thumb.addEventListener('pointermove', onMove);
        thumb.addEventListener('pointerup', onUp);
      });
    });
  },

  _filterWeights(weights) {
    if (!weights || weights.length === 0) return weights;
    const oldest = new Date(weights[0].date);
    const today = new Date();
    const totalMs = today - oldest;
    const startMs = oldest.getTime() + (this._tsLeft / 100) * totalMs;
    const endMs = oldest.getTime() + (this._tsRight / 100) * totalMs;
    const start = new Date(startMs).toISOString().slice(0, 10);
    const end = new Date(endMs).toISOString().slice(0, 10);
    return weights.filter(w => w.date >= start && w.date <= end);
  },

  // --- List & Chart ---

  renderList(weights) {
    const container = document.getElementById('weight-list');
    const count = document.getElementById('weight-count');
    if (count) count.textContent = weights && weights.length ? `(${weights.length})` : '';
    if (!weights || weights.length === 0) {
      container.innerHTML = `<p class="no-data">${App.t('weight.no_data')}</p>`;
      return;
    }

    container.innerHTML = [...weights].reverse().map(w => `
      <div class="weight-entry">
        <span class="date">${App.formatDate(w.date)}</span>
        <span class="value">${w.weight} kg</span>
        <button class="btn-delete" data-date="${w.date}">
          <svg class="icon"><use href="#icon-delete"/></svg>
        </button>
      </div>
    `).join('');

    container.querySelectorAll('.btn-delete').forEach(btn => {
      btn.addEventListener('click', () => this.deleteWeight(btn.dataset.date));
    });
  },

  renderChart(weights) {
    const visible = this._filterWeights(weights);
    const ctx = document.getElementById('weight-chart');
    if (this.chart) this.chart.destroy();

    if (!visible || visible.length === 0) return;

    const isDark = App.theme === 'dark';
    const rootStyle = getComputedStyle(document.documentElement);
    const accent = rootStyle.getPropertyValue('--accent').trim() || '#4a9d6e';
    const accentFill = rootStyle.getPropertyValue('--accent-tint').trim() || 'rgba(74,157,110,0.15)';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const textColor = rootStyle.getPropertyValue('--muted').trim() || (isDark ? '#6b7d92' : '#8a7a6a');

    this.chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: visible.map(w => App.formatDate(w.date)),
        datasets: [{
          label: App.t('weight.weight_kg'),
          data: visible.map(w => w.weight),
          borderColor: accent,
          backgroundColor: accentFill,
          fill: true,
          tension: 0.3,
          pointRadius: 4,
          pointBackgroundColor: accent,
          pointBorderColor: accent,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: {
            ticks: { color: textColor, font: { family: 'DM Mono', size: 10 } },
            grid: { color: gridColor },
          },
          y: {
            ticks: { color: textColor, font: { family: 'DM Mono', size: 10 } },
            grid: { color: gridColor },
          }
        }
      }
    });
  },

  async addWeight() {
    if (!App.dog) {
      App.errorModal(
        App.t('errors.no_dog'),
        App.t('errors.go_settings'),
        'settings'
      );
      return;
    }

    const dateRaw = document.getElementById('weight-date').value;
    const date = App.parseDateInput(dateRaw);
    const weight = parseFloat(document.getElementById('weight-value').value);
    if (!date) { App.toast(App.t('errors.invalid_date')); return; }
    if (isNaN(weight) || weight <= 0) return;

    await App.api(`api/dogs/${App.dog.id}/weights`, {
      method: 'POST',
      body: { date, weight }
    });

    document.getElementById('weight-value').value = '';
    // Await the refetch so the chart and the entry count — which are the only
    // confirmation this path gives — are on screen before anything else runs.
    await this.render();
    App.clearCalcResult();
  },

  async deleteWeight(date) {
    if (!App.dog || this._deleting) return;

    // Name the record: 89 rows and a thumb-sized button make "this record" far
    // too easy to get wrong, and there is no undo anywhere in this app.
    const entry = (App.dog.weights || []).find(w => w.date === date);
    const msg = App.t('weight.delete_confirm')
      .replace('{date}', App.formatDate(date))
      .replace('{weight}', entry ? entry.weight : '?');

    // A second tap while the confirm is open would stack a second overlay for a
    // row that is about to disappear — the Belpatt modal guards the same way.
    this._deleting = true;
    const confirmed = await App.confirmModal(msg, App.t('common.delete'));
    this._deleting = false;
    if (!confirmed) return;

    await App.api(`api/dogs/${App.dog.id}/weights/${date}`, { method: 'DELETE' });
    this.render();
    App.clearCalcResult();
    App.toast(App.t('weight.deleted'));
  },
};

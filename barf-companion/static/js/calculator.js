/* === M2: Calculator Module === */

const Calculator = {
  init() {
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('calc-date').value = App.formatDateForInput(today);

    document.getElementById('btn-calculate').addEventListener('click', () => this.calculate());

    // Populate target weight from dog profile and sync on change
    this.loadTargetWeight();
    document.getElementById('calc-target-weight').addEventListener('change', async () => {
      if (!App.dog) return;
      const val = parseFloat(document.getElementById('calc-target-weight').value) || 0;
      App.dog.target_weight = val;
      await App.saveDog(App.dog);
    });

    // Restore and display previous calculation results if they exist
    if (App.calcResult) {
      this.renderResults();
    }
  },

  loadTargetWeight() {
    // Fall back to an empty dog: an import can leave no profile, and the field
    // must blank rather than keep the previous dog's target.
    const dog = App.dog || {};
    document.getElementById('calc-target-weight').value = dog.target_weight || '';
  },

  calculate() {
    if (!App.dog) {
      App.errorModal(
        App.t('errors.no_dog'),
        App.t('errors.go_settings'),
        'settings'
      );
      return;
    }

    const currentWeight = App.getCurrentWeight();
    const calcWeight = App.getCalcWeight();
    if (calcWeight <= 0) {
      App.errorModal(
        App.t('errors.no_weight'),
        App.t('errors.go_weight'),
        'weight'
      );
      return;
    }

    const days = parseInt(document.getElementById('calc-days').value) || 14;
    const prepDateRaw = document.getElementById('calc-date').value;
    let prepDate = App.parseDateInput(prepDateRaw);
    if (!prepDate) { App.toast(App.t('errors.invalid_date')); return; }
    const startDate = new Date(prepDate);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + days - 1);

    const dailyTotal = calcWeight * 1000 * (App.dog.body_pct / 100);
    const periodTotal = dailyTotal * days;

    const catKeys = App.categories;
    const ratios = App.dog.ratios || [72, 10, 5, 5, 7, 0, 1];
    const stock = App.dog.stock || {};
    const weights = [...(App.dog.weights || [])].sort((a, b) => a.date.localeCompare(b.date));

    const results = catKeys.map((key, i) => {
      const need = periodTotal * (ratios[i] / 100);
      const inStock = stock[key] || 0;
      const toBuy = Math.max(0, need - inStock);
      return { key, need, inStock, toBuy };
    });

    App.calcResult = {
      dog: App.dog.name || 'Pes',
      days,
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
      dailyTotal,
      periodTotal,
      currentWeight,
      calcWeight,
      targetWeight: App.getTargetWeight(),
      usedTargetWeight: calcWeight !== currentWeight,
      bodyPct: App.dog.body_pct,
      ratios,
      weightsSnapshot: weights.slice(-3),
      items: results,
    };

    this.renderResults();
    App.saveCalcResult();
  },

  renderResults() {
    const r = App.calcResult;
    if (!r) return;

    document.getElementById('calc-empty').style.display = 'none';
    document.getElementById('calc-results').style.display = 'block';
    document.getElementById('calc-daily').textContent = App.formatG(r.dailyTotal);
    document.getElementById('calc-total').textContent = App.formatG(r.periodTotal);
    const weightLabel = r.usedTargetWeight
      ? `${App.t('calc.calculated_from_target')} ${r.calcWeight} kg`
      : `${App.t('calc.calculated_from')} ${r.currentWeight} kg`;
    document.getElementById('calc-weight-source').textContent = weightLabel;

    // Target vs. current comparison
    const compareEl = document.getElementById('calc-weight-compare');
    if (compareEl) {
      if (r.targetWeight > 0 && r.currentWeight > 0) {
        const delta = r.currentWeight - r.targetWeight;
        const sign = delta > 0 ? '+' : '';
        const cls = delta > 0 ? 'over' : delta < 0 ? 'under' : 'match';
        compareEl.style.display = 'flex';
        compareEl.innerHTML = `
          <span class="compare-label">${App.t('calc.current_vs_target')}</span>
          <span class="compare-current">${r.currentWeight} kg</span>
          <span class="compare-arrow">→</span>
          <span class="compare-target">${r.targetWeight} kg</span>
          <span class="compare-delta ${cls}">(${sign}${delta.toFixed(1)} kg)</span>
        `;
      } else {
        compareEl.style.display = 'none';
      }
    }

    // Coverage chips
    const startDay = App.dayName(r.startDate);
    const endDay = App.dayName(r.endDate);
    document.getElementById('calc-coverage').innerHTML = `
      <div class="coverage-chip">
        <span class="dot"></span>
        ${App.t('calc.from')}: ${App.formatDate(r.startDate)} (${startDay})
      </div>
      <div class="coverage-chip">
        <span class="dot"></span>
        ${App.t('calc.to')}: ${App.formatDate(r.endDate)} (${endDay})
      </div>
      <div class="coverage-chip">
        <span class="dot"></span>
        ${r.days} ${App.t('common.days')}
      </div>
    `;

    // Table
    const tbody = document.getElementById('calc-table-body');
    tbody.innerHTML = r.items.map(item => {
      const buyClass = item.toBuy > 0 ? 'positive' : 'zero';
      return `<tr>
        <td>${App.t('calc.' + item.key)}</td>
        <td>${App.formatG(item.need)}</td>
        <td>${App.formatG(item.inStock)}</td>
        <td class="${buyClass}">${App.formatG(item.toBuy)}</td>
      </tr>`;
    }).join('');

    // The order text is the same result read out loud, and it goes stale on
    // exactly the same events, so it renders from here rather than off a
    // second navigation.
    Output.render();
  },

  // Counterpart to renderResults — the block keeps showing the old numbers
  // until something hides it.
  clearResults() {
    document.getElementById('calc-results').style.display = 'none';
    document.getElementById('calc-empty').style.display = '';
  },
};

/* === M3: Output Module ===
   No longer a page: the order text renders into a card inside the Calculator's
   results block. This file stays because the bulk of it is the text templates,
   which is what actually gets edited. */

const Output = {
  init() {
    document.getElementById('btn-copy').addEventListener('click', () => this.copy());
  },

  render() {
    const r = App.calcResult;
    // Calculator decides when this block is on screen; with no result it is
    // hidden, so there is nothing here to say so.
    if (!r) return;

    const mode = App.settings.output_mode || 'A';
    let text;

    if (mode === 'A') {
      text = this.renderTemplateA(r);
    } else {
      text = this.renderTemplateB(r);
    }

    document.getElementById('output-content').textContent = text;
  },

  renderTemplateA(r) {
    const mainKeys = ['meat', 'bones', 'liver', 'organs'];
    const extraKeys = ['veggies', 'nuts', 'fruit'];
    const lines = [];
    lines.push(App.t('output.template_header').replace('{dog}', r.dog));
    lines.push(App.t('output.template_period')
      .replace('{from}', App.formatDate(r.startDate))
      .replace('{to}', App.formatDate(r.endDate))
      .replace('{days}', r.days));
    lines.push(this.renderDailyDoseLine(r));
    const weightHistory = this.renderWeightHistoryLine(r);
    if (weightHistory) lines.push(weightHistory);
    lines.push('');

    lines.push(`${App.t('output.to_buy')}:`);
    mainKeys.forEach(key => {
      const item = this.findItem(r, key);
      lines.push(`- ${App.t('calc.' + key)} (${this.getRatio(r, key)}%): ${App.formatG(item ? item.toBuy : 0)}`);
    });

    lines.push('');
    lines.push(`${App.t('output.freezer_stock')}:`);
    lines.push(`- ${mainKeys
      .map(key => {
        const item = this.findItem(r, key);
        return `${App.t('calc.' + key)}: ${App.formatG(item ? item.inStock : 0)}`;
      })
      .join(' | ')}`);

    const extraToBuy = extraKeys
      .map(key => ({ key, item: this.findItem(r, key) }))
      .filter(({ item }) => item && item.toBuy > 0)
      .map(({ key, item }) => `${App.t('calc.' + key)} (${this.getRatio(r, key)}%): ${App.formatG(item.toBuy)}`);

    if (extraToBuy.length > 0) {
      lines.push('');
      lines.push(`${App.t('output.other_to_buy')}: ${extraToBuy.join(' | ')}`);
    }

    const extraStock = extraKeys
      .map(key => ({ key, item: this.findItem(r, key) }))
      .filter(({ item }) => item && item.inStock > 0)
      .map(({ key, item }) => `${App.t('calc.' + key)}: ${App.formatG(item.inStock)}`);

    if (extraStock.length > 0) {
      lines.push(`${App.t('output.other_stock')}: ${extraStock.join(' | ')}`);
    }

    return lines.join('\n');
  },

  renderDailyDoseLine(r) {
    const pct = this.formatPct(r.bodyPct || App.dog?.body_pct || 0);
    const usedTargetWeight = typeof r.usedTargetWeight === 'boolean'
      ? r.usedTargetWeight
      : Boolean(r.targetWeight > 0 && r.calcWeight === r.targetWeight);
    const sourceWeight = usedTargetWeight ? (r.targetWeight || r.calcWeight) : (r.calcWeight || r.currentWeight);
    const sourceKey = usedTargetWeight ? 'output.from_target_weight' : 'output.from_current_weight';
    const source = App.t(sourceKey)
      .replace('{pct}', pct)
      .replace('{weight}', this.formatKg(sourceWeight));
    return `${App.t('output.daily_dose')}: ${App.formatG(r.dailyTotal)} (${source})`;
  },

  renderWeightHistoryLine(r) {
    const weights = this.getWeightHistory(r);
    if (weights.length === 0 && !r.currentWeight) return '';

    const current = weights.length > 0
      ? weights[weights.length - 1]
      : { weight: r.currentWeight, date: null };
    const previous = weights.slice(0, -1).reverse();

    let line = `${App.t('output.current_weight')}: ${this.formatKg(current.weight)} kg`;
    if (previous.length > 0) {
      line += ` | ${App.t('output.previous_weight')}: `;
      line += previous
        .map(w => `${this.formatKg(w.weight)} kg${w.date ? ` (${this.formatShortDate(w.date)})` : ''}`)
        .join(' | ');
    }
    return line;
  },

  getWeightHistory(r) {
    if (Array.isArray(r.weightsSnapshot) && r.weightsSnapshot.length > 0) {
      return [...r.weightsSnapshot].sort((a, b) => a.date.localeCompare(b.date));
    }
    if (App.dog && Array.isArray(App.dog.weights) && App.dog.weights.length > 0) {
      return [...App.dog.weights]
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-3);
    }
    return [];
  },

  findItem(r, key) {
    return (r.items || []).find(item => item.key === key);
  },

  getRatio(r, key) {
    const idx = App.categories.indexOf(key);
    const ratios = r.ratios || App.dog?.ratios || [];
    return this.formatPct(ratios[idx] || 0);
  },

  formatPct(value) {
    const n = parseFloat(value) || 0;
    return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
  },

  formatKg(value) {
    const n = parseFloat(value) || 0;
    return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
  },

  formatShortDate(dateStr) {
    const d = new Date(dateStr);
    if (App.lang === 'cs') {
      return `${d.getDate()}.${d.getMonth() + 1}.`;
    }
    return `${d.getMonth() + 1}/${d.getDate()}`;
  },

  renderTemplateB(r) {
    const lines = [];
    lines.push(App.t('output.shopping_header').replace('{dog}', r.dog));
    lines.push(`${App.formatDate(r.startDate)} – ${App.formatDate(r.endDate)} (${r.days} ${App.t('common.days')})`);
    lines.push('─'.repeat(30));

    r.items.forEach(item => {
      if (item.toBuy > 0) {
        lines.push(`${App.t('calc.' + item.key).padEnd(16)} ${App.formatG(item.toBuy)}`);
      }
    });

    return lines.join('\n');
  },

  async copy() {
    const text = document.getElementById('output-content').textContent;
    try {
      await navigator.clipboard.writeText(text);
      App.toast(App.t('output.copied'));
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      App.toast(App.t('output.copied'));
    }
  },
};

// === www/js/ui/phase-stepper.js ===
/** Chips de fase con candado visual; el click delega la lógica en main.js. */
import { STRINGS } from './strings.es.js';
import { PHASES } from '../core/constants.js';
import { evaluateGuards } from '../core/phases.js';

export class PhaseStepper {
  constructor(root, store, { onGoToPhase }) {
    this.root = root;
    this.store = store;
    this.onGoToPhase = onGoToPhase;
    this.render();
    store.subscribe((p, u) => u.phase, () => this.render());
    store.subscribe((p, u) => `${u.phase}:${p.levels.length}`, () => this.render());
  }

  render() {
    const guards = evaluateGuards(this.store.project);
    this.root.innerHTML = '';
    PHASES.forEach((phase, i) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'phase-chip';
      const active = this.store.ui.phase === phase;
      const done = guards[phase].ok && !active;
      const locked = i > 0 && !guards[PHASES[i - 1]].ok;
      chip.dataset.state = active ? 'active' : done ? 'done' : locked ? 'locked' : 'idle';
      chip.innerHTML = `${locked ? '<span class="lock">🔒</span>' : ''}${STRINGS.phases[phase]}`;
      chip.addEventListener('click', () => this.onGoToPhase(phase));
      this.root.appendChild(chip);
    });
  }
}

// === www/js/ui/dialogs.js ===
/** Diálogos modales y presentación de errores con botones "Ir a". */
export function closeDialog() {
  const root = document.getElementById('dialog-root');
  if (!root) return;
  root.hidden = true;
  root.innerHTML = '';
}

export function showDialog({ title, body, actions }) {
  const root = document.getElementById('dialog-root');
  root.hidden = false;
  root.innerHTML = '';
  const card = document.createElement('div');
  card.className = 'dialog-card';
  const h = document.createElement('h2');
  h.textContent = title;
  card.appendChild(h);
  if (typeof body === 'string') {
    const p = document.createElement('p');
    p.textContent = body;
    card.appendChild(p);
  } else if (body) {
    card.appendChild(body);
  }
  const actionsEl = document.createElement('div');
  actionsEl.className = 'dialog-actions';
  for (const a of actions) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = a.kind === 'primary'
      ? 'button-primary'
      : a.kind === 'danger'
        ? 'button-danger'
        : 'button-secondary';
    b.textContent = a.label;
    b.addEventListener('click', () => {
      if (a.onClick) a.onClick();
      if (a.close !== false) closeDialog();
    });
    actionsEl.appendChild(b);
  }
  card.appendChild(actionsEl);
  root.appendChild(card);
  return card;
}

export function confirmDialog(title, message) {
  return new Promise((resolve) => {
    showDialog({
      title,
      body: message,
      actions: [
        { label: 'Cancelar', onClick: () => resolve(false) },
        { label: 'Aceptar', kind: 'danger', onClick: () => resolve(true) },
      ],
    });
  });
}

export function alertDialog(title, message) {
  return new Promise((resolve) => {
    showDialog({
      title,
      body: message,
      actions: [{ label: 'OK', kind: 'primary', onClick: () => resolve(true) }],
    });
  });
}

export function showErrors(errors, { onGoTo } = {}) {
  const body = document.createElement('div');
  const ul = document.createElement('ul');
  ul.style.margin = '0 0 12px';
  ul.style.paddingLeft = '18px';
  for (const err of errors) {
    const li = document.createElement('li');
    li.style.marginBottom = '8px';
    li.textContent = err.message;
    if (onGoTo && err.target) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'button-secondary';
      btn.textContent = 'Ir a';
      btn.style.marginLeft = '8px';
      btn.addEventListener('click', () => {
        closeDialog();
        onGoTo(err.target);
      });
      li.appendChild(btn);
    }
    ul.appendChild(li);
  }
  body.appendChild(ul);
  showDialog({
    title: 'No se puede avanzar',
    body,
    actions: [{ label: 'Cerrar', kind: 'secondary' }],
  });
}

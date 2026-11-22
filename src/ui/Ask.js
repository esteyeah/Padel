// ============================================================================
//  Petite fenêtre de saisie dans la page (remplace prompt()/alert(), bloqués
//  quand le jeu tourne dans un cadre, comme l'aperçu claude.ai).
//  Clavier : Entrée = valider, Échap = annuler. Manette : A = valider, B = annuler.
// ============================================================================
let open = null;

export function isAsking() { return !!open; }

/** Demande un texte. Résout avec la chaîne saisie, ou null si annulé. */
export function ask(label, value = '', { placeholder = '', max = 30 } = {}) {
  close(null);
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'ask';
    el.innerHTML = `<div class="ask-box"><label>${label}</label><input maxlength="${max}" placeholder="${placeholder}" autocomplete="off" spellcheck="false"><div class="ask-btns"><button data-k="no">Annuler</button><button data-k="ok" class="ok">Valider</button></div></div>`;
    document.body.appendChild(el);
    const input = el.querySelector('input');
    input.value = value;
    open = { el, resolve, input };
    el.querySelector('[data-k=ok]').onclick = () => close(input.value);
    el.querySelector('[data-k=no]').onclick = () => close(null);
    input.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') close(input.value); else if (e.key === 'Escape') close(null); });
    setTimeout(() => input.focus(), 30);
  });
}

/** Message bref (remplace alert). */
export function notice(text, ms = 2600) {
  const el = document.createElement('div');
  el.className = 'ask-notice';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
}

function close(v) {
  if (!open) return;
  const o = open; open = null;
  o.el.remove();
  // on rend le focus à la page pour que la manette et le clavier répondent de nouveau
  try { window.focus(); document.getElementById('game')?.focus?.(); } catch { /* ignoré */ }
  o.resolve(v == null ? null : String(v));
}

/** À appeler à chaque image : la manette valide (A) ou annule (B) la saisie. */
export function askPad(input) {
  if (!open) return false;
  if (input.menu.confirm) close(open.input.value);
  else if (input.menu.back) close(null);
  return true;
}

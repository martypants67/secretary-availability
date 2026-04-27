(function () {
  const SCRIPT = document.currentScript;
  const ENDPOINT = (SCRIPT && SCRIPT.dataset.endpoint) || '/api/availability';
  const TARGET_ID = (SCRIPT && SCRIPT.dataset.target) || 'secretary-availability';

  const STYLE = `
    .sa-widget { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1f2937; max-width: 720px; }
    .sa-widget h3 { margin: 0 0 4px 0; font-size: 1.05rem; font-weight: 600; }
    .sa-widget .sa-sub { color: #6b7280; font-size: 0.85rem; margin-bottom: 12px; }
    .sa-widget ul.sa-days { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
    .sa-widget li.sa-day { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; background: #fff; }
    .sa-widget .sa-day-head { font-weight: 600; margin-bottom: 6px; display: flex; justify-content: space-between; }
    .sa-widget .sa-day-head .sa-date { color: #6b7280; font-weight: 400; font-size: 0.85rem; }
    .sa-widget ul.sa-slots { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px; }
    .sa-widget li.sa-slot { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; border-radius: 4px; padding: 2px 6px; font-size: 0.85rem; font-variant-numeric: tabular-nums; }
    .sa-widget li.sa-none { color: #9ca3af; font-size: 0.85rem; font-style: italic; }
    .sa-widget .sa-error { color: #b91c1c; font-size: 0.9rem; }
    .sa-widget .sa-foot { color: #9ca3af; font-size: 0.75rem; margin-top: 10px; }
  `;

  function injectStyle() {
    if (document.getElementById('sa-widget-style')) return;
    const tag = document.createElement('style');
    tag.id = 'sa-widget-style';
    tag.textContent = STYLE;
    document.head.appendChild(tag);
  }

  function render(target, data) {
    const tz = data.timezone;
    const window = `${String(data.workStartHour).padStart(2, '0')}:00–${String(data.workEndHour).padStart(2, '0')}:00`;

    const days = data.days.map((d) => {
      const slots = d.slots.length === 0
        ? '<li class="sa-none">Fully booked</li>'
        : d.slots.map((s) => `<li class="sa-slot">${s.startLabel}–${s.endLabel}</li>`).join('');
      return `
        <li class="sa-day">
          <div class="sa-day-head"><span>${d.weekday}</span><span class="sa-date">${d.dateLabel}</span></div>
          <ul class="sa-slots">${slots}</ul>
        </li>`;
    }).join('');

    target.innerHTML = `
      <div class="sa-widget">
        <h3>When my secretary is free to take your call</h3>
        <div class="sa-sub">Available times shown in ${tz}, working hours ${window}.</div>
        <ul class="sa-days">${days || '<li class="sa-none">No upcoming working days.</li>'}</ul>
        <div class="sa-foot">Updated automatically. Times reflect when she is not in another call or meeting.</div>
      </div>`;
  }

  function renderError(target, message) {
    target.innerHTML = `<div class="sa-widget"><div class="sa-error">${message}</div></div>`;
  }

  function ensureTarget() {
    let el = document.getElementById(TARGET_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = TARGET_ID;
      (SCRIPT && SCRIPT.parentNode ? SCRIPT.parentNode : document.body).insertBefore(el, SCRIPT && SCRIPT.nextSibling);
    }
    return el;
  }

  function load() {
    injectStyle();
    const target = ensureTarget();
    fetch(ENDPOINT, { headers: { Accept: 'application/json' } })
      .then((r) => {
        if (!r.ok) throw new Error('Could not load availability');
        return r.json();
      })
      .then((data) => render(target, data))
      .catch((err) => renderError(target, err.message || 'Could not load availability'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();

export const css = `
.wp {
  --wp-font-family: "Inter";
  --wp-radius: 18px;
  --wp-inset-top: env(safe-area-inset-top, 0px);
  --wp-inset-bottom: env(safe-area-inset-bottom, 0px);
  --wp-background: #05080F;
  --wp-glow: rgba(0, 132, 255, 0.55);
  --wp-glow-2: rgba(77, 176, 255, 0.22);
  --wp-surface: rgba(255, 255, 255, 0.05);
  --wp-surface-strong: rgba(255, 255, 255, 0.1);
  --wp-border: rgba(255, 255, 255, 0.1);
  --wp-border-strong: rgba(255, 255, 255, 0.28);
  --wp-text: #FFFFFF;
  --wp-text-secondary: rgba(226, 234, 248, 0.68);
  --wp-text-tertiary: rgba(226, 234, 248, 0.42);
  --wp-accent: #0084FF;
  --wp-accent-2: #3AA0FF;
  --wp-accent-soft: rgba(0, 132, 255, 0.14);
  --wp-accent-strong: #5CB1FF;
  --wp-accent-ring: rgba(0, 132, 255, 0.24);
  --wp-on-accent: #FFFFFF;
  --wp-badge: #20BF55;
  --wp-on-badge: #FFFFFF;
  --wp-danger: #FF5C75;
  --wp-danger-soft: rgba(255, 92, 117, 0.12);
  --wp-success: #20BF55;
  --wp-field: rgba(255, 255, 255, 0.05);
  --wp-field-border: rgba(255, 255, 255, 0.12);
  --wp-font: var(--wp-font-family), -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;

  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
  overflow-x: hidden;
  background: var(--wp-background);
  color: var(--wp-text);
  font-family: var(--wp-font);
  font-size: 15px;
  line-height: 1.35;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
  color-scheme: dark;
}
.wp[data-theme="light"] { color-scheme: light; }
.wp *, .wp *::before, .wp *::after { box-sizing: border-box; -webkit-tap-highlight-color: rgba(0, 0, 0, 0); }
.wp .is-empty { display: none !important; }
:where(.wp) button { font: inherit; color: inherit; margin: 0; cursor: pointer; }
:where(.wp) a { color: inherit; }

/* glyph = icon painted with currentColor through a mask (any transparent PNG/SVG URL works) */
.wp__glyph {
  display: inline-block;
  flex: 0 0 auto;
  width: 1em;
  height: 1em;
  background-color: currentColor;
  -webkit-mask: var(--wp-icon) center / contain no-repeat;
  mask: var(--wp-icon) center / contain no-repeat;
}

.wp__glow {
  position: absolute;
  z-index: -1;
  top: 0;
  left: 0;
  right: 0;
  height: 560px;
  pointer-events: none;
  background:
    radial-gradient(70% 50% at 50% -6%, var(--wp-glow) 0%, transparent 74%),
    radial-gradient(50% 30% at 92% 4%, var(--wp-glow-2) 0%, transparent 72%);
}

/* ---------- top bar ---------- */
.wp__top {
  display: flex;
  justify-content: flex-end;
  padding: calc(var(--wp-inset-top) + 10px) 16px 0;
}
.wp__close {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--wp-surface-strong);
  color: var(--wp-text-secondary);
  font-size: 13px;
  text-decoration: none;
  transition: transform 0.35s ease;
}

/* ---------- body ---------- */
.wp__body { display: flex; flex-direction: column; }

.wp__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2px 24px 0;
  text-align: center;
}
.wp__app {
  position: relative;
  width: 68px;
  height: 68px;
  margin: 10px 0 20px;
}
.wp__app::before,
.wp__app::after {
  content: "";
  position: absolute;
  border: 1px solid var(--wp-accent-ring);
  pointer-events: none;
}
.wp__app::before { inset: -12px; border-radius: 30px; }
.wp__app::after { inset: -26px; border-radius: 40px; opacity: 0.45; }
.wp__app img {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 20px;
  box-shadow: 0 14px 34px -10px var(--wp-accent), 0 0 0 1px rgba(255, 255, 255, 0.06);
}
.wp__eyebrow {
  display: inline-flex;
  align-items: center;
  margin-bottom: 12px;
  padding: 5px 11px;
  border-radius: 999px;
  background: var(--wp-accent-soft);
  color: var(--wp-accent-strong);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0.09em;
  text-transform: uppercase;
}
.wp__title {
  margin: 0;
  max-width: 340px;
  font-size: 28px;
  font-weight: 800;
  line-height: 1.12;
  letter-spacing: -0.025em;
}
.wp__subtitle {
  margin: 10px 0 0;
  max-width: 320px;
  color: var(--wp-text-secondary);
  font-size: 15px;
  line-height: 1.4;
}

.wp__features {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 352px;
  margin: 24px auto 0;
  padding: 0 28px;
  list-style: none;
}
.wp__feature { display: flex; align-items: center; gap: 12px; }
.wp__feature[data-icon-mode="original"] .wp__glyph,
.wp__feature:not([data-icon-mode="original"]) .wp__feature-icon img { display: none; }
.wp__feature-icon {
  display: grid;
  place-items: center;
  flex: 0 0 32px;
  height: 32px;
  border-radius: 10px;
  background: var(--wp-accent-soft);
  color: var(--wp-accent-strong);
  font-size: 17px;
}
.wp__feature-icon img { width: 18px; height: 18px; }
.wp__feature-body { display: flex; flex-direction: column; min-width: 0; }
.wp__feature-title { font-size: 15px; font-weight: 600; line-height: 1.3; }
.wp__feature-text { color: var(--wp-text-secondary); font-size: 13px; line-height: 1.35; }

/* ---------- plans ---------- */
.wp__plans {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 26px 16px 0;
}
.wp__plan {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 68px;
  padding: 13px 16px;
  border: 1.5px solid var(--wp-border);
  border-radius: var(--wp-radius);
  background: var(--wp-surface);
  cursor: pointer;
  outline: none;
  transition: transform 0.35s ease, border-color 0.35s ease, background-color 0.35s ease, box-shadow 0.35s ease;
}
.wp__plan.is-selected {
  border-color: var(--wp-accent);
  background: var(--wp-accent-soft);
  box-shadow: 0 0 0 4px var(--wp-accent-ring);
}
.wp__plan:focus-visible { box-shadow: 0 0 0 4px var(--wp-accent-ring); }
.wp__radio {
  display: grid;
  place-items: center;
  flex: 0 0 22px;
  height: 22px;
  border: 2px solid var(--wp-border-strong);
  border-radius: 50%;
  color: transparent;
  font-size: 12px;
  transition: background-color 0.35s ease, border-color 0.35s ease, color 0.35s ease;
}
.wp__plan.is-selected .wp__radio {
  border-color: var(--wp-accent);
  background: var(--wp-accent);
  color: var(--wp-on-accent);
}
.wp__plan-main { display: flex; flex: 1 1 auto; flex-direction: column; gap: 3px; min-width: 0; }
.wp__plan-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
}
.wp__plan-trial {
  padding: 3px 7px;
  border-radius: 6px;
  background: var(--wp-surface-strong);
  color: var(--wp-text);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
}
.wp__plan.is-selected .wp__plan-trial { background: var(--wp-accent); color: var(--wp-on-accent); }
.wp__plan-price { color: var(--wp-text-secondary); font-size: 13px; line-height: 1.3; }
.wp__plan-side { display: flex; flex: 0 0 auto; flex-direction: column; align-items: flex-end; text-align: right; }
.wp__plan-unit-price { font-size: 17px; font-weight: 800; line-height: 1.2; letter-spacing: -0.01em; }
.wp__plan-unit-label { color: var(--wp-text-secondary); font-size: 12px; line-height: 1.3; }
.wp__plan-badge {
  position: absolute;
  top: -10px;
  right: 14px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--wp-badge);
  color: var(--wp-on-badge);
  font-size: 10.5px;
  font-weight: 800;
  line-height: 1.3;
  letter-spacing: 0.05em;
  box-shadow: 0 6px 14px -6px var(--wp-badge);
}

/* ---------- footer: summary + payment + legal ---------- */
.wp__footer {
  display: flex;
  flex-direction: column;
  margin-top: auto;
  padding: 0 16px calc(var(--wp-inset-bottom) + 20px);
}
.wp__summary {
  min-height: 18px;
  margin: 14px 8px 0;
  color: var(--wp-text-secondary);
  font-size: 13px;
  line-height: 1.4;
  text-align: center;
}
.wp__pay { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }

.wp__wallet { display: none; flex-direction: column; gap: 10px; }
.wp.has-wallet .wp__wallet { display: flex; }

.wp__applepay {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
  height: 52px;
  padding: 0 16px;
  border: 0;
  border-radius: 14px;
  background: #000000;
  color: #FFFFFF;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", var(--wp-font);
  font-size: 19px;
  font-weight: 500;
  letter-spacing: -0.01em;
  transition: transform 0.35s ease, opacity 0.25s ease;
}
.wp__applepay.is-style-white { background: #FFFFFF; color: #000000; }
.wp__applepay.is-style-white-outline { background: #FFFFFF; color: #000000; box-shadow: inset 0 0 0 1px #000000; }
.wp__applepay-logo { width: 19px; height: 19px; margin: -3px 0 0 3px; fill: currentColor; }
.wp__applepay-pay { font-weight: 600; font-size: 20px; margin-left: -2px; }
@supports (-webkit-appearance: -apple-pay-button) {
  .wp__applepay.is-native { -webkit-appearance: -apple-pay-button; -apple-pay-button-type: plain; -apple-pay-button-style: black; }
  .wp__applepay.is-native.is-type-buy { -apple-pay-button-type: buy; }
  .wp__applepay.is-native.is-type-subscribe { -apple-pay-button-type: subscribe; }
  .wp__applepay.is-native.is-type-continue { -apple-pay-button-type: continue; }
  .wp__applepay.is-native.is-type-check-out { -apple-pay-button-type: check-out; }
  .wp__applepay.is-native.is-type-set-up { -apple-pay-button-type: set-up; }
  .wp__applepay.is-native.is-style-white { -apple-pay-button-style: white; }
  .wp__applepay.is-native.is-style-white-outline { -apple-pay-button-style: white-outline; }
  .wp__applepay.is-native > * { display: none; }
}

.wp__or {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--wp-text-tertiary);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.wp__or::before,
.wp__or::after { content: ""; flex: 1 1 auto; height: 1px; background: var(--wp-border); }

.wp__card-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  height: 50px;
  border: 1.5px solid var(--wp-border);
  border-radius: 14px;
  background: transparent;
  font-size: 16px;
  font-weight: 600;
  transition: transform 0.35s ease, border-color 0.35s ease;
}
.wp__card-toggle .wp__glyph { font-size: 20px; color: var(--wp-text-secondary); }
.wp.is-card-open .wp__card-toggle { display: none; }

.wp__card { display: none; flex-direction: column; gap: 10px; margin: 0; }
.wp.is-card-open .wp__card { display: flex; animation: wp-rise 0.4s ease both; }
.wp__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 4px 0;
  color: var(--wp-text-secondary);
  font-size: 13px;
  font-weight: 600;
}
.wp__brands { display: flex; gap: 4px; }
.wp__brands img { display: block; width: 30px; height: 20px; border-radius: 4px; }

.wp__fields {
  overflow: hidden;
  border: 1.5px solid var(--wp-field-border);
  border-radius: 14px;
  background: var(--wp-field);
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}
.wp__fields.is-focus { border-color: var(--wp-accent); box-shadow: 0 0 0 4px var(--wp-accent-ring); }
.wp__fields.is-invalid { border-color: var(--wp-danger); box-shadow: 0 0 0 4px var(--wp-danger-soft); }
.wp__field {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 50px;
  padding: 0 14px;
  cursor: text;
}
.wp__row { display: flex; border-top: 1px solid var(--wp-field-border); }
.wp__row .wp__field { flex: 1 1 50%; }
.wp__row .wp__field + .wp__field { border-left: 1px solid var(--wp-field-border); }
.wp__control { flex: 1 1 auto; min-width: 0; }
.wp__control input {
  display: block;
  width: 100%;
  height: 24px;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--wp-text);
  font-family: var(--wp-font);
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 0.01em;
  caret-color: var(--wp-accent);
}
.wp__control input::placeholder { color: var(--wp-text-tertiary); opacity: 1; }
.wp__control input:-webkit-autofill { -webkit-text-fill-color: var(--wp-text); transition: background-color 9999s ease 0s; }
.wp__field-brand { width: 30px; height: 20px; border-radius: 4px; }
.wp__field-brand:not([src]), .wp__field-brand[src=""] { visibility: hidden; }

.wp__error {
  display: none;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--wp-danger-soft);
  color: var(--wp-danger);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.35;
}
.wp__error .wp__glyph { margin-top: 1px; font-size: 16px; }
.wp.has-error .wp__error { display: flex; animation: wp-rise 0.3s ease both; }

.wp__cta {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  height: 54px;
  padding: 0 16px;
  border: 0;
  border-radius: 14px;
  background: linear-gradient(180deg, var(--wp-accent-2) 0%, var(--wp-accent) 100%);
  box-shadow: 0 12px 26px -12px var(--wp-accent), inset 0 1px 0 rgba(255, 255, 255, 0.22);
  color: var(--wp-on-accent) !important;
  -webkit-text-fill-color: var(--wp-on-accent);
  font-family: var(--wp-font);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.005em;
  text-decoration: none !important;
  transition: transform 0.35s ease, opacity 0.25s ease;
}
.wp__cta:link, .wp__cta:visited, .wp__cta:active { text-decoration: none !important; }

.wp__spinner {
  display: none;
  width: 20px;
  height: 20px;
  border: 2.5px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: wp-spin 0.8s linear infinite;
}
.wp.is-processing .wp__spinner { display: inline-block; }
.wp.is-processing .wp__applepay > :not(.wp__spinner) { display: none; }
.wp.is-processing .wp__applepay.is-native { opacity: 0.55; }
.wp.is-processing .wp__cta,
.wp.is-processing .wp__applepay,
.wp.is-processing .wp__card-toggle,
.wp.is-processing .wp__plan { pointer-events: none; }
.wp.is-processing .wp__fields { opacity: 0.6; }

.wp__trust {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 2px;
  color: var(--wp-text-tertiary);
  font-size: 12px;
  font-weight: 500;
}
.wp__trust .wp__glyph { font-size: 13px; }

.wp__legal {
  margin: 16px 8px 0;
  color: var(--wp-text-tertiary);
  font-size: 11px;
  line-height: 1.45;
  text-align: center;
}
.wp__legal p { margin: 0; }
.wp__links { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 18px; margin-top: 8px; }
.wp__links a,
.wp__links a:link,
.wp__links a:visited {
  color: var(--wp-text-secondary) !important;
  -webkit-text-fill-color: var(--wp-text-secondary);
  font-size: 12px;
  font-weight: 500;
  text-decoration: none !important;
  white-space: nowrap;
}

/* ---------- success ---------- */
.wp__success {
  position: fixed;
  z-index: 20;
  inset: 0;
  display: flex;
  flex-direction: column;
  padding: calc(var(--wp-inset-top) + 24px) 16px calc(var(--wp-inset-bottom) + 20px);
  background: var(--wp-background);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.45s ease, visibility 0.45s ease;
}
.wp__success::before {
  content: "";
  position: absolute;
  z-index: -1;
  inset: 0;
  background: radial-gradient(240px 240px at 50% 42%, color-mix(in srgb, var(--wp-success) 24%, transparent) 0%, transparent 100%);
}
.wp.is-success .wp__success { opacity: 1; visibility: visible; }
.wp__success-body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  text-align: center;
}
.wp__success-icon {
  display: grid;
  place-items: center;
  width: 88px;
  height: 88px;
  margin-bottom: 32px;
  border-radius: 50%;
  background: var(--wp-success);
  color: #FFFFFF;
  font-size: 40px;
  box-shadow:
    0 0 0 12px color-mix(in srgb, var(--wp-success) 18%, transparent),
    0 0 0 26px color-mix(in srgb, var(--wp-success) 8%, transparent);
  transform: scale(0.6);
  transition: transform 0.6s cubic-bezier(0.2, 1.4, 0.4, 1) 0.1s;
}
.wp.is-success .wp__success-icon { transform: scale(1); }
.wp__success-title { margin: 0; font-size: 26px; font-weight: 800; line-height: 1.15; letter-spacing: -0.02em; }
.wp__success-text { max-width: 300px; margin: 10px 0 0; color: var(--wp-text-secondary); font-size: 15px; line-height: 1.4; }

/* ---------- press & motion ---------- */
.wp .is-press { transform: scale(0.97); }
.wp__plan.is-press { transform: scale(0.98); }

@keyframes wp-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes wp-spin { to { transform: rotate(360deg); } }
.wp__hero, .wp__feature, .wp__plan, .wp__footer { animation: wp-rise 0.55s ease both; }
.wp__hero { animation-delay: 0.02s; }
.wp__feature { animation-delay: calc(0.1s + var(--i, 0) * 0.05s); }
.wp__plan { animation-delay: calc(0.3s + var(--i, 0) * 0.06s); }
.wp__footer { animation-delay: 0.42s; }
@media (prefers-reduced-motion: reduce) {
  .wp *, .wp *::before, .wp *::after { animation: none !important; transition: none !important; }
}
`;

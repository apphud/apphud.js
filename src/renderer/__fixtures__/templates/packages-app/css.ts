export const css = `
.wp {
  --wp-font-family: "Montserrat";
  --wp-radius: 16px;
  --wp-inset-top: env(safe-area-inset-top, 0px);
  --wp-inset-bottom: env(safe-area-inset-bottom, 0px);
  --wp-background: #FFFDFB;
  --wp-surface: #FFFFFF;
  --wp-surface-soft: #FFF4EB;
  --wp-border: #F1E4D8;
  --wp-text: #212121;
  --wp-text-secondary: #5E5A57;
  --wp-text-tertiary: #9C958F;
  --wp-accent: #FB6514;
  --wp-accent-soft: rgba(251, 101, 20, 0.1);
  --wp-accent-ring: rgba(251, 101, 20, 0.18);
  --wp-on-accent: #FFFFFF;
  --wp-button: #12B76A;
  --wp-on-button: #FFFFFF;
  --wp-star: #FFB21E;
  --wp-danger: #E5344F;
  --wp-danger-soft: rgba(229, 52, 79, 0.08);
  --wp-field: #FFFFFF;
  --wp-field-border: #E4DCD4;
  --wp-font: var(--wp-font-family), -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;

  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
  overflow-x: clip;
  background: var(--wp-background);
  color: var(--wp-text);
  font-family: var(--wp-font);
  font-size: 14px;
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  -webkit-text-size-adjust: 100%;
  -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
  color-scheme: light;
}
.wp[data-theme="dark"] { color-scheme: dark; }
.wp *, .wp *::before, .wp *::after { box-sizing: border-box; -webkit-tap-highlight-color: rgba(0, 0, 0, 0); }
.wp .is-empty { display: none !important; }
:where(.wp) button { font: inherit; color: inherit; margin: 0; cursor: pointer; }
:where(.wp) a { color: inherit; }

.wp__glyph {
  display: inline-block;
  flex: 0 0 auto;
  width: 1em;
  height: 1em;
  background-color: currentColor;
  -webkit-mask: var(--wp-icon) center / contain no-repeat;
  mask: var(--wp-icon) center / contain no-repeat;
}

/* ---------- sticky offer bar ---------- */
.wp__bar {
  position: sticky;
  z-index: 10;
  top: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: calc(var(--wp-inset-top) + 8px) 16px 10px;
  border-bottom: 1px solid var(--wp-border);
  background: color-mix(in srgb, var(--wp-background) 92%, transparent);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
}
.wp__timer { flex: 1 1 auto; display: flex; flex-direction: column; min-width: 0; }
.wp__timer span { color: var(--wp-text-secondary); font-size: 12px; font-weight: 600; }
.wp__timer b { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
.wp__bar-cta {
  flex: 0 0 auto;
  padding: 12px 18px;
  border: 0;
  border-radius: 12px;
  background: var(--wp-accent);
  color: var(--wp-on-accent);
  font-size: 14px;
  font-weight: 700;
  transition: transform 0.35s ease;
}

.wp__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 440px;
  margin: 0 auto;
  padding: 18px 16px calc(var(--wp-inset-bottom) + 28px);
}

/* ---------- hero ---------- */
.wp__logo { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 22px; font-weight: 800; letter-spacing: -0.01em; }
.wp__logo img { width: 32px; height: 32px; border-radius: 8px; }
.wp__logo em { padding: 3px 8px; border-radius: 8px; background: var(--wp-accent); color: var(--wp-on-accent); font-size: 12px; font-style: normal; font-weight: 800; letter-spacing: 0.04em; }
.wp__hero { text-align: center; }
.wp__title { margin: 0; font-size: 26px; font-weight: 800; line-height: 1.2; letter-spacing: -0.01em; }
.wp__subtitle { display: block; margin-top: 2px; color: var(--wp-accent); font-size: 26px; font-weight: 800; line-height: 1.2; }

.wp__card-box { padding: 16px; border: 1px solid var(--wp-border); border-radius: var(--wp-radius); background: var(--wp-surface); }
.wp__features { display: flex; flex-direction: column; gap: 12px; margin: 0; padding: 0; list-style: none; }
.wp__feature { display: flex; align-items: center; gap: 12px; font-size: 15px; font-weight: 600; }
.wp__feature-icon { display: grid; flex: 0 0 28px; place-items: center; width: 28px; height: 28px; border-radius: 50%; background: var(--wp-accent-soft); color: var(--wp-accent); font-size: 14px; }

/* ---------- plans ---------- */
.wp__plans { display: flex; flex-direction: column; gap: 10px; }
.wp__plan {
  overflow: hidden;
  border: 2px solid var(--wp-border);
  border-radius: var(--wp-radius);
  background: var(--wp-surface);
  cursor: pointer;
  outline: none;
  transition: transform 0.35s ease, border-color 0.25s ease, box-shadow 0.25s ease;
}
.wp__plan.is-selected { border-color: var(--wp-accent); box-shadow: 0 8px 24px -12px var(--wp-accent); }
.wp__plan:focus-visible { box-shadow: 0 0 0 3px var(--wp-accent-ring); }
.wp__plan-head { padding: 7px 12px; background: var(--wp-border); color: var(--wp-text-secondary); font-size: 13px; font-weight: 800; letter-spacing: 0.02em; text-align: center; text-transform: uppercase; transition: background 0.25s ease, color 0.25s ease; }
.wp__plan.is-selected .wp__plan-head { background: var(--wp-accent); color: var(--wp-on-accent); }
.wp__plan-main { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
.wp__radio { flex: 0 0 22px; width: 22px; height: 22px; border: 2px solid var(--wp-field-border); border-radius: 50%; background: var(--wp-surface); transition: border 0.25s ease; }
.wp__plan.is-selected .wp__radio { border: 7px solid var(--wp-accent); }
.wp__plan-info { display: flex; flex: 1 1 auto; flex-direction: column; gap: 6px; min-width: 0; }
.wp__plan-name { font-size: 16px; font-weight: 800; }
.wp__plan-prices { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; }
.wp__plan-prices s { color: var(--wp-text-tertiary); font-size: 13px; font-weight: 600; }
.wp__plan-prices b { font-size: 15px; font-weight: 800; }
.wp__plan-badge { align-self: flex-start; padding: 3px 8px; border-radius: 6px; background: var(--wp-accent-soft); color: var(--wp-accent); font-size: 11px; font-weight: 800; white-space: nowrap; }
.wp__plan-side { display: flex; flex: 0 0 auto; flex-direction: column; align-items: flex-end; padding: 8px 10px; border-radius: 12px; background: var(--wp-surface-soft); }
.wp__plan-side b { font-size: 20px; font-weight: 800; line-height: 1.1; white-space: nowrap; }
.wp__plan-side span { color: var(--wp-text-secondary); font-size: 11px; font-weight: 600; }

.wp__guarantee-line { display: flex; align-items: center; justify-content: center; gap: 6px; color: var(--wp-text-secondary); font-size: 13px; font-weight: 600; }
.wp__guarantee-line .wp__glyph { color: var(--wp-button); font-size: 16px; }

/* ---------- payment ---------- */
.wp__section-title { margin: 6px 0 0; font-size: 18px; font-weight: 800; }
.wp__methods { display: grid; grid-template-columns: 1fr; gap: 10px; }
.wp.has-wallet .wp__methods { grid-template-columns: 1fr 1fr; }
.wp__method {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 56px;
  border: 2px solid var(--wp-border);
  border-radius: 14px;
  background: var(--wp-surface);
  font-size: 15px;
  font-weight: 700;
  transition: transform 0.35s ease, border-color 0.25s ease, background 0.25s ease;
}
.wp__method .wp__glyph { font-size: 20px; }
.wp__method--wallet { display: none; }
.wp.has-wallet .wp__method--wallet { display: flex; }
.wp.is-card-open .wp__method--card,
.wp.has-wallet:not(.is-card-open) .wp__method--wallet { border-color: var(--wp-accent); background: var(--wp-accent-soft); }

.wp__pay { display: flex; flex-direction: column; gap: 12px; }
.wp__pane { display: none; flex-direction: column; gap: 12px; }
.wp.is-card-open .wp__pane--card,
.wp.has-wallet:not(.is-card-open) .wp__pane--wallet { display: flex; animation: wp-rise 0.35s ease both; }
.wp__card { display: flex; flex-direction: column; gap: 12px; margin: 0; }
.wp__card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; font-weight: 700; }
.wp__brands { display: flex; gap: 4px; }
.wp__brands img { display: block; width: 28px; height: 19px; border-radius: 4px; }

.wp__fields {
  overflow: hidden;
  border: 1.5px solid var(--wp-field-border);
  border-radius: 12px;
  background: var(--wp-field);
  transition: border-color 0.25s ease, box-shadow 0.25s ease;
}
.wp__fields.is-focus { border-color: var(--wp-accent); box-shadow: 0 0 0 3px var(--wp-accent-ring); }
.wp__fields.is-invalid { border-color: var(--wp-danger); box-shadow: 0 0 0 3px var(--wp-danger-soft); }
.wp__field { display: flex; align-items: center; gap: 10px; height: 50px; padding: 0 14px; cursor: text; }
.wp__row { display: flex; border-top: 1.5px solid var(--wp-field-border); }
.wp__row .wp__field { flex: 1 1 50%; }
.wp__row .wp__field + .wp__field { border-left: 1.5px solid var(--wp-field-border); }
.wp__control { flex: 1 1 auto; min-width: 0; }
.wp__control input {
  display: block;
  width: 100%;
  height: 22px;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--wp-text);
  font-family: var(--wp-font);
  font-size: 16px;
  font-weight: 600;
  caret-color: var(--wp-accent);
}
.wp__control input::placeholder { color: var(--wp-text-tertiary); opacity: 1; }
.wp__field-brand { width: 28px; height: 19px; border-radius: 4px; }
.wp__field-brand:not([src]), .wp__field-brand[src=""] { visibility: hidden; }

.wp__error {
  display: none;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--wp-danger-soft);
  color: var(--wp-danger);
  font-size: 13px;
  font-weight: 600;
}
.wp__error .wp__glyph { margin-top: 1px; font-size: 16px; }
.wp.has-error .wp__error { display: flex; animation: wp-rise 0.3s ease both; }

.wp__cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  height: 56px;
  padding: 0 16px;
  border: 0;
  border-radius: 14px;
  background: var(--wp-button);
  color: var(--wp-on-button) !important;
  -webkit-text-fill-color: var(--wp-on-button);
  font-family: var(--wp-font);
  font-size: 17px;
  font-weight: 800;
  text-decoration: none !important;
  box-shadow: 0 10px 24px -12px var(--wp-button);
  transition: transform 0.35s ease, opacity 0.25s ease;
}

.wp__applepay {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  width: 100%;
  height: 56px;
  padding: 0 16px;
  border: 0;
  border-radius: 14px;
  background: #000000;
  color: #FFFFFF;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", var(--wp-font);
  font-size: 19px;
  font-weight: 500;
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

.wp__spinner {
  display: none;
  width: 18px;
  height: 18px;
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
.wp.is-processing .wp__method,
.wp.is-processing .wp__plan { pointer-events: none; }
.wp.is-processing .wp__fields { opacity: 0.6; }

.wp__summary { margin: 0; color: var(--wp-text-secondary); font-size: 12.5px; line-height: 1.45; text-align: center; }
.wp__trust { display: flex; align-items: center; justify-content: center; gap: 6px; color: var(--wp-text-tertiary); font-size: 12px; font-weight: 600; }
.wp__trust .wp__glyph { font-size: 14px; }

/* ---------- reviews ---------- */
.wp__reviews { display: flex; flex-direction: column; gap: 10px; }
.wp__review { padding: 14px 16px; border: 1px solid var(--wp-border); border-radius: var(--wp-radius); background: var(--wp-surface); }
.wp__stars { display: flex; gap: 2px; color: var(--wp-star); font-size: 15px; }
.wp__review-title { display: block; margin-top: 8px; font-size: 14px; font-weight: 800; }
.wp__review-text { margin: 4px 0 0; color: var(--wp-text-secondary); font-size: 13px; line-height: 1.45; }
.wp__review-author { display: block; margin-top: 8px; color: var(--wp-text-tertiary); font-size: 12px; font-weight: 700; }

/* ---------- guarantee ---------- */
.wp__guarantee { position: relative; display: flex; flex-direction: column; align-items: center; padding: 0 0 4px; text-align: center; }
.wp__guarantee img { position: relative; z-index: 1; width: 132px; height: 132px; margin-bottom: -18px; object-fit: contain; }
.wp__guarantee-box { width: 100%; padding: 30px 18px 18px; border: 2px dashed var(--wp-accent); border-radius: var(--wp-radius); background: var(--wp-surface-soft); }
.wp__guarantee-box h2 { margin: 0; font-size: 18px; font-weight: 800; }
.wp__guarantee-box p { margin: 8px 0 0; color: var(--wp-text-secondary); font-size: 13px; line-height: 1.5; }

.wp__legal { margin: 0 4px; color: var(--wp-text-tertiary); font-size: 11px; line-height: 1.5; text-align: center; }
.wp__legal p { margin: 0; }
.wp__links { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px 18px; margin-top: 8px; }
.wp__links a,
.wp__links a:link,
.wp__links a:visited {
  color: var(--wp-text-secondary) !important;
  -webkit-text-fill-color: var(--wp-text-secondary);
  font-size: 12px;
  font-weight: 600;
  text-decoration: underline !important;
  text-underline-offset: 2px;
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
.wp.is-success .wp__success { opacity: 1; visibility: visible; }
.wp__success-body { display: flex; flex: 1 1 auto; flex-direction: column; align-items: center; justify-content: center; padding: 0 16px; text-align: center; }
.wp__success-body img { width: 150px; height: 150px; margin-bottom: 18px; object-fit: contain; transform: scale(0.7); transition: transform 0.6s cubic-bezier(0.2, 1.4, 0.4, 1) 0.1s; }
.wp.is-success .wp__success-body img { transform: scale(1); }
.wp__success-title { margin: 0; font-size: 24px; font-weight: 800; line-height: 1.2; }
.wp__success-text { max-width: 300px; margin: 10px 0 0; color: var(--wp-text-secondary); font-size: 15px; line-height: 1.45; }

/* ---------- press & motion ---------- */
.wp .is-press { transform: scale(0.98); }
@keyframes wp-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes wp-spin { to { transform: rotate(360deg); } }
.wp__hero, .wp__card-box, .wp__plans, .wp__methods { animation: wp-rise 0.5s ease both; }
.wp__card-box { animation-delay: 0.05s; }
.wp__plans { animation-delay: 0.1s; }
.wp__methods { animation-delay: 0.16s; }
@media (prefers-reduced-motion: reduce) {
  .wp *, .wp *::before, .wp *::after { animation: none !important; transition: none !important; }
}
`;

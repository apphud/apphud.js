export const html = `
  <header class="wp__top">
    <div class="wp__brand">
      <img data-bind-src="header.app_icon" alt="">
      <span data-bind="header.brand"></span>
    </div>
    <a class="wp__close" data-bind-href="dismiss_button.url" aria-label="Close" data-press>
      <i class="wp__glyph" data-bind-icon="dismiss_button.icon"></i>
    </a>
  </header>

  <main class="wp__body">
    <h1 class="wp__title" data-bind="title.text"></h1>

    <div class="wp__plans" data-list="plans" data-hide-single role="radiogroup">
      <template>
        <div class="wp__plan" role="radio" tabindex="0" data-press>
          <span class="wp__radio"></span>
          <span class="wp__plan-name" data-item-bind="name"></span>
          <span class="wp__plan-badge" data-item-bind="badge"></span>
          <span class="wp__plan-total" data-item-bind="total"></span>
        </div>
      </template>
    </div>

    <section class="wp__offer">
      <img class="wp__offer-hero" data-bind-src="offer.image" alt="">
      <div class="wp__offer-rows">
        <div class="wp__offer-row">
          <span data-plan-bind="title"></span>
          <span data-plan-bind="price"></span>
        </div>
        <div class="wp__offer-row">
          <span data-plan-bind="discount_title"></span>
          <span class="is-accent" data-plan-bind="discount"></span>
        </div>
        <div class="wp__offer-total">
          <span data-bind="offer.total_title"></span>
          <span class="wp__offer-sum">
            <s data-plan-bind="old_total"></s>
            <b data-plan-bind="total"></b>
          </span>
        </div>
        <p class="wp__offer-note" data-plan-bind="summary"></p>
      </div>
    </section>

    <section class="wp__methods">
      <div class="wp__method wp__method--card">
        <button type="button" class="wp__method-head" data-action="open-card" data-press>
          <span class="wp__radio"></span>
          <span class="wp__method-title" data-bind="payment.card_title"></span>
          <span class="wp__brands" id="wp-brands"></span>
        </button>
        <div class="wp__method-body">
          <form class="wp__card" id="wp-card" novalidate>
            <div class="wp__fields" id="wp-fields">
              <div class="wp__field">
                <div class="wp__control" id="wp-card-number"></div>
                <img class="wp__field-brand" id="wp-card-brand" alt="">
              </div>
              <div class="wp__row">
                <div class="wp__field"><div class="wp__control" id="wp-card-expiry"></div></div>
                <div class="wp__field"><div class="wp__control" id="wp-card-cvc"></div></div>
              </div>
            </div>
            <div class="wp__error" id="wp-error" role="alert">
              <i class="wp__glyph" data-bind-icon="errors.icon"></i>
              <span id="wp-error-text"></span>
            </div>
            <button type="submit" class="wp__cta" id="wp-cta" data-press>
              <span id="wp-cta-label" data-bind="payment.card_button"></span>
              <span class="wp__spinner"></span>
            </button>
          </form>
        </div>
      </div>

      <div class="wp__method wp__method--wallet">
        <button type="button" class="wp__method-head" data-action="open-wallet" data-press>
          <span class="wp__radio"></span>
          <span class="wp__method-title" data-bind="payment.wallet_title"></span>
          <i class="wp__glyph" data-bind-icon="payment.wallet_icon"></i>
        </button>
        <div class="wp__method-body">
          <button type="button" class="wp__applepay" id="wp-applepay" data-press>
            <span class="wp__applepay-label" id="wp-applepay-label"></span>
            <svg class="wp__applepay-logo" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>
            <span class="wp__applepay-pay">Pay</span>
            <span class="wp__spinner"></span>
          </button>
        </div>
      </div>
    </section>

    <div class="wp__trust">
      <i class="wp__glyph" data-bind-icon="trust.icon"></i>
      <span data-bind="trust.text"></span>
    </div>

    <div class="wp__legal">
      <p data-bind="information.legal"></p>
      <nav class="wp__links">
        <a data-bind-href="information.terms_url" data-bind="information.terms_title" target="_blank" rel="noopener"></a>
        <a data-bind-href="information.privacy_url" data-bind="information.privacy_title" target="_blank" rel="noopener"></a>
      </nav>
    </div>
  </main>

  <section class="wp__success" aria-live="polite">
    <div class="wp__success-body">
      <div class="wp__success-icon"><i class="wp__glyph" data-bind-icon="success.icon"></i></div>
      <h2 class="wp__success-title" data-bind="success.title"></h2>
      <p class="wp__success-text" data-bind="success.text"></p>
    </div>
    <a class="wp__cta" data-bind-href="success.button_url" data-press><span data-bind="success.button"></span></a>
  </section>
`;

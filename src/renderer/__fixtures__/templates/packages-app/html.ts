export const html = `
  <header class="wp__bar">
    <div class="wp__timer">
      <span data-bind="timer.title"></span>
      <b data-countdown></b>
    </div>
    <button type="button" class="wp__bar-cta" data-action="scroll-to-pay" data-press><span data-bind="timer.button"></span></button>
  </header>

  <main class="wp__body">
    <div class="wp__logo">
      <img data-bind-src="header.app_icon" alt="">
      <span data-bind="header.brand"></span>
      <em data-bind="header.chip"></em>
    </div>

    <section class="wp__hero">
      <h1 class="wp__title" data-bind="title.text"></h1>
      <span class="wp__subtitle" data-bind="subtitle.text"></span>
    </section>

    <div class="wp__card-box">
      <ul class="wp__features" data-list="features">
        <template>
          <li class="wp__feature">
            <span class="wp__feature-icon"><i class="wp__glyph" data-item-icon="icon"></i></span>
            <span data-item-bind="title"></span>
          </li>
        </template>
      </ul>
    </div>

    <div class="wp__plans" data-list="plans" role="radiogroup">
      <template>
        <div class="wp__plan" role="radio" tabindex="0" data-press>
          <div class="wp__plan-head" data-item-bind="header"></div>
          <div class="wp__plan-main">
            <span class="wp__radio"></span>
            <span class="wp__plan-info">
              <span class="wp__plan-name" data-item-bind="title"></span>
              <span class="wp__plan-badge" data-item-bind="badge"></span>
              <span class="wp__plan-prices">
                <s data-item-bind="old_price"></s>
                <b data-item-bind="price"></b>
              </span>
            </span>
            <span class="wp__plan-side">
              <b data-item-bind="unit_price"></b>
              <span data-item-bind="unit_label"></span>
            </span>
          </div>
        </div>
      </template>
    </div>

    <div class="wp__guarantee-line">
      <i class="wp__glyph" data-bind-icon="guarantee.icon"></i>
      <span data-bind="guarantee.line"></span>
    </div>

    <h2 class="wp__section-title" data-bind="payment.title"></h2>
    <div class="wp__methods">
      <button type="button" class="wp__method wp__method--card" data-action="open-card" data-press>
        <i class="wp__glyph" data-bind-icon="payment.card_icon"></i>
        <span data-bind="payment.card_title"></span>
      </button>
      <button type="button" class="wp__method wp__method--wallet" data-action="open-wallet" data-press>
        <i class="wp__glyph" data-bind-icon="payment.wallet_icon"></i>
        <span data-bind="payment.wallet_title"></span>
      </button>
    </div>

    <div class="wp__pane wp__pane--card">
      <form class="wp__card" id="wp-card" novalidate>
        <div class="wp__card-head">
          <span data-bind="payment.card_details"></span>
          <span class="wp__brands" id="wp-brands"></span>
        </div>
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
          <span id="wp-cta-label" data-plan-bind="cta"></span>
          <span class="wp__spinner"></span>
        </button>
      </form>
    </div>

    <div class="wp__pane wp__pane--wallet">
      <button type="button" class="wp__applepay" id="wp-applepay" data-press>
        <span class="wp__applepay-label" id="wp-applepay-label"></span>
        <svg class="wp__applepay-logo" viewBox="0 0 24 24" aria-hidden="true"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>
        <span class="wp__applepay-pay">Pay</span>
        <span class="wp__spinner"></span>
      </button>
    </div>

    <p class="wp__summary" data-plan-bind="summary"></p>
    <div class="wp__trust">
      <i class="wp__glyph" data-bind-icon="trust.icon"></i>
      <span data-bind="trust.text"></span>
    </div>

    <h2 class="wp__section-title" data-bind="reviews_settings.title"></h2>
    <div class="wp__reviews" data-list="reviews">
      <template>
        <article class="wp__review">
          <div class="wp__stars">
            <i class="wp__glyph" data-bind-icon="reviews_settings.star_icon"></i><i class="wp__glyph" data-bind-icon="reviews_settings.star_icon"></i><i class="wp__glyph" data-bind-icon="reviews_settings.star_icon"></i><i class="wp__glyph" data-bind-icon="reviews_settings.star_icon"></i><i class="wp__glyph" data-bind-icon="reviews_settings.star_icon"></i>
          </div>
          <span class="wp__review-title" data-item-bind="title"></span>
          <p class="wp__review-text" data-item-bind="text"></p>
          <span class="wp__review-author" data-item-bind="author"></span>
        </article>
      </template>
    </div>

    <section class="wp__guarantee">
      <img data-bind-src="guarantee.image" alt="">
      <div class="wp__guarantee-box">
        <h2 data-bind="guarantee.title"></h2>
        <p data-bind="guarantee.text"></p>
      </div>
    </section>

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
      <img data-bind-src="success.image" alt="">
      <h2 class="wp__success-title" data-bind="success.title"></h2>
      <p class="wp__success-text" data-bind="success.text"></p>
    </div>
    <a class="wp__cta" data-bind-href="success.button_url" data-press><span data-bind="success.button"></span></a>
  </section>
`;

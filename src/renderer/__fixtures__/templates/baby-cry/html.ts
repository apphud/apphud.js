export const html = `
  <header class="wp__top">
    <div class="wp__brand">
      <img data-bind-src="header.app_icon" alt="">
      <span data-bind="header.brand"></span>
    </div>
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
      <div class="wp__checkout" data-checkout></div>
      <div class="wp__error" id="wp-error" role="alert">
        <i class="wp__glyph" data-bind-icon="errors.icon"></i>
        <span id="wp-error-text"></span>
      </div>
      <button type="button" class="wp__cta" id="wp-cta" data-press>
        <span id="wp-cta-label" data-bind="payment.card_button"></span>
        <span class="wp__spinner"></span>
      </button>
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

`;

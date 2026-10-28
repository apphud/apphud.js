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
    <section class="wp__pay">
      <div class="wp__checkout" data-checkout></div>
      <div class="wp__error" id="wp-error" role="alert">
        <i class="wp__glyph" data-bind-icon="errors.icon"></i>
        <span id="wp-error-text"></span>
      </div>
      <button type="button" class="wp__cta" id="wp-cta" data-press>
        <span id="wp-cta-label" data-plan-bind="cta"></span>
        <span class="wp__spinner"></span>
      </button>
    </section>

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

`;

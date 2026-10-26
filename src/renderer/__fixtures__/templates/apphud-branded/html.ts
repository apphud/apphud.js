export const html = `
  <div class="wp__glow" aria-hidden="true"></div>

  <main class="wp__body">
    <section class="wp__hero">
      <div class="wp__app"><img data-bind-src="header.app_icon" alt=""></div>
      <span class="wp__eyebrow" data-bind="header.eyebrow"></span>
      <h1 class="wp__title" data-bind="title.text"></h1>
      <p class="wp__subtitle" data-bind="subtitle.text"></p>
    </section>

    <ul class="wp__features" data-list="features">
      <template>
        <li class="wp__feature">
          <span class="wp__feature-icon">
            <img data-item-src="icon" alt="">
            <i class="wp__glyph" data-item-icon="icon"></i>
          </span>
          <span class="wp__feature-body">
            <span class="wp__feature-title" data-item-bind="title"></span>
            <span class="wp__feature-text" data-item-bind="text"></span>
          </span>
        </li>
      </template>
    </ul>

    <div class="wp__plans" data-list="plans" role="radiogroup">
      <template>
        <div class="wp__plan" role="radio" tabindex="0" data-press>
          <span class="wp__plan-badge" data-item-bind="badge"></span>
          <span class="wp__radio"><i class="wp__glyph" data-bind-icon="plans_settings.check_icon"></i></span>
          <span class="wp__plan-main">
            <span class="wp__plan-title">
              <span data-item-bind="title"></span>
              <span class="wp__plan-trial" data-item-bind="trial"></span>
            </span>
            <span class="wp__plan-price" data-item-bind="price"></span>
          </span>
          <span class="wp__plan-side">
            <span class="wp__plan-unit-price" data-item-bind="unit_price"></span>
            <span class="wp__plan-unit-label" data-item-bind="unit_label"></span>
          </span>
        </div>
      </template>
    </div>
  </main>

  <footer class="wp__footer">
    <p class="wp__summary" data-plan-bind="summary"></p>

    <div class="wp__pay">
      <div class="wp__checkout" data-checkout></div>
      <div class="wp__error" id="wp-error" role="alert">
        <i class="wp__glyph" data-bind-icon="errors.icon"></i>
        <span id="wp-error-text"></span>
      </div>
      <button type="button" class="wp__cta" id="wp-cta" data-press>
        <span id="wp-cta-label" data-plan-bind="cta"></span>
        <span class="wp__spinner"></span>
      </button>

      <div class="wp__trust">
        <i class="wp__glyph" data-bind-icon="trust.icon"></i>
        <span data-bind="trust.text"></span>
      </div>
    </div>

    <div class="wp__legal">
      <p data-bind="information.legal"></p>
      <nav class="wp__links">
        <a data-bind-href="information.terms_url" data-bind="information.terms_title" target="_blank" rel="noopener"></a>
        <a data-bind-href="information.privacy_url" data-bind="information.privacy_title" target="_blank" rel="noopener"></a>
      </nav>
    </div>
  </footer>
`;

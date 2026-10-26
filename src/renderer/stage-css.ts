// Shadow-root chrome around the template CSS. `:host { all: initial }` cuts the
// app's inherited font/color.
export const STAGE_CSS = `
:host { all: initial; display: block; container-type: inline-size; }
#wp-root { min-height: 100%; }
`;

// Builder only: fixed insets stand in for the device safe area (env() is 0 on
// desktop). The hosted page keeps the template's env() insets.
export const DEVICE_INSETS_CSS = `
#wp-root { --wp-inset-top: 47px; --wp-inset-bottom: 26px; }
`;

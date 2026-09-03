export * from './types'
export * from './core'

import Apphud from "./core";

const apphud = new Apphud();

// Funnel pages and Kit call `apphud.init()` on the UMD global. Named runtime
// exports (e.g. a class) make Rollup put a namespace on window.apphud instead
// of the SDK instance — overwrite that so init/getUserID stay functions.
(window as any).apphud = apphud
;(window as any).ApphudSDK = apphud

export default apphud;

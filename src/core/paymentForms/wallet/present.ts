import {
    BeginPresentApplePayOptions,
    BeginPresentApplePayResult,
    PaymentRequestLike,
    PresentApplePayResult,
} from "./types"

export const APPLE_PAY_SHEET_TIMEOUT_MS = 1000

type ApplePaySessionStatic = {
    openPaymentSetup?: (merchantIdentifier: string) => Promise<boolean>
}

function getApplePaySession(): ApplePaySessionStatic | undefined {
    if (typeof window === "undefined") {
        return undefined
    }

    return (window as Window & { ApplePaySession?: ApplePaySessionStatic }).ApplePaySession
}

function isSheetShowing(paymentRequest: PaymentRequestLike): boolean {
    if (typeof paymentRequest.isShowing !== "function") {
        return false
    }

    try {
        return paymentRequest.isShowing() === true
    } catch {
        return false
    }
}

function tryShowPaymentRequest(
    paymentRequest: PaymentRequestLike,
    stripeCanMakePayment?: boolean
): boolean {
    // Stripe throws IntegrationError if show() runs after canMakePayment() === false.
    if (stripeCanMakePayment === false) {
        return false
    }

    try {
        paymentRequest.show()

        if (typeof paymentRequest.isShowing === "function") {
            return isSheetShowing(paymentRequest)
        }

        // Stripe may not expose isShowing immediately; treat a non-throwing show as success.
        return true
    } catch {
        return false
    }
}

function startPaymentSetup(merchantIdentifier?: string): Promise<boolean> | null {
    const ApplePaySession = getApplePaySession()

    if (!merchantIdentifier || typeof ApplePaySession?.openPaymentSetup !== "function") {
        return null
    }

    try {
        return ApplePaySession.openPaymentSetup(merchantIdentifier)
            .then((success) => !!success)
            .catch(() => false)
    } catch {
        return null
    }
}

/**
 * Must run inside the user-gesture click handler. Calls show() (and setup if needed)
 * before any await so iOS Safari does not drop the sheet.
 */
export function beginPresentApplePay(
    options: BeginPresentApplePayOptions
): BeginPresentApplePayResult {
    const shown = tryShowPaymentRequest(
        options.paymentRequest,
        options.stripeCanMakePayment
    )
    let setupStarted = false
    let setupPromise: Promise<boolean> | null = null

    if (!shown && options.status !== "unsupported") {
        setupPromise = startPaymentSetup(options.merchantIdentifier)
        setupStarted = setupPromise !== null
    }

    return { shown, setupStarted, setupPromise }
}

export async function watchApplePaySheet(
    paymentRequest: PaymentRequestLike,
    isActive: () => boolean,
    timeoutMs: number = APPLE_PAY_SHEET_TIMEOUT_MS
): Promise<boolean> {
    if (typeof paymentRequest.isShowing !== "function") {
        return true
    }

    const startedAt = Date.now()

    while (Date.now() - startedAt < timeoutMs) {
        if (!isActive()) {
            return false
        }

        if (isSheetShowing(paymentRequest)) {
            return true
        }

        await new Promise((resolve) => setTimeout(resolve, 50))
    }

    return isActive() && isSheetShowing(paymentRequest)
}

export async function completePresentApplePay(
    beginResult: BeginPresentApplePayResult,
    paymentRequest: PaymentRequestLike,
    isActive: () => boolean,
    timeoutMs: number = APPLE_PAY_SHEET_TIMEOUT_MS
): Promise<PresentApplePayResult> {
    if (beginResult.shown) {
        const stillShowing = await watchApplePaySheet(paymentRequest, isActive, timeoutMs)
        return stillShowing ? "shown" : "failed"
    }

    if (beginResult.setupPromise) {
        const setupOk = await beginResult.setupPromise
        if (setupOk) {
            return "setup"
        }
    }

    if (beginResult.setupStarted) {
        return "setup"
    }

    return "failed"
}

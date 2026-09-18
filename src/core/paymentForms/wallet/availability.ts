import { ApplePayStatus } from "./types"

type ApplePaySessionStatic = {
    canMakePayments?: () => boolean
}

function getApplePaySession(): ApplePaySessionStatic | undefined {
    if (typeof window === "undefined") {
        return undefined
    }

    return (window as Window & { ApplePaySession?: ApplePaySessionStatic }).ApplePaySession
}

/**
 * Device/browser can present Apple Pay. Does not mean Wallet has a card.
 */
export function isApplePayDeviceSupported(): boolean {
    try {
        const ApplePaySession = getApplePaySession()
        if (!ApplePaySession || typeof ApplePaySession.canMakePayments !== "function") {
            return false
        }

        return ApplePaySession.canMakePayments() === true
    } catch {
        return false
    }
}

/**
 * unsupported: Apple Pay cannot be used for checkout on this page.
 *   - Device/browser has no ApplePaySession (Chrome, Windows, …), or
 *   - Stripe PaymentRequest.canMakePayment() is false (this Safari
 *     profile will not open the sheet).
 * ready: device can use Apple Pay and Stripe can present it.
 */
export function resolveApplePayStatus(
    stripeCanMakePayment?: boolean
): { status: ApplePayStatus; deviceSupported: boolean } {
    const deviceSupported = isApplePayDeviceSupported()

    if (!deviceSupported) {
        return { status: "unsupported", deviceSupported: false }
    }

    if (stripeCanMakePayment === false) {
        return { status: "unsupported", deviceSupported: true }
    }

    return { status: "ready", deviceSupported: true }
}

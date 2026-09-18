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
 * Resolve wallet status. Safari cannot reliably tell “has a card” from
 * “device can use Apple Pay”, so this is only unsupported vs ready.
 */
export function resolveApplePayStatus(): { status: ApplePayStatus; deviceSupported: boolean } {
    const deviceSupported = isApplePayDeviceSupported()

    if (!deviceSupported) {
        return { status: "unsupported", deviceSupported: false }
    }

    return { status: "ready", deviceSupported: true }
}

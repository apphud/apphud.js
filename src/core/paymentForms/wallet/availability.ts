import { ApplePayStatus } from "./types"

type ApplePaySessionStatic = {
    canMakePayments?: () => boolean
    applePayCapabilities?: (merchantIdentifier: string) => Promise<{
        paymentCredentialStatus?: string
    }>
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

type CanMakePaymentResult = { applePay?: boolean } | null | undefined

/**
 * Resolve wallet status: unsupported vs needs a Wallet card vs ready to pay.
 */
export async function resolveApplePayStatus(
    canMakePayment: () => Promise<CanMakePaymentResult>,
    merchantIdentifier?: string
): Promise<{ status: ApplePayStatus; deviceSupported: boolean }> {
    const deviceSupported = isApplePayDeviceSupported()

    if (!deviceSupported) {
        return { status: "unsupported", deviceSupported: false }
    }

    const ApplePaySession = getApplePaySession()

    if (merchantIdentifier && ApplePaySession?.applePayCapabilities) {
        try {
            const capabilities = await ApplePaySession.applePayCapabilities(merchantIdentifier)
            const credentialStatus = capabilities?.paymentCredentialStatus

            if (credentialStatus === "paymentCredentialsAvailable") {
                return { status: "ready", deviceSupported: true }
            }

            if (credentialStatus === "paymentCredentialsUnavailable") {
                return { status: "needs_setup", deviceSupported: true }
            }
        } catch {
            // Fall through to Stripe canMakePayment.
        }
    }

    try {
        const result = await canMakePayment()

        if (result && result.applePay) {
            return { status: "ready", deviceSupported: true }
        }

        return { status: "needs_setup", deviceSupported: true }
    } catch {
        return { status: "needs_setup", deviceSupported: true }
    }
}

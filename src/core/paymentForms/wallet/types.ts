export type ApplePayStatus = "checking" | "unsupported" | "needs_setup" | "ready"

export type ApplePayStatusPayload = {
    status: ApplePayStatus
    canPay: boolean
    deviceSupported: boolean
    buttonId?: string
}

export type PresentApplePayResult = "shown" | "setup" | "failed"

export type PaymentRequestLike = {
    show: () => void
    isShowing?: () => boolean
}

export type BeginPresentApplePayOptions = {
    paymentRequest: PaymentRequestLike
    merchantIdentifier?: string
    status: ApplePayStatus
}

export type BeginPresentApplePayResult = {
    shown: boolean
    setupStarted: boolean
    setupPromise: Promise<boolean> | null
}

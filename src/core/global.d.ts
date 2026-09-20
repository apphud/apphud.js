declare global {
    interface Window {
        ApplePaySession?: {
            canMakePayments?: () => boolean
            applePayCapabilities?: (merchantIdentifier: string) => Promise<{
                paymentCredentialStatus?: string
            }>
            openPaymentSetup?: (merchantIdentifier: string) => Promise<boolean>
        };
        ApphudSDKVersion?: string;
        gtag: (...args: any[]) => void;
        gaGlobal: {
            vid: string
        },
        fbq: (method: string, event: string, properties: Record<string, string>, options?: Record<string, string>) => void,
        dataLayer: any[];
        amplitude: {
            getDeviceId(): string;
            getSessionId(): string;
            init(apiKey: string, options?: any): void;
        };
    }
}

export {};

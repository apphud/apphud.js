declare global {
    interface Window {
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

declare global {
    interface Window {
        gtag: (...args: any[]) => void;
        gaGlobal: {
            vid: string
        },
        fbq: (method: string, event: string, properties: Record<string, string>) => void,
        dataLayer: any[];
    }
}

export {};

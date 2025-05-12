import { ApphudFunc, ApphudHash } from "../types";
export declare const canStringify: boolean;
export declare const log: (...message: any[]) => void;
/**
 * Log error to console and optionally report to backend
 * @param args - Error message(s) to log and potentially report, with an optional boolean at the end to control reporting
 */
export declare const logError: (...args: any[]) => void;
export declare const documentReady: (callback: ApphudFunc) => void;
export declare const getValueByPath: (obj: ApphudHash, path: string) => string | null;
export declare const generateSHA256: (input: any) => Promise<string>;
/**
 * Get Amplitude device ID if available
 * @returns Amplitude device ID or null if not available
 */
export declare const getAmplitudeId: () => string | null;
declare const _default: {
    sleep: (ms: number) => Promise<void>;
    cleanObject: (obj: ApphudHash) => ApphudHash;
    serialize: (object: ApphudHash) => FormData;
    documentReady: (callback: ApphudFunc) => void;
    generateId: () => string;
    presence: (str: string) => string | null;
    getLocale: () => string;
    getTimeZone: () => string;
    getCurrencyCode: () => string | undefined;
    getCountryCode: () => string;
    getOSVersion: () => string;
    getClosest: (element: Element | EventTarget | null, attribute: string) => string | null;
    timestamp: () => number;
    getValueByPath: (obj: ApphudHash, path: string) => string | null;
    roundTo: (value: number, decimals: number) => string;
    formatCurrency: (value: number, currency: string | null) => string;
    formatNumber: (value: number) => string;
    isStripeAvailable: () => boolean;
    isPaddleAvailable: () => boolean;
    generateSHA256: (input: any) => Promise<string>;
    getAmplitudeId: () => string | null;
};
export default _default;
//# sourceMappingURL=index.d.ts.map
import {config} from "../core/config/config";
import {ApphudFunc, ApphudHash} from "../types";
import api from "../core/api";

export const canStringify: boolean = typeof (JSON) !== "undefined" && typeof (JSON.stringify) !== "undefined";

const sleep = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export const log = (...message: any[]): void => {
    if (config.debug) {
        window.console.log(...message);
    }
}

/**
 * Log error to console and optionally report to backend
 * @param args - Error message(s) to log and potentially report, with an optional boolean at the end to control reporting
 */
export const logError = (...args: any[]): void => {
    // Check if the last argument is a boolean indicating whether to report to backend
    let shouldReport = false;
    if (args.length > 0 && typeof args[args.length - 1] === 'boolean') {
        shouldReport = args.pop() as boolean;
    }
    
    window.console.error(...args);
    
    if (shouldReport && api.reportError) {
        // Convert messages to a single string for reporting
        const errorMessage = args.map(item => {
            if (typeof item === 'object') {
                try {
                    return JSON.stringify(item);
                } catch (e) {
                    return String(item);
                }
            }
            return String(item);
        }).join(' ');
        
        api.reportError(errorMessage).catch(error => {
            console.error('Failed to report error to backend:', error);
        });
    }
}

const cleanObject = (obj: ApphudHash): ApphudHash => {
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            if (obj[key] === null) {
                delete obj[key];
            }
        }
    }
    return obj;
}

const serialize = (object: ApphudHash): FormData => {
    const data = new FormData();
    for (const key in object) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
            data.append(key, object[key]);
        }
    }
    return data;
}

// const matchesSelector = (element: Element | EventTarget | null, selector: string): Element | EventTarget | null => {
//   const matches = (element as any).matches ||
//
//       (element as any).matchesSelector ||
//       (element as any).mozMatchesSelector ||
//       (element as any).msMatchesSelector ||
//       (element as any).oMatchesSelector ||
//       (element as any).webkitMatchesSelector;
//
//   if (matches) {
//     if (matches.call(element, selector)) {
//       return element;
//     } else if ((element as any).parentElement) {
//       return matchesSelector((element as any).parentElement, selector);
//     }
//     return null;
//   } else {
//     console.log("Unable to match");
//     return null;
//   }
// }

// http://beeker.io/jquery-document-ready-equivalent-vanilla-javascript
export const documentReady = (callback: ApphudFunc): void => {
    if (document.readyState === "interactive" || document.readyState === "complete") {
        setTimeout(callback, 0);
    } else {
        document.addEventListener("DOMContentLoaded", callback);
    }
}

// https://stackoverflow.com/a/2117523/1177228
const generateId = (): string => {
    if (window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c: string) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

const presence = (str: string): string | null => {
    return (str && str.length > 0) ? str : null;
}

const getClosest = (element: Element | EventTarget | null, attribute: string): string | null => {
    while (element && (element as any) !== document.documentElement) {
        if ((element as any).hasAttribute(attribute)) {
            return (element as any).getAttribute(attribute);
        }
        element = (element as any).parentElement;
    }
    return null;
}

const getLocale = (): string => {
    // Get the user's preferred language
    return navigator.language
}

const getTimeZone = (): string => {
    // Get the user's time zone using the Intl.DateTimeFormat object
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

const getCurrencyCode = (): string | undefined => {
    // Get the user's locale
    const locale = navigator.language;

    // Create a number format object for the locale
    const numberFormat = new Intl.NumberFormat(locale, {style: 'currency', currency: 'USD'});

    // Extract the currency code from the number format object
    return numberFormat.resolvedOptions().currency;
}

const getCountryCode = (): string => {
    // Get the user's locale using the Intl.DateTimeFormat object
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;

    // Extract the country code from the locale
    const countryCode = locale.split('-')[1] || locale.split('-')[0];

    return countryCode.toUpperCase();
}

const getOSVersion = (): string => {
    const userAgent = navigator.userAgent;
    let osVersion = "Unknown OS Version";

    // Detect Windows OS
    if (userAgent.indexOf("Windows NT") !== -1) {
        const windowsVersion = userAgent.match(/Windows NT (\d+\.\d+)/);
        if (windowsVersion) {
            osVersion = "Windows " + windowsVersion[1];
        }
    }
    // Detect macOS
    else if (userAgent.indexOf("Mac OS X") !== -1) {
        const macVersion = userAgent.match(/Mac OS X (\d+_\d+(_\d+)?)/);
        if (macVersion) {
            osVersion = "macOS " + macVersion[1].replace(/_/g, ".");
        }
    }
    // Detect iOS
    else if (userAgent.indexOf("iPhone OS") !== -1 || userAgent.indexOf("iPad; CPU OS") !== -1) {
        const iOSVersion = userAgent.match(/OS (\d+_\d+(_\d+)?)/);
        if (iOSVersion) {
            osVersion = "iOS " + iOSVersion[1].replace(/_/g, ".");
        }
    }
    // Detect Android
    else if (userAgent.indexOf("Android") !== -1) {
        const androidVersion = userAgent.match(/Android (\d+\.\d+(\.\d+)?)/);
        if (androidVersion) {
            osVersion = "Android " + androidVersion[1];
        }
    }
    // Detect Linux
    else if (userAgent.indexOf("Linux") !== -1) {
        osVersion = "Linux";
    }

    return osVersion;
}

const timestamp = (): number => {
    return (new Date()).getTime() / 1000.0
}

const getValueByPath = (obj: ApphudHash, path: string): string | null => {
    // Try requested language first
    let langObj = obj[config.language];
    
    // If not found, try English
    if (!langObj) {
        langObj = obj["en"];
    }
    
    // If still not found, use first available language
    if (!langObj) {
        const availableLanguages = Object.keys(obj);
        if (availableLanguages.length > 0) {
            langObj = obj[availableLanguages[0]];
        }
    }

    // If no language object found at all, return null
    if (!langObj) {
        return null;
    }

    return path.split('.').reduce((acc, part) => acc && acc[part], langObj as any);
}

const roundTo = (value: number, decimals: number): string => {
    const factor = Math.pow(10, decimals);
    const roundedNumber = Math.round(value * factor) / factor;

    return roundedNumber.toFixed(decimals);
}

const formatCurrency = (value: number, currency: string | null): string => {
    return value.toLocaleString('en-US', {style: 'currency', currency: currency || 'USD'});
}

const formatNumber = (value: number): string => {
    return value.toLocaleString();
}

const isStripeAvailable = (): boolean => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    return typeof(Stripe) !== "undefined"
}

const isPaddleAvailable = (): boolean => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    return typeof(Paddle) !== "undefined"
}

export const generateSHA256 = async (input: any): Promise<string> => {
    // Encode the input as a Uint8Array
    const encoder = new TextEncoder();
    const data = encoder.encode(input);

    // Use the SubtleCrypto API to hash the data
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);

    // Convert the hashBuffer to a hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    return hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Get Amplitude device ID if available
 * @returns Amplitude device ID or null if not available
 */
export const getAmplitudeId = (): string | null => {
    try {
        if (typeof window !== 'undefined' && window.amplitude && typeof window.amplitude.getDeviceId === 'function') {
            return window.amplitude.getDeviceId();
        }
    } catch (error) {
        logError('Error getting Amplitude device ID:', error);
    }
    return null;
}

export default {
    sleep,
    cleanObject,
    serialize,
    documentReady,
    generateId,
    presence,
    getLocale,
    getTimeZone,
    getCurrencyCode,
    getCountryCode,
    getOSVersion,
    getClosest,
    timestamp,
    getValueByPath,
    roundTo,
    formatCurrency,
    formatNumber,
    isStripeAvailable,
    isPaddleAvailable,
    generateSHA256,
    getAmplitudeId
};

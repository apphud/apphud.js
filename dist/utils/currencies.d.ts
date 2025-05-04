/**
 * Map of common currency symbols to their ISO currency codes
 */
export declare const currencySymbolMap: {
    [key: string]: string;
};
/**
 * Extracts currency code from a price string
 * Handles both symbol currencies ($, €) and code currencies (USD, CHF)
 * Works with or without spaces between currency and amount
 *
 * @param priceString The price string to extract currency from (e.g. "$10.99", "CHF20", "USD 99.99")
 * @param defaultCode Default currency code to return if no match is found (default: 'usd')
 * @returns ISO currency code in lowercase
 */
export declare function extractCurrencyFromPrice(priceString: string, defaultCode?: string): string;
//# sourceMappingURL=currencies.d.ts.map
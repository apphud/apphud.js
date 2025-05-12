/**
 * Map of common currency symbols to their ISO currency codes
 */
export const currencySymbolMap: { [key: string]: string } = {
  '$': 'usd', // US Dollar
  '€': 'eur', // Euro
  '£': 'gbp', // British Pound
  '¥': 'jpy', // Japanese Yen
  '₽': 'rub', // Russian Ruble
  '₹': 'inr', // Indian Rupee
  'CHF': 'chf', // Swiss Franc
  'A$': 'aud', // Australian Dollar
  'C$': 'cad', // Canadian Dollar
  'NZ$': 'nzd', // New Zealand Dollar
  'HK$': 'hkd', // Hong Kong Dollar
  'S$': 'sgd', // Singapore Dollar
  '₩': 'krw', // Korean Won
  '元': 'cny', // Chinese Yuan
  '฿': 'thb', // Thai Baht
  '₫': 'vnd', // Vietnamese Dong
  '₱': 'php', // Philippine Peso
  'RM': 'myr', // Malaysian Ringgit
  '₨': 'inr', // Indian Rupee (alternative symbol)
  'kr': 'dkk', // Danish Krone (also used for Swedish and Norwegian Krone)
  'zł': 'pln', // Polish Złoty
  '₴': 'uah', // Ukrainian Hryvnia
  'Kč': 'czk', // Czech Koruna
  'lei': 'ron', // Romanian Leu
  'Ft': 'huf', // Hungarian Forint  
  '₺': 'try', // Turkish Lira
  'ج.م': 'egp', // Egyptian Pound
  'EGP': 'egp', // Egyptian Pound (code)
  'د.إ': 'aed', // UAE Dirham
  'ر.س': 'sar', // Saudi Riyal
  'د.ك': 'kwd', // Kuwaiti Dinar
  'ر.ق': 'qar', // Qatari Riyal
  'د.ا': 'jod', // Jordanian Dinar
  'R$': 'brl', // Brazilian Real
  'CLP$': 'clp', // Chilean Peso
  'MX$': 'mxn', // Mexican Peso
  'AR$': 'ars', // Argentine Peso
  'R': 'zar', // South African Rand
  'KSh': 'kes', // Kenyan Shilling
  'N': 'ngn', // Nigerian Naira
  'GH₵': 'ghs', // Ghanaian Cedi
  'DA': 'dzd', // Algerian Dinar
  'MAD': 'mad', // Moroccan Dirham
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
export function extractCurrencyFromPrice(priceString: string, defaultCode: string = 'usd'): string {
  if (!priceString) return defaultCode;
  
  // Check for common currency symbols
  const symbolMatch = priceString.match(/[$€£¥₹₽₩₴₺฿₱₨₫元N]/);
  if (symbolMatch && symbolMatch[0]) {
    const symbol = symbolMatch[0];
    return currencySymbolMap[symbol] || defaultCode;
  }
  
  // Check for multi-character currency symbols at beginning of string
  for (const symbol in currencySymbolMap) {
    if (symbol.length > 1) {
      // Check with space
      if (priceString.startsWith(symbol + ' ')) {
        return currencySymbolMap[symbol];
      }
      
      // Check without space - make sure the symbol is at the start and followed by digits
      if (priceString.startsWith(symbol) && 
          priceString.length > symbol.length && 
          /\d/.test(priceString.charAt(symbol.length))) {
        return currencySymbolMap[symbol];
      }
    }
  }
  
  return defaultCode;
} 
import { settingsService } from '../services/settingsService';
import { documentNumberingService } from '../services/documentNumberingService';

export const formatCurrency = (amount: number, currency = 'MAD'): string => {
  // Ensure 2 decimal places precision
  const roundedAmount = Math.round((amount + Number.EPSILON) * 100) / 100;

  return new Intl.NumberFormat('fr-MA', {
    style: 'currency',
    currency: currency === 'MAD' ? 'MAD' : currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(roundedAmount);
};

export const formatDate = (date: string | Date): string => {
  return new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(date));
};

export const formatDateTime = (date: string | Date): string => {
  return new Intl.DateTimeFormat('fr-FR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
};

export const generateDocumentNumber = async (documentType: 'INVOICE' | 'DELIVERY' | 'RETURN' | 'QUOTE' | 'SALES_JOURNAL' | 'PURCHASE_ORDER' | 'BC' | 'DEV' | 'JV' | string): Promise<string> => {
  try {
    // Convert short codes to standard document types
    const typeMapping: Record<string, string> = {
      'FAC': 'INVOICE',
      'BL': 'DELIVERY',
      'RET': 'RETURN',
      'BR': 'RETURN',
      'DEV': 'QUOTE',
      'JV': 'SALES_JOURNAL',
      'BC': 'PURCHASE_ORDER'
    };

    // Map the document type if it's a short code
    const mappedType = typeMapping[documentType] || documentType;

    // Use the settings service to get the next number
    return await settingsService.getAndIncrementDocumentNumber(mappedType as any);
  } catch (error) {
    console.error('Error generating document number:', error);
    // Fallback to timestamp-based generation
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const prefix = typeof documentType === 'string' && documentType.length <= 5 ? documentType : 'DOC';
    return `${prefix}-${timestamp}-${random}`;
  }
};

export const downloadJSON = (data: any, filename: string): void => {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const downloadCSV = (data: string[][], filename: string): void => {
  const csvContent = data.map(row =>
    row.map(field => `"${field}"`).join(',')
  ).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const NUMBERS_TO_WORDS: { [key: number]: string } = {
  0: 'zéro',
  1: 'un',
  2: 'deux',
  3: 'trois',
  4: 'quatre',
  5: 'cinq',
  6: 'six',
  7: 'sept',
  8: 'huit',
  9: 'neuf',
  10: 'dix',
  11: 'onze',
  12: 'douze',
  13: 'treize',
  14: 'quatorze',
  15: 'quinze',
  16: 'seize',
  17: 'dix-sept',
  18: 'dix-huit',
  19: 'dix-neuf',
  20: 'vingt',
  30: 'trente',
  40: 'quarante',
  50: 'cinquante',
  60: 'soixante',
  70: 'soixante-dix',
  80: 'quatre-vingt',
  90: 'quatre-vingt-dix'
};

const convertTensToWords = (number: number): string => {
  if (number <= 20) return NUMBERS_TO_WORDS[number] || '';

  const tens = Math.floor(number / 10) * 10;
  const ones = number % 10;

  if (ones === 0) return NUMBERS_TO_WORDS[tens] || '';
  if (tens === 70) return `soixante-${NUMBERS_TO_WORDS[10 + ones] || ''}`;
  if (tens === 90) return `quatre-vingt-${NUMBERS_TO_WORDS[10 + ones] || ''}`;

  return `${NUMBERS_TO_WORDS[tens] || ''}-${NUMBERS_TO_WORDS[ones] || ''}`;
};

const convertHundredsToWords = (number: number): string => {
  if (number < 100) return convertTensToWords(number);

  const hundreds = Math.floor(number / 100);
  const remainder = number % 100;

  let result = hundreds === 1 ? 'cent' : `${NUMBERS_TO_WORDS[hundreds] || ''}-cent`;
  if (remainder > 0) result += ` ${convertTensToWords(remainder)}`;

  return result;
};

const convertThousandsToWords = (number: number): string => {
  if (number < 1000) return convertHundredsToWords(number);

  const thousands = Math.floor(number / 1000);
  const remainder = number % 1000;

  let result = thousands === 1 ? 'mille' : `${convertHundredsToWords(thousands)} mille`;
  if (remainder > 0) result += ` ${convertHundredsToWords(remainder)}`;

  return result;
};

const convertMillionsToWords = (number: number): string => {
  if (number < 1000000) return convertThousandsToWords(number);

  const millions = Math.floor(number / 1000000);
  const remainder = number % 1000000;

  let result = millions === 1 ? 'un million' : `${convertThousandsToWords(millions)} millions`;
  if (remainder > 0) result += ` ${convertThousandsToWords(remainder)}`;

  return result;
};

export const numberToFrenchWords = (amount: number): string => {
  // Handle negative numbers
  if (amount < 0) return `moins ${numberToFrenchWords(Math.abs(amount))}`;
  if (amount === 0) return 'zéro Dirhams';

  // Split into integer and decimal parts
  const [integerPart, decimalPart = '0'] = amount.toFixed(2).split('.');
  const integerNumber = parseInt(integerPart);
  const decimalNumber = parseInt(decimalPart);

  // Convert integer part
  let result = convertMillionsToWords(integerNumber);

  // Add currency
  result += ' Dirhams';

  // Add decimal part if not zero
  if (decimalNumber > 0) {
    result += ` et ${convertTensToWords(decimalNumber)} centimes`;
  }

  // Capitalize first letter
  return result.charAt(0).toUpperCase() + result.slice(1);
};
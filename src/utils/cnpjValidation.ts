/**
 * Validates a Brazilian CNPJ number using the official algorithm
 * @param cnpj - CNPJ string (can include formatting like dots, slashes and dashes)
 * @returns true if valid, false otherwise
 */
export function validateCNPJ(cnpj: string): boolean {
  // Remove non-numeric characters
  const cleanCNPJ = cnpj.replace(/\D/g, '');

  // CNPJ must have exactly 14 digits
  if (cleanCNPJ.length !== 14) {
    return false;
  }

  // Check for known invalid patterns (all same digits)
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) {
    return false;
  }

  // Calculate first check digit
  let size = cleanCNPJ.length - 2;
  let numbers = cleanCNPJ.substring(0, size);
  const digits = cleanCNPJ.substring(size);
  let sum = 0;
  let pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) {
    return false;
  }

  // Calculate second check digit
  size = size + 1;
  numbers = cleanCNPJ.substring(0, size);
  sum = 0;
  pos = size - 7;

  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) pos = 9;
  }

  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) {
    return false;
  }

  return true;
}

/**
 * Formats a CNPJ string to the standard format XX.XXX.XXX/XXXX-XX
 * @param cnpj - CNPJ string (numeric only or already formatted)
 * @returns Formatted CNPJ string
 */
export function formatCNPJ(cnpj: string): string {
  const cleanCNPJ = cnpj.replace(/\D/g, '');
  
  if (cleanCNPJ.length <= 2) {
    return cleanCNPJ;
  } else if (cleanCNPJ.length <= 5) {
    return `${cleanCNPJ.slice(0, 2)}.${cleanCNPJ.slice(2)}`;
  } else if (cleanCNPJ.length <= 8) {
    return `${cleanCNPJ.slice(0, 2)}.${cleanCNPJ.slice(2, 5)}.${cleanCNPJ.slice(5)}`;
  } else if (cleanCNPJ.length <= 12) {
    return `${cleanCNPJ.slice(0, 2)}.${cleanCNPJ.slice(2, 5)}.${cleanCNPJ.slice(5, 8)}/${cleanCNPJ.slice(8)}`;
  } else {
    return `${cleanCNPJ.slice(0, 2)}.${cleanCNPJ.slice(2, 5)}.${cleanCNPJ.slice(5, 8)}/${cleanCNPJ.slice(8, 12)}-${cleanCNPJ.slice(12, 14)}`;
  }
}

/**
 * Formats a phone number to Brazilian format
 * @param phone - Phone string (numeric only or already formatted)
 * @returns Formatted phone string
 */
export function formatPhone(phone: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  
  if (cleanPhone.length <= 2) {
    return cleanPhone;
  } else if (cleanPhone.length <= 6) {
    return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2)}`;
  } else if (cleanPhone.length <= 10) {
    return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2, 6)}-${cleanPhone.slice(6)}`;
  } else {
    return `(${cleanPhone.slice(0, 2)}) ${cleanPhone.slice(2, 7)}-${cleanPhone.slice(7, 11)}`;
  }
}

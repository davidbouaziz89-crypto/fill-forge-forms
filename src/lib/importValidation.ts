import { z } from "zod";

// Maximum lengths for client fields
const MAX_LENGTHS = {
  company_name: 200,
  first_name: 100,
  last_name: 100,
  email: 100,
  phone: 30,
  address_line1: 200,
  address_line2: 200,
  zip: 10,
  city: 100,
  country: 100,
  siret: 14,
  code_naf: 10,
  type_client: 50,
  category: 100,
} as const;

// Email validation schema
const emailSchema = z.string().email().max(100);

// SIRET validation (14 digits, spaces allowed)
const siretSchema = z.string().refine(
  (val) => /^\d{14}$/.test(val.replace(/\s/g, "")),
  { message: "Le SIRET doit contenir 14 chiffres" }
);

// Phone validation (French format, flexible)
const phoneSchema = z.string().max(30);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  data: Record<string, string | null>;
  warnings: string[];
}

/**
 * Validates and sanitizes client data before database insertion
 * Returns sanitized data with validation results
 */
export function validateClientData(
  data: Record<string, string | null>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const sanitizedData: Record<string, string | null> = {};

  // Process each field
  for (const [field, value] of Object.entries(data)) {
    if (value === null || value === undefined) {
      sanitizedData[field] = null;
      continue;
    }

    // Trim whitespace
    let sanitizedValue = value.trim();

    // Remove control characters (except common ones like newlines for addresses)
    sanitizedValue = sanitizedValue.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

    // Apply length limits
    const maxLength = MAX_LENGTHS[field as keyof typeof MAX_LENGTHS];
    if (maxLength && sanitizedValue.length > maxLength) {
      warnings.push(
        `${field}: valeur tronquée à ${maxLength} caractères`
      );
      sanitizedValue = sanitizedValue.substring(0, maxLength);
    }

    // Field-specific validation
    switch (field) {
      case "email":
        if (sanitizedValue && !emailSchema.safeParse(sanitizedValue).success) {
          errors.push(`Email invalide: ${sanitizedValue.substring(0, 50)}...`);
          sanitizedValue = ""; // Clear invalid email
        }
        break;

      case "siret":
        // Clean SIRET (remove spaces)
        const cleanSiret = sanitizedValue.replace(/\s/g, "");
        if (cleanSiret && !siretSchema.safeParse(cleanSiret).success) {
          warnings.push(`SIRET invalide (doit contenir 14 chiffres): ${sanitizedValue}`);
          // Keep the value but warn - don't block import
        } else {
          sanitizedValue = cleanSiret;
        }
        break;

      case "phone":
        // Clean phone (normalize spaces)
        sanitizedValue = sanitizedValue.replace(/\s+/g, " ").trim();
        break;

      case "zip":
        // Clean postal code (remove extra spaces)
        sanitizedValue = sanitizedValue.replace(/\s/g, "");
        break;
    }

    sanitizedData[field] = sanitizedValue || null;
  }

  // Required field validation
  if (!sanitizedData.company_name) {
    errors.push("Raison sociale manquante");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    data: sanitizedData,
  };
}

/**
 * Sanitizes custom field values
 */
export function sanitizeCustomValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  
  let sanitized = value.toString().trim();
  
  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  
  // Limit length to prevent abuse
  if (sanitized.length > 1000) {
    sanitized = sanitized.substring(0, 1000);
  }
  
  return sanitized || null;
}

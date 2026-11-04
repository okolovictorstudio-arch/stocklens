export { cn } from "cn";

/**
 * Cleans raw corporate legal names into friendly, everyday company names.
 * Examples:
 * - "META PLATFORMS INC-CLASS A" -> "Meta Platforms"
 * - "APPLE INC" -> "Apple"
 * - "MICROSOFT CORP" -> "Microsoft"
 * - "ALPHABET INC-CL A" -> "Alphabet"
 * - "AMAZON.COM INC" -> "Amazon"
 */
export function cleanCompanyName(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return "";
  let name = raw.trim();

  // Remove common corporate share class suffixes
  name = name.replace(/[-–—/]\s*(?:CLASS|CL)\s+[A-Z0-9]+/gi, "");
  name = name.replace(/\b(?:CLASS|CL)\s+[A-Z0-9]+\b/gi, "");
  name = name.replace(/[-–—/]\s*[A-Z]\b/g, ""); // e.g. -A

  // Remove corporate entity suffixes
  name = name.replace(
    /,?\s*\b(?:INC|INCORPORATED|CORP|CORPORATION|CO|COMPANY|LTD|LIMITED|PLC|LLC|LP|NV|SA|SE)\b\.?/gi,
    ""
  );

  // Clean trailing punctuation and common securities terminology
  name = name.replace(/,?\s*(?:COMMON\s+STOCK|ORD\s+SHS|DEPOSITARY\s+SHS|ADR|ADS)\b/gi, "");
  name = name.replace(/\.com\b/gi, "");
  name = name.replace(/[,\s-]+$/, "").trim();

  // If the raw name was all uppercase, convert to Title Case for natural readability
  if (name.length > 2 && name === name.toUpperCase()) {
    name = name
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  return name || raw;
}

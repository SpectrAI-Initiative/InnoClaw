export const FONT_SIZE_KEY = "innoclaw-font-size";
export const FONT_FAMILY_KEY = "innoclaw-font-family";
export const DEFAULT_FONT = "geist";
export const MIN_FONT_SIZE = 12;
export const MAX_FONT_SIZE = 24;

export const FONT_OPTIONS = [
  { id: "geist", name: "Geist", value: "var(--font-geist-sans), sans-serif" },
  { id: "system", name: "System", value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" },
  { id: "inter", name: "Inter", value: "'Inter', sans-serif" },
  { id: "noto-sans", name: "Noto Sans", value: "'Noto Sans', 'Noto Sans SC', sans-serif" },
  { id: "roboto", name: "Roboto", value: "'Roboto', sans-serif" },
  { id: "lato", name: "Lato", value: "'Lato', sans-serif" },
  { id: "source-han", name: "Source Han Sans", value: "'Source Han Sans SC', 'Noto Sans SC', sans-serif" },
] as const;

export type FontId = (typeof FONT_OPTIONS)[number]["id"];

export const WEB_FONT_URLS: Partial<Record<FontId, string>> = {
  inter: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
  "noto-sans": "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap",
  roboto: "https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap",
  lato: "https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&display=swap",
  "source-han": "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&display=swap",
};

/**
 * Builds the inline script string for injecting font preferences early
 * (before React hydration) to avoid flash of unstyled content.
 * Generated from FONT_OPTIONS and WEB_FONT_URLS so there is a single source
 * of truth for font mappings.
 */
export function buildFontInitScript(): string {
  // Build font-family map excluding the default (Geist uses CSS variables, not --font-override)
  const fontFamilyMap: Record<string, string> = {};
  for (const option of FONT_OPTIONS) {
    if (option.id !== DEFAULT_FONT) {
      fontFamilyMap[option.id] = option.value;
    }
  }

  const sizeKey = JSON.stringify(FONT_SIZE_KEY);
  const familyKey = JSON.stringify(FONT_FAMILY_KEY);
  const defaultFont = JSON.stringify(DEFAULT_FONT);
  const min = MIN_FONT_SIZE;
  const max = MAX_FONT_SIZE;
  const fontMap = JSON.stringify(fontFamilyMap);
  const urlMap = JSON.stringify(WEB_FONT_URLS);

  // Minified IIFE: reads font-size and font-family from localStorage and applies
  // them before React hydration to prevent flash of unstyled content.
  return [
    "(function(){try{",
    // Apply saved font size
    `var s=localStorage.getItem(${sizeKey});`,
    `if(s){var n=Number(s);if(n>=${min}&&n<=${max})document.documentElement.style.fontSize=n+"px"}`,
    // Apply saved font family
    `var f=localStorage.getItem(${familyKey});`,
    `if(f&&f!==${defaultFont}){`,
    `var m=${fontMap};var v=m[f];`,
    `if(v){document.documentElement.style.setProperty("--font-override",v);`,
    `var u=${urlMap};`,
    `if(u[f]){var l=document.createElement("link");l.rel="stylesheet";l.href=u[f];document.head.appendChild(l)}`,
    "}}",
    "}catch(e){}})();",
  ].join("");
}

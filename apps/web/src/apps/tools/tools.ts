/**
 * Araçlar — it-tools tarzı geliştirici araç seti.
 *
 * Her araç **iki dilli** (Türkçe / İngilizce); dil araç tepesinden seçilir ve
 * seçim `localStorage`'da saklanır. Bazı araçların metinleri dil değişince
 * anında güncellenir, bazılarının açıklaması da çevrilir.
 *
 * Yeni araç eklemek:
 *   1. `TOOLS` listesine kayıt ekle
 *   2. Bileşeni yaz ve `id` ile eşle
 */

export type ToolId =
  | "hash"
  | "uuid"
  | "base64"
  | "url"
  | "jwt"
  | "json"
  | "jsonYaml"
  | "color"
  | "textStats"
  | "caseConvert"
  | "password"
  | "regex"
  | "cron"
  | "subnet"
  | "timestamp"
  | "radix"
  | "percentage"
  | "qrcode"
  | "lorem"
  | "mime"
  | "httpStatus"
  | "htpasswd";

/** Desteklenen arayüz dili */
export type ToolLang = "tr" | "en";

/** İki dilli metin */
export interface Bilingual {
  tr: string;
  en: string;
}

export interface ToolDefinition {
  id: ToolId;
  icon: string;
  name: Bilingual;
  /** Kategori — sekmeleri gruplamak için */
  group: Bilingual;
}

/** Araç kataloğu */
export const TOOLS: ToolDefinition[] = [
  // --- Kriptografi ---
  { id: "hash", icon: "🔐", group: { tr: "Kripto", en: "Crypto" }, name: { tr: "Hash üretici", en: "Hash generator" } },
  { id: "password", icon: "🔑", group: { tr: "Kripto", en: "Crypto" }, name: { tr: "Şifre üretici", en: "Password generator" } },
  { id: "uuid", icon: "🆔", group: { tr: "Kripto", en: "Crypto" }, name: { tr: "UUID / ULID", en: "UUID / ULID" } },
  { id: "jwt", icon: "🎫", group: { tr: "Kripto", en: "Crypto" }, name: { tr: "JWT çözümleyici", en: "JWT parser" } },
  { id: "htpasswd", icon: "🗝", group: { tr: "Kripto", en: "Crypto" }, name: { tr: "Temel kimlik başlığı", en: "Basic auth header" } },

  // --- Dönüştürücü ---
  { id: "base64", icon: "🧬", group: { tr: "Dönüştürücü", en: "Converter" }, name: { tr: "Base64 kodla / çöz", en: "Base64 encode / decode" } },
  { id: "url", icon: "🔗", group: { tr: "Dönüştürücü", en: "Converter" }, name: { tr: "URL kodla / çöz", en: "URL encode / decode" } },
  { id: "json", icon: "🧾", group: { tr: "Dönüştürücü", en: "Converter" }, name: { tr: "JSON biçimlendir", en: "JSON prettify" } },
  { id: "jsonYaml", icon: "🔀", group: { tr: "Dönüştürücü", en: "Converter" }, name: { tr: "JSON ↔ YAML", en: "JSON ↔ YAML" } },
  { id: "radix", icon: "🔢", group: { tr: "Dönüştürücü", en: "Converter" }, name: { tr: "Sayı tabanı çevir", en: "Integer base converter" } },
  { id: "timestamp", icon: "⏱", group: { tr: "Dönüştürücü", en: "Converter" }, name: { tr: "Zaman damgası", en: "Timestamp" } },
  { id: "color", icon: "🎨", group: { tr: "Dönüştürücü", en: "Converter" }, name: { tr: "Renk dönüştürücü", en: "Color converter" } },
  { id: "caseConvert", icon: "🔤", group: { tr: "Dönüştürücü", en: "Converter" }, name: { tr: "Büyük/küçük harf", en: "Case converter" } },

  // --- Metin ---
  { id: "textStats", icon: "📊", group: { tr: "Metin", en: "Text" }, name: { tr: "Metin istatistikleri", en: "Text statistics" } },
  { id: "lorem", icon: "📄", group: { tr: "Metin", en: "Text" }, name: { tr: "Lorem ipsum", en: "Lorem ipsum" } },
  { id: "regex", icon: "🔎", group: { tr: "Metin", en: "Text" }, name: { tr: "Regex test aracı", en: "Regex tester" } },

  // --- Ağ ---
  { id: "subnet", icon: "🌐", group: { tr: "Ağ", en: "Network" }, name: { tr: "IPv4 subnet hesaplayıcı", en: "IPv4 subnet calculator" } },
  { id: "httpStatus", icon: "📡", group: { tr: "Ağ", en: "Network" }, name: { tr: "HTTP durum kodları", en: "HTTP status codes" } },
  { id: "mime", icon: "📦", group: { tr: "Ağ", en: "Network" }, name: { tr: "MIME türleri", en: "MIME types" } },

  // --- Diğer ---
  { id: "cron", icon: "⏰", group: { tr: "Geliştirici", en: "Developer" }, name: { tr: "Cron açıklayıcı", en: "Cron parser" } },
  { id: "percentage", icon: "％", group: { tr: "Geliştirici", en: "Developer" }, name: { tr: "Yüzde hesaplayıcı", en: "Percentage calculator" } },
  { id: "qrcode", icon: "🔲", group: { tr: "Geliştirici", en: "Developer" }, name: { tr: "QR kod üretici", en: "QR code generator" } },
];

/** Dil seçimine göre metin döndürür. */
export function pick(value: Bilingual, lang: ToolLang): string {
  return lang === "en" ? value.en : value.tr;
}

// ----------------------------------------------------------------------
//  Araç içi metinler (TR/EN)
// ----------------------------------------------------------------------

/** Ortak arayüz metinleri */
export const UI = {
  input: { tr: "Girdi", en: "Input" },
  output: { tr: "Çıktı", en: "Output" },
  copy: { tr: "Kopyala", en: "Copy" },
  copied: { tr: "Kopyalandı", en: "Copied" },
  clear: { tr: "Temizle", en: "Clear" },
  generate: { tr: "Üret", en: "Generate" },
  search: { tr: "Ara…", en: "Search…" },
  sample: { tr: "Örnek", en: "Sample" },
  error: { tr: "Hata", en: "Error" },
  result: { tr: "Sonuç", en: "Result" },
} as const;

/** Metinleri dile göre seçer. */
export function t(entry: { tr: string; en: string }, lang: ToolLang): string {
  return lang === "en" ? entry.en : entry.tr;
}

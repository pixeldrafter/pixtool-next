/**
 * Derin birleştirme yardımcıları.
 *
 * Neden gerekli: ayarlar localStorage'da saklanır. Uygulama yeni sürümde yeni
 * bir alan kazandığında, eski kayıtta o alan bulunmaz. Düz `{...a, ...b}`
 * birleştirme iç nesneleri komple ezer ve kullanıcı ayarlarını kaybeder.
 *
 * Bu yüzden özyinelemeli (derin) birleştirme kullanılır:
 *   • nesneler → özyinelemeli birleşir
 *   • diziler ve ilkel değerler → üstteki değer kazanır (bilinçli tercih:
 *     akış sırası gibi diziler tamamen kullanıcıya ait olmalı)
 *   • `undefined` → alttaki değer korunur
 */

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * `override` değerlerini `base` üzerine derinlemesine uygular.
 * `base` değiştirilmez; yeni bir nesne döner.
 */
export function mergeDeep<T>(base: T, override: unknown): T {
  // Bozuk / eksik giriş → temel değeri koru.
  // Not: özyineleme yalnızca iki taraf da nesne iken çağrılır, bu yüzden
  // buradaki katı kontrol ilkel değerlerin birleştirilmesini engellemez.
  if (override === undefined || !isPlainObject(override)) {
    return base;
  }

  const baseObject: Record<string, unknown> = isPlainObject(base) ? base : {};
  const result: Record<string, unknown> = { ...baseObject };

  for (const [key, value] of Object.entries(override)) {
    const baseValue = baseObject[key];

    if (isPlainObject(value) && isPlainObject(baseValue)) {
      result[key] = mergeDeep(baseValue, value);
    } else if (value !== undefined) {
      result[key] = value;
    }
  }

  return result as T;
}

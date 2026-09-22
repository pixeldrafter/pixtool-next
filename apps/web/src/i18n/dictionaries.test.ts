/**
 * i18n testleri.
 *
 * Kapsam:
 *   • Sözlük bütünlüğü (anahtarlar tutarlı mı)
 *   • Çeviri fonksiyonu (fallback davranışı)
 *   • Parametre yerleştirme
 *   • Eksik çeviri tespiti
 */

import { describe, expect, it } from "vitest";

import {
  DICTIONARIES,
  en,
  listMissingTranslations,
  tr,
  type Dictionary,
} from "./dictionaries";

/** Sözlükten çeviri yapan saf fonksiyon (kanca olmadan test için). */
function translate(
  dictionary: Dictionary,
  key: string,
  params?: Record<string, string | number>,
): string {
  const template = dictionary[key] ?? tr[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

describe("sözlükler", () => {
  it("Türkçe sözlük boş değil", () => {
    expect(Object.keys(tr).length).toBeGreaterThan(50);
  });

  it("tüm anahtarlar nokta ayrımlı ve boş değer yok", () => {
    for (const [key, value] of Object.entries(tr)) {
      expect(key).toMatch(/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/);
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  it("İngilizce sözlük Türkçe'nin alt kümesidir", () => {
    const extra = Object.keys(en).filter((key) => !(key in tr));
    expect(extra).toEqual([]);
  });

  it("iki dil de kayıtlı", () => {
    expect(Object.keys(DICTIONARIES).sort()).toEqual(["en", "tr"]);
  });
});

describe("translate", () => {
  it("bilinen anahtarı çevirir", () => {
    expect(translate(tr, "app.overview")).toBe("Genel Bakış");
    expect(translate(en, "app.overview")).toBe("Overview");
  });

  it("bilinmeyen anahtarı olduğu gibi döndürür (sessiz hata yok)", () => {
    expect(translate(tr, "boyle.bir.anahtar.yok")).toBe("boyle.bir.anahtar.yok");
  });

  it("aktif dilde yoksa Türkçe'ye düşer", () => {
    const partial: Dictionary = { "app.name": "Custom" };
    expect(translate(partial, "app.overview")).toBe(tr["app.overview"]);
  });

  it("parametreleri yerleştirir", () => {
    const dict: Dictionary = { greeting: "Merhaba {name}, {count} mesajın var." };
    expect(translate(dict, "greeting", { name: "Ömer", count: 3 })).toBe(
      "Merhaba Ömer, 3 mesajın var.",
    );
  });

  it("eksik parametreyi yer tutucu olarak bırakır", () => {
    const dict: Dictionary = { greeting: "Merhaba {name}" };
    expect(translate(dict, "greeting", {})).toBe("Merhaba {name}");
  });
});

describe("çeviri takibi", () => {
  it("eksik çevirileri listeler", () => {
    const missing = listMissingTranslations("en");
    // İngilizce kısmi olduğu için bir miktar eksik olması normal
    expect(Array.isArray(missing)).toBe(true);
    expect(missing.every((key) => key in tr)).toBe(true);
    expect(missing.every((key) => !(key in en))).toBe(true);
  });

  it("Türkçe için eksik çeviri yok", () => {
    expect(listMissingTranslations("tr")).toEqual([]);
  });
});

/**
 * Ayarlar birleştirme testleri.
 *
 * Kritik senaryo: uygulama yeni bir ayar alanı kazandığında eski kayıtlı
 * ayarların bozulmaması ve yeni alanın varsayılandan gelmesi.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "./defaults";
import { mergeDeep } from "./merge";

describe("mergeDeep", () => {
  it("üst düzey alanları birleştirir", () => {
    const result = mergeDeep(DEFAULT_SETTINGS, { version: 99 });
    expect(result.version).toBe(99);
    expect(result.appearance.theme).toBe(DEFAULT_SETTINGS.appearance.theme);
  });

  it("iç içe nesnelerde kısmi güncelleme yapar, kardeş alanları korur", () => {
    const result = mergeDeep(DEFAULT_SETTINGS, {
      appearance: { theme: "kde" },
    });

    expect(result.appearance.theme).toBe("kde");
    // Kardeş alanlar korunmalı
    expect(result.appearance.cursor).toEqual(DEFAULT_SETTINGS.appearance.cursor);
    expect(result.appearance.scale).toBe(DEFAULT_SETTINGS.appearance.scale);
  });

  it("şemada olmayan yeni alanları varsayılandan tamamlar", () => {
    // Eski bir kayıt: yalnızca version var, diğer alanlar yok
    const eskiKayit = { version: 1 };

    const result = mergeDeep(DEFAULT_SETTINGS, eskiKayit);

    expect(result.appearance).toEqual(DEFAULT_SETTINGS.appearance);
    expect(result.login).toEqual(DEFAULT_SETTINGS.login);
    expect(result.flow.order).toEqual(DEFAULT_SETTINGS.flow.order);
  });

  it("dizileri üstteki değerle tamamen değiştirir (akış sırası kullanıcıya ait)", () => {
    const result = mergeDeep(DEFAULT_SETTINGS, {
      flow: { order: ["boot", "desktop", "login", "console"] },
    });

    expect(result.flow.order).toEqual(["boot", "desktop", "login", "console"]);
  });

  it("undefined değerleri yok sayar, mevcut ayarı korur", () => {
    const result = mergeDeep(DEFAULT_SETTINGS, {
      appearance: { theme: undefined },
    });

    expect(result.appearance.theme).toBe(DEFAULT_SETTINGS.appearance.theme);
  });

  it("bozuk girişte varsayılanı döndürür", () => {
    expect(mergeDeep(DEFAULT_SETTINGS, null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeDeep(DEFAULT_SETTINGS, "metin")).toEqual(DEFAULT_SETTINGS);
    expect(mergeDeep(DEFAULT_SETTINGS, 42)).toEqual(DEFAULT_SETTINGS);
  });

  it("orijinal nesneyi değiştirmez", () => {
    const kopya = structuredClone(DEFAULT_SETTINGS);
    mergeDeep(DEFAULT_SETTINGS, { appearance: { theme: "kde" } });
    expect(DEFAULT_SETTINGS).toEqual(kopya);
  });
});

describe("varsayılan ayarlar", () => {
  it("onaylanan akışı içerir (Giriş → Konsol → Boot → Masaüstü)", () => {
    expect(DEFAULT_SETTINGS.flow.order).toEqual(["login", "console", "boot", "desktop"]);
  });

  it("varsayılan login formu Login Form Lamp", () => {
    expect(DEFAULT_SETTINGS.login.form).toBe("lamp");
  });

  it("ceza ekranı 2 dakika (120 sn)", () => {
    expect(DEFAULT_SETTINGS.login.punishment.countdownSeconds).toBe(120);
  });

  it("OTP 3 yanlış denemede cezayı tetikler", () => {
    expect(DEFAULT_SETTINGS.login.otp.maxAttempts).toBe(3);
  });

  it("varsayılan duvar kağıdı Spider Clock", () => {
    expect(DEFAULT_SETTINGS.appearance.wallpaper.kind).toBe("spider-clock");
  });

  it("boşta ekranı Pixel Bat", () => {
    expect(DEFAULT_SETTINGS.idle.screen).toBe("pixel-bat");
  });
});

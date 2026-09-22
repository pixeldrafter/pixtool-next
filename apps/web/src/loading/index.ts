/**
 * Bekleme ve yükleme bileşenleri.
 *
 * İş bölümü:
 *   • `DeadlineBar`     → BELİRLİ süreli işlemler (kalan süre bilinir)
 *   • `WaitingCurtain`  → BELİRSİZ beklemeler (bg.gif perdesi)
 */

export { DeadlineBar, type DeadlineBarProps } from "./DeadlineBar";
export { WaitingCurtain, type WaitingCurtainProps } from "./WaitingCurtain";

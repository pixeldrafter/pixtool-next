/**
 * Bildirimler modülü.
 *
 *   const { toast } = ...   → depo dışından bildirim gönder
 *   <ToastLayer />          → katmanı çizer
 */

export { ToastLayer } from "./ToastLayer";
export { toast, useToastStore, type Toast, type ToastKind } from "./toastStore";

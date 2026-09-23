/**
 * Duvar kağıdı modülü.
 *
 *   • `SpiderClock`     → mekanik saat (sistem saati)
 *   • `PixelBat`        → uçan yarasalar
 *   • `VideoWallpaper`  → canlı duvar kağıdı (mp4 / webm)
 *   • `videoStore`      → yüklenen videoyu IndexedDB'de saklar
 */

export { SpiderClock } from "./SpiderClock";
export { PixelBat } from "./PixelBat";
export { VideoWallpaper, INDEXEDDB_SOURCE } from "./VideoWallpaper";
export {
  clearVideo,
  formatBytes,
  isIndexedDbAvailable,
  loadVideo,
  loadVideoUrl,
  saveVideo,
  videoInfo,
} from "./videoStore";

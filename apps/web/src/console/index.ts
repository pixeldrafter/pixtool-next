/**
 * Konsol modülü.
 */

export { ConsoleScreen } from "./ConsoleScreen";
export { probeMachine, BRIDGE_REQUIRED_FIELDS, type MachineInfo } from "./probe";
export {
  DEFAULT_BRIDGE_URL,
  probeBridge,
  fetchBridgeInfo,
  runOnBridge,
  asArray,
  asNumber,
  asRecord,
  asText,
  readBridge,
  type BridgeHealth,
  type BridgeInfo,
  type BridgeOptions,
  type BridgePart,
} from "./bridge";
export { buildConsoleSections, filterSections, type ConsoleLine, type ConsoleSection } from "./consoleLines";
export { saveDeviceReport, type DeviceReportResponse } from "./api";

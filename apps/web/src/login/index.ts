/**
 * Login modülü.
 *
 * Kullanım:
 *   import { LoginScreen, getLoginTheme, LOGIN_THEMES } from "@/login";
 *   <LoginScreen onSuccess={(session) => …} />
 */

export { LoginScreen } from "./LoginScreen";
export { OtpStep } from "./OtpStep";
export { OtpDemo } from "./OtpDemo";
export { JokeBubble } from "./JokeBubble";
export { PunishmentScreen } from "./PunishmentScreen";
export { LOGIN_THEMES, LOGIN_THEME_LIST, getLoginTheme } from "./themes";
export { LOGIN_FORMS, renderLoginForm } from "./registry";
export {
  useLoginFlow,
  OTP_SUCCESS_DURATION_MS,
  type LoginSession,
  type UseLoginFlowResult,
} from "./useLoginFlow";
export { JOKES, randomJoke, jokeByIndex } from "./jokes";
export type {
  LoginCredentials,
  LoginFormProps,
  LoginStep,
  LoginTheme,
  OtpChallenge,
  OtpStatus,
} from "./types";

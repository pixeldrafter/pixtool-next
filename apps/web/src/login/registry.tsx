/**
 * Login formu kayıt defteri.
 *
 * Yeni bir form eklemek için:
 *   1. `themes.ts`  → tema tanımı
 *   2. `settings/types.ts` → `LoginFormId` birleşimine ekle
 *   3. `settings/registry.ts` → `LOGIN_FORM_OPTIONS` listesine ekle
 *   4. buraya kayıt satırı
 *   5. `forms/` → bileşen
 *
 * Ayarlar ekranı bu kayıt defterinden otomatik beslenir.
 */

import type { LoginFormId } from "../settings/types";
import type { LoginFormProps } from "./types";
import { AnimatedBorderForm } from "./forms/AnimatedBorderForm";
import { AnimatedForm } from "./forms/AnimatedForm";
import { LampForm } from "./forms/LampForm";
import { PandaForm } from "./forms/PandaForm";
import { YetiForm } from "./forms/YetiForm";

/** Bir formun çizim fonksiyonu. */
export type LoginFormRenderer = (props: LoginFormProps) => React.ReactElement;

export const LOGIN_FORMS: Record<LoginFormId, LoginFormRenderer> = {
  lamp: (props) => <LampForm {...props} />,
  animated: (props) => <AnimatedForm {...props} />,
  animatedBorder: (props) => <AnimatedBorderForm {...props} />,
  panda: (props) => <PandaForm {...props} variant="card" />,
  pandaPage: (props) => <PandaForm {...props} variant="page" />,
  yeti: (props) => <YetiForm {...props} />,
};

export function renderLoginForm(id: LoginFormId, props: LoginFormProps): React.ReactElement {
  const renderer = LOGIN_FORMS[id] ?? LOGIN_FORMS.lamp;
  return renderer(props);
}

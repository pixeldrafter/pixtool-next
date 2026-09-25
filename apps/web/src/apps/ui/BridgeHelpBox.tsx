/**
 * Yerel köprü erişilemediğinde gösterilen yönlendirme kutusu.
 *
 * Tarayıcı kısıtı, kapalı köprü ve yanlış adres durumlarını ayırt eder.
 */

import { bridgeHelp } from "../../lib/bridgeHelp";
import "./bridge-help.css";

export function BridgeHelpBox({ bridgeUrl }: { bridgeUrl: string }) {
  const help = bridgeHelp(bridgeUrl);

  return (
    <div className="app-msg app-msg--warn bridge-help">
      <div className="bridge-help__head">
        <span className="bridge-help__icon" aria-hidden="true">
          {help.isDesktop ? "🔌" : "🛡"}
        </span>
        <strong>{help.title}</strong>
      </div>
      <p className="bridge-help__body">{help.body}</p>
      <ul className="bridge-help__steps">
        {help.steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ul>
    </div>
  );
}

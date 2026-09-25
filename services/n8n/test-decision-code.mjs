/**
 * n8n "Kararı Çözümle" Code düğümünün mantığını doğrular.
 *
 * Düğümün içindeki JavaScript burada birebir çalıştırılır; böylece n8n'de
 * çalışacak mantığın doğruluğu **tarayıcı/Telegram olmadan** kanıtlanır.
 *
 * Kullanım: node services/n8n/test-decision-code.mjs
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const WF = join(import.meta.dirname, "pixtool-kayit-onayi.workflow.json");
const workflow = JSON.parse(readFileSync(WF, "utf8"));

const node = workflow.nodes.find((item) => item.name === "Karari Cozumle");
if (!node) {
  console.error("  Karari Cozumle dugumu bulunamadi");
  process.exit(1);
}

const code = node.parameters.jsCode;

/** Düğüm kodunu verilen girdilerle çalıştırır. */
function run(inputItems) {
  const $input = { all: () => inputItems };
  // n8n Code düğümü gövdeyi fonksiyon olarak çalıştırır
  const fn = new Function("$input", code);
  return fn($input);
}

const CHAT = 1125335929;

/** Gerçek Telegram callback_query güncellemesi üretir. */
function update(data, overrides = {}) {
  return {
    json: {
      update_id: 900000001,
      callback_query: {
        id: "cb-test-1",
        from: { id: CHAT, is_bot: false, first_name: "Omer", username: "omercataloglu" },
        message: {
          message_id: 999,
          date: 1790000000,
          chat: { id: CHAT, type: "private" },
          text: "🔐 YENİ KULLANICI KAYDI\n\n👤 Kullanıcı: test",
        },
        chat_instance: "test",
        data,
        ...overrides,
      },
    },
  };
}

let passed = 0;
let failed = 0;

function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
    console.log(`  ✔ ${label}`);
  } else {
    failed += 1;
    console.log(`  ✘ ${label}`);
    console.log(`      beklenen: ${JSON.stringify(expected)}`);
    console.log(`      gelen   : ${JSON.stringify(actual)}`);
  }
}

console.log("");
console.log("=".repeat(60));
console.log("  n8n KARAR DÜĞÜMÜ MANTIK TESTİ");
console.log("=".repeat(60));
console.log("");

const RID = "91U00VmmIrM2iN2uRfevPg";

// --- 1) Onay ---
{
  const out = run([update(`px:approve:${RID}`)]);
  check("onay → 1 öğe", out.length, 1);
  check("onay → approve=true", out[0].json.approve, true);
  check("onay → requestId", out[0].json.requestId, RID);
  check("onay → decidedBy", out[0].json.decidedBy, "telegram:@omercataloglu");
  check("onay → chatId", out[0].json.chatId, CHAT);
  check("onay → messageId", out[0].json.messageId, 999);
  check("onay → callbackQueryId", out[0].json.callbackQueryId, "cb-test-1");
}

// --- 2) Red ---
{
  const out = run([update(`px:reject:${RID}`)]);
  check("red → approve=false", out[0].json.approve, false);
  check("red → requestId", out[0].json.requestId, RID);
}

// --- 3) Yabancı callback (başka botun butonu) yok sayılır ---
{
  const out = run([update("baska-bot:veri")]);
  check("yabancı callback yok sayılır", out.length, 0);
}

// --- 4) callback_query olmayan güncelleme yok sayılır ---
{
  const out = run([{ json: { update_id: 1, message: { text: "merhaba" } } }]);
  check("mesaj güncellemesi yok sayılır", out.length, 0);
}

// --- 5) Bozuk veri yok sayılır ---
{
  check("boş data", run([update("")]).length, 0);
  check("px: eksik karar", run([update("px:")]).length, 0);
  check("geçersiz karar", run([update("px:belki:" + RID)]).length, 0);
  check("kimliksiz", run([update("px:approve:")]).length, 0);
}

// --- 6) Kullanıcı adı olmayan yönetici ---
{
  const out = run([
    update(`px:approve:${RID}`, {
      from: { id: 555, is_bot: false, first_name: "Anonim" },
    }),
  ]);
  check("kullanıcı adı yoksa id kullanılır", out[0].json.decidedBy, "telegram:555");
}

// --- 7) Çoklu öğe ---
{
  const out = run([
    update(`px:approve:${RID}`),
    update(`px:reject:digerKimlik123`),
    { json: { update_id: 3 } },
  ]);
  check("çoklu: 2 geçerli", out.length, 2);
  check("çoklu: 1. onay", out[0].json.approve, true);
  check("çoklu: 2. red", out[1].json.approve, false);
  check("çoklu: 2. kimlik", out[1].json.requestId, "digerKimlik123");
}

// --- 8) Kimlikte özel karakter (base64url) korunur ---
{
  const tricky = "a-b_C9x.yZ";
  const out = run([update(`px:approve:${tricky}`)]);
  check("base64url kimlik korunur", out[0].json.requestId, tricky);
}

// --- 9) Metinde iki nokta varsa birleştirilir ---
{
  const out = run([update("px:approve:bolum1:bolum2")]);
  check("iki nokta birleştirilir", out[0].json.requestId, "bolum1:bolum2");
}

console.log("");
console.log(`  SONUÇ: ${passed} geçti, ${failed} başarısız`);
console.log("");

process.exit(failed === 0 ? 0 : 1);

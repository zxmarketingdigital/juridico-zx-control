// ════════════════════════════════════════════════════════════════════════
// Smoke pós-instalação — checagem de sanidade SEM segredo em log (LGPD).
// Confere que as variáveis essenciais existem (não imprime os valores).
// Uso: node setup/smoke.mjs
// ════════════════════════════════════════════════════════════════════════

// O Worker usa estas três em runtime (a RLS aplica via JWT do usuário).
const OBRIGATORIAS = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "GEMINI_API_KEY"];
// Opcional: só é necessária se você aplicar migrations via CLI em vez do SQL Editor.
const OPCIONAIS = ["SUPABASE_SERVICE_KEY"];

let faltando = 0;
console.log("\n  Jurídico ZX Control — smoke de instalação\n");
for (const k of OBRIGATORIAS) {
  const ok = typeof process.env[k] === "string" && process.env[k].trim().length > 0;
  console.log(`   ${ok ? "✅" : "❌"} ${k}${ok ? "" : "  (ausente)"}`);
  if (!ok) faltando++;
}
for (const k of OPCIONAIS) {
  const ok = typeof process.env[k] === "string" && process.env[k].trim().length > 0;
  console.log(`   ${ok ? "✅" : "•"} ${k}  (opcional)`);
}

if (faltando > 0) {
  console.log(`\n  ${faltando} variável(is) faltando. Configure os segredos do Worker e rode de novo.\n`);
  process.exit(1);
}
console.log("\n  Tudo presente. Faça login no painel e rode um agente para confirmar ponta a ponta.\n");

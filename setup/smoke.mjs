// ════════════════════════════════════════════════════════════════════════
// Smoke pós-instalação — checagem de sanidade SEM segredo em log (LGPD).
// Confere que as variáveis essenciais existem (não imprime os valores).
// Uso: node setup/smoke.mjs
// ════════════════════════════════════════════════════════════════════════

const OBRIGATORIAS = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_KEY", "GEMINI_API_KEY"];

let faltando = 0;
console.log("\n  Jurídico ZX Control — smoke de instalação\n");
for (const k of OBRIGATORIAS) {
  const ok = typeof process.env[k] === "string" && process.env[k].trim().length > 0;
  console.log(`   ${ok ? "✅" : "❌"} ${k}${ok ? "" : "  (ausente)"}`);
  if (!ok) faltando++;
}

if (faltando > 0) {
  console.log(`\n  ${faltando} variável(is) faltando. Configure os segredos do Worker e rode de novo.\n`);
  process.exit(1);
}
console.log("\n  Tudo presente. Faça login no painel e rode um agente para confirmar ponta a ponta.\n");

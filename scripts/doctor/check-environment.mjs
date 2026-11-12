import { runAllChecks, statusRank, printChecks, tryExec } from "./checks.mjs";

function parseArgs(argv) {
  const args = { deep: false, fix: false, json: false };
  for (const a of argv) {
    if (a === "--") continue;
    if (a === "--deep") args.deep = true;
    else if (a === "--fix") args.fix = true;
    else if (a === "--json") args.json = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const checks = runAllChecks({ deep: args.deep });

  const corpusCheck = checks.find((c) => c.name.startsWith("Indice vectorizado"));
  if (args.fix && corpusCheck?.status !== "ok") {
    console.error("\nFix: regenerando el corpus vectorizado (rtk pnpm run vectorize:project)...\n");
    const fixRes = tryExec("pnpm run vectorize:project", 10 * 60 * 1000);
    checks.push({
      name: "Fix: vectorize:project",
      status: fixRes.ok ? "ok" : "fail",
      message: fixRes.ok ? "Corpus regenerado correctamente." : "Fallo la regeneracion.",
      hint: fixRes.ok ? null : fixRes.output,
    });
  }

  if (args.json) {
    console.log(JSON.stringify({ checks }, null, 2));
  } else {
    console.log("\nDoctor del entorno - sistema de agentes (AI-SDD-Seed)\n");
    printChecks(checks);
  }

  const worst = checks.reduce((acc, c) => Math.min(acc, statusRank(c.status)), 2);
  const counts = checks.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, {});

  if (!args.json) {
    console.log(`\nResumen: ${counts.ok ?? 0} ok, ${counts.warn ?? 0} warn, ${counts.fail ?? 0} fail.\n`);
    if (worst === 0) {
      console.log("Hay checks criticos sin resolver. Revisa los hints de arriba.\n");
    } else if (worst === 1) {
      console.log("Entorno funcional con avisos. Revisa los hints si quieres afinar.\n");
    } else {
      console.log("Entorno listo para trabajar con el sistema de agentes.\n");
    }
    console.log("Tip: usa 'rtk pnpm run tooling' para un menu interactivo con Setup y Run.\n");
  }

  process.exit(worst === 0 ? 1 : 0);
}

main();

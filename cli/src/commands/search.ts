import TSA, { type SearchResult } from "torrent-search-api";
import { select } from "@inquirer/prompts";
import kleur from "kleur";
import ora from "ora";
import { playCommand } from "./play.js";

interface Options {
  provider: string;
  category: string;
  limit: string;
  player: string;
  port: string;
  print?: boolean;
}

// Public providers bundled with torrent-search-api. Users can pass --provider all
// or a comma-separated subset. Some go down periodically — that's fine, we skip them.
const DEFAULT_PROVIDERS = ["1337x", "ThePirateBay", "Yts", "TorrentProject", "Limetorrents", "Torrentz2"];

export async function searchCommand(query: string, opts: Options): Promise<void> {
  const providers =
    opts.provider === "all"
      ? DEFAULT_PROVIDERS
      : opts.provider.split(",").map((p) => p.trim()).filter(Boolean);

  TSA.disableAllProviders();
  for (const p of providers) {
    try {
      TSA.enableProvider(p);
    } catch {
      console.warn(kleur.yellow(`Skipping unknown provider: ${p}`));
    }
  }

  const active = TSA.getActiveProviders().map((p) => p.name);
  if (active.length === 0) throw new Error("No valid providers enabled.");

  const spin = ora(`Searching ${active.join(", ")} for "${query}"...`).start();
  let results: SearchResult[] = [];
  try {
    results = await TSA.search(active, query, opts.category, Number.parseInt(opts.limit, 10));
  } catch (err) {
    spin.fail(`Search failed: ${(err as Error).message}`);
    process.exit(1);
  }

  if (results.length === 0) {
    spin.fail("No results found.");
    process.exit(1);
  }

  // Sort by seeds desc; unknown seeds sink to bottom
  results.sort((a, b) => toNum(b.seeds) - toNum(a.seeds));
  spin.succeed(`Found ${results.length} results`);

  if (opts.print) {
    for (const r of results) console.log(formatRow(r));
    return;
  }

  const choice = await select({
    message: "Pick a torrent to stream:",
    pageSize: 15,
    choices: results.map((r, i) => ({
      name: formatRow(r),
      value: i,
    })),
  });

  const picked = results[choice];
  const magnetSpin = ora("Fetching magnet link...").start();
  let magnet: string;
  try {
    magnet = picked.magnet && picked.magnet.startsWith("magnet:")
      ? picked.magnet
      : await TSA.getMagnet(picked);
  } catch (err) {
    magnetSpin.fail(`Could not resolve magnet: ${(err as Error).message}`);
    process.exit(1);
  }
  if (!magnet || !magnet.startsWith("magnet:")) {
    magnetSpin.fail("Provider returned no usable magnet link.");
    process.exit(1);
  }
  magnetSpin.succeed("Magnet resolved");

  await playCommand(magnet, {
    player: opts.player,
    port: opts.port,
    quitOnExit: true,
  });
}

function toNum(v: number | string | undefined): number {
  if (typeof v === "number") return v;
  if (!v) return 0;
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : 0;
}

function formatRow(r: SearchResult): string {
  const seeds = kleur.green(String(toNum(r.seeds)).padStart(5));
  const peers = kleur.red(String(toNum(r.peers)).padStart(5));
  const size = kleur.yellow((r.size ?? "?").toString().padEnd(10));
  const prov = kleur.dim((r.provider ?? "?").padEnd(14));
  return `S:${seeds} P:${peers} ${size} ${prov} ${r.title}`;
}

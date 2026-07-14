import WebTorrent from "webtorrent";
import kleur from "kleur";
import ora from "ora";
import prettyBytes from "pretty-bytes";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { launchPlayer, type PlayerName } from "../lib/player.js";

interface Options {
  player: string;
  port: string;
  file?: string;
  list?: boolean;
  quitOnExit: boolean;
}

const VIDEO_EXT = /\.(mp4|mkv|webm|avi|mov|m4v|ts|flv|wmv|mpg|mpeg)$/i;

export async function playCommand(source: string, opts: Options): Promise<void> {
  const port = Number.parseInt(opts.port, 10);
  const player = opts.player as PlayerName;
  if (!["mpv", "vlc", "none"].includes(player)) {
    throw new Error(`Invalid --player value: ${opts.player}`);
  }

  const torrentId = await resolveSource(source);
  const client = new WebTorrent();

  const cleanup = async (code = 0) => {
    await new Promise<void>((r) => client.destroy(() => r()));
    process.exit(code);
  };
  process.on("SIGINT", () => cleanup(0));
  process.on("SIGTERM", () => cleanup(0));

  const spin = ora("Fetching torrent metadata...").start();

  client.on("error", (err) => {
    spin.fail(`WebTorrent error: ${err instanceof Error ? err.message : String(err)}`);
    void cleanup(1);
  });

  const torrent = client.add(torrentId);

  torrent.on("ready", () => {
    spin.succeed(kleur.green(`Connected: ${torrent.name}`));

    if (opts.list) {
      console.log(kleur.bold("\nFiles:"));
      torrent.files.forEach((f, i) => {
        console.log(`  ${kleur.cyan(String(i).padStart(2))}  ${prettyBytes(f.length).padStart(10)}  ${f.name}`);
      });
      void cleanup(0);
      return;
    }

    const idx = pickFileIndex(torrent.files, opts.file);
    if (idx < 0) {
      console.error(kleur.red("No playable video file found in this torrent."));
      void cleanup(1);
      return;
    }

    const file = torrent.files[idx];
    torrent.files.forEach((f, i) => f.deselect?.() ?? (i !== idx && (f as any).deselect?.()));
    file.select();

    const server = (torrent as any).createServer();
    server.listen(port, async () => {
      const url = `http://127.0.0.1:${port}/${idx}`;
      console.log(kleur.bold("\nStreaming:"), kleur.magenta(file.name));
      console.log(kleur.dim(`Size: ${prettyBytes(file.length)}  |  URL: ${url}`));
      console.log(kleur.dim("Buffering to give the player a head start..."));

      // Wait until at least ~5MB or 2% is downloaded before handing to player
      await waitForBuffer(torrent, file);

      startProgress(torrent, file);

      try {
        const child = await launchPlayer(player, url);
        if (child && opts.quitOnExit) {
          await child;
          console.log(kleur.dim("\nPlayer closed. Shutting down."));
          void cleanup(0);
        }
      } catch (err) {
        console.error(kleur.red((err as Error).message));
        void cleanup(1);
      }
    });
  });
}

async function resolveSource(src: string): Promise<string | Buffer> {
  if (src.startsWith("magnet:")) return src;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  const abs = resolve(src);
  if (existsSync(abs)) return await readFile(abs);
  throw new Error(`Source not recognized: ${src}`);
}

function pickFileIndex(files: WebTorrent.TorrentFile[], hint?: string): number {
  if (hint !== undefined) {
    const n = Number.parseInt(hint, 10);
    if (Number.isInteger(n) && n >= 0 && n < files.length) return n;
    throw new Error(`--file ${hint} is out of range (0..${files.length - 1})`);
  }
  let best = -1;
  let bestSize = 0;
  files.forEach((f, i) => {
    if (VIDEO_EXT.test(f.name) && f.length > bestSize) {
      best = i;
      bestSize = f.length;
    }
  });
  return best;
}

function waitForBuffer(torrent: WebTorrent.Torrent, file: WebTorrent.TorrentFile): Promise<void> {
  const target = Math.min(5 * 1024 * 1024, Math.floor(file.length * 0.02));
  return new Promise((res) => {
    const check = () => {
      if (file.downloaded >= target || torrent.done) {
        torrent.removeListener("download", check);
        res();
      }
    };
    torrent.on("download", check);
    check();
  });
}

function startProgress(torrent: WebTorrent.Torrent, file: WebTorrent.TorrentFile): void {
  const tick = () => {
    const pct = ((file.downloaded / file.length) * 100).toFixed(1);
    const line = `  ${kleur.green("▼")} ${prettyBytes(torrent.downloadSpeed)}/s  ${kleur.blue("▲")} ${prettyBytes(torrent.uploadSpeed)}/s  peers ${torrent.numPeers}  ${pct}%   `;
    process.stdout.write(`\r${line}`);
  };
  setInterval(tick, 1000).unref();
}

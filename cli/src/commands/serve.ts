import http from "node:http";
import { URL } from "node:url";
import WebTorrent from "webtorrent";
import TSA, { type SearchResult } from "torrent-search-api";
import kleur from "kleur";
import prettyBytes from "pretty-bytes";
import { launchPlayer, type PlayerName } from "../lib/player.js";
import { INDEX_HTML } from "../lib/ui.js";

interface Options {
  port: string;
  streamPort: string;
  player: string;
  open: boolean;
}

const DEFAULT_PROVIDERS = ["1337x", "ThePirateBay", "Yts", "TorrentProject", "Limetorrents", "Torrentz2"];
const VIDEO_EXT = /\.(mp4|mkv|webm|avi|mov|m4v|ts|flv|wmv|mpg|mpeg)$/i;

interface ActiveStream {
  infoHash: string;
  name: string;
  files: { index: number; name: string; length: number }[];
  selectedIndex: number;
  url: string;
}

export async function serveCommand(opts: Options): Promise<void> {
  const port = Number.parseInt(opts.port, 10);
  const streamPort = Number.parseInt(opts.streamPort, 10);
  const player = opts.player as PlayerName;

  TSA.disableAllProviders();
  for (const p of DEFAULT_PROVIDERS) {
    try { TSA.enableProvider(p); } catch { /* skip */ }
  }

  const client = new WebTorrent();
  let streamServer: http.Server | null = null;
  let current: ActiveStream | null = null;

  const ensureStreamServer = (): http.Server => {
    if (streamServer) return streamServer;
    streamServer = (client as any).createServer();
    streamServer!.listen(streamPort);
    return streamServer!;
  };

  const stopCurrent = async () => {
    if (!current) return;
    await new Promise<void>((r) => {
      const t = client.get(current!.infoHash) as any;
      if (!t) return r();
      client.remove(t, {}, () => r());
    });
    current = null;
  };

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

      if (req.method === "GET" && url.pathname === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(INDEX_HTML);
        return;
      }

      if (req.method === "POST" && url.pathname === "/api/search") {
        const body = await readJson(req);
        const query = String(body.query ?? "").trim();
        if (!query) return sendJson(res, 400, { error: "query required" });
        const category = String(body.category ?? "All");
        const limit = Number.parseInt(String(body.limit ?? "20"), 10);
        const active = TSA.getActiveProviders().map((p) => p.name);
        const results = await TSA.search(active, query, category, limit);
        results.sort((a, b) => toNum(b.seeds) - toNum(a.seeds));
        return sendJson(res, 200, {
          results: results.map((r: SearchResult) => ({
            title: r.title,
            seeds: toNum(r.seeds),
            peers: toNum(r.peers),
            size: r.size ?? "?",
            provider: r.provider ?? "?",
            magnet: r.magnet ?? null,
            id: (r as any).id ?? null,
            link: r.link ?? null,
          })),
        });
      }

      if (req.method === "POST" && url.pathname === "/api/magnet") {
        const body = await readJson(req);
        const magnet = await TSA.getMagnet(body as SearchResult);
        return sendJson(res, 200, { magnet });
      }

      if (req.method === "POST" && url.pathname === "/api/play") {
        const body = await readJson(req);
        const source = String(body.source ?? "").trim();
        if (!source) return sendJson(res, 400, { error: "source required" });
        await stopCurrent();
        const stream = await addTorrent(client, source, ensureStreamServer, streamPort);
        current = stream;
        return sendJson(res, 200, stream);
      }

      if (req.method === "POST" && url.pathname === "/api/select") {
        const body = await readJson(req);
        if (!current) return sendJson(res, 400, { error: "no active torrent" });
        const idx = Number.parseInt(String(body.index ?? "-1"), 10);
        if (!Number.isInteger(idx) || idx < 0 || idx >= current.files.length) {
          return sendJson(res, 400, { error: "invalid index" });
        }
        const t = client.get(current.infoHash) as any;
        if (!t) return sendJson(res, 400, { error: "torrent gone" });
        t.files.forEach((f) => f.deselect?.());
        t.files[idx].select();
        current.selectedIndex = idx;
        current.url = `http://127.0.0.1:${streamPort}/${idx}`;
        return sendJson(res, 200, current);
      }

      if (req.method === "POST" && url.pathname === "/api/launch") {
        const body = await readJson(req);
        const streamUrl = String(body.url ?? current?.url ?? "");
        if (!streamUrl) return sendJson(res, 400, { error: "no url" });
        launchPlayer(player, streamUrl).catch((e) =>
          console.error(kleur.red("Player failed:"), e.message),
        );
        return sendJson(res, 200, { ok: true, player });
      }

      if (req.method === "GET" && url.pathname === "/api/status") {
        if (!current) return sendJson(res, 200, { active: false });
        const t = client.get(current.infoHash) as any;
        if (!t) return sendJson(res, 200, { active: false });
        const file = t.files[current.selectedIndex];
        return sendJson(res, 200, {
          active: true,
          name: current.name,
          file: file.name,
          progress: file.length ? file.downloaded / file.length : 0,
          downloadSpeed: t.downloadSpeed,
          uploadSpeed: t.uploadSpeed,
          peers: t.numPeers,
          downloaded: file.downloaded,
          length: file.length,
          url: current.url,
        });
      }

      if (req.method === "POST" && url.pathname === "/api/stop") {
        await stopCurrent();
        return sendJson(res, 200, { ok: true });
      }

      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
    } catch (err) {
      console.error(kleur.red("Server error:"), err);
      sendJson(res, 500, { error: (err as Error).message });
    }
  });

  const cleanup = async (code = 0) => {
    server.close();
    streamServer?.close();
    await new Promise<void>((r) => client.destroy(() => r()));
    process.exit(code);
  };
  process.on("SIGINT", () => cleanup(0));
  process.on("SIGTERM", () => cleanup(0));

  server.listen(port, "127.0.0.1", () => {
    const uiUrl = `http://127.0.0.1:${port}`;
    console.log(kleur.green("✔ torflix web UI ready"));
    console.log(`  ${kleur.bold("Open:")} ${kleur.cyan(uiUrl)}`);
    console.log(kleur.dim(`  Stream port: ${streamPort}  |  Player: ${player}`));
    console.log(kleur.dim("  Ctrl-C to stop."));
    if (opts.open) tryOpen(uiUrl);
  });
}

async function addTorrent(
  client: WebTorrent.Instance,
  source: string,
  ensureStreamServer: () => http.Server,
  streamPort: number,
): Promise<ActiveStream> {
  ensureStreamServer();
  return new Promise((resolve, reject) => {
    const t = client.add(source);
    t.once("error", reject);
    t.once("ready", () => {
      let idx = -1;
      let best = 0;
      t.files.forEach((f, i) => {
        if (VIDEO_EXT.test(f.name) && f.length > best) {
          best = f.length;
          idx = i;
        }
      });
      if (idx < 0) idx = 0;
      t.files.forEach((f) => f.deselect?.());
      t.files[idx].select();
      resolve({
        infoHash: t.infoHash,
        name: t.name,
        files: t.files.map((f, i) => ({ index: i, name: f.name, length: f.length })),
        selectedIndex: idx,
        url: `http://127.0.0.1:${streamPort}/${idx}`,
      });
    });
  });
}

function readJson(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

function toNum(v: number | string | undefined): number {
  if (typeof v === "number") return v;
  if (!v) return 0;
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : 0;
}

function tryOpen(url: string) {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  import("node:child_process").then(({ spawn }) => {
    spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref();
  }).catch(() => { /* ignore */ });
}

// re-export prettyBytes so tsc doesn't drop the (currently unused) import warning
export { prettyBytes };

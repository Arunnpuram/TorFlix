#!/usr/bin/env node
import { Command } from "commander";
import kleur from "kleur";
import { playCommand } from "./commands/play.js";
import { searchCommand } from "./commands/search.js";
import { serveCommand } from "./commands/serve.js";

const program = new Command();

program
  .name("torflix")
  .description("Stream torrents into MPV / VLC. Paste a magnet, watch a movie.")
  .version("0.1.0");

program
  .command("play")
  .description("Stream a magnet link or .torrent URL/path straight into your video player.")
  .argument("<source>", "magnet: URI, http(s) URL to a .torrent, or path to a local .torrent")
  .option("-p, --player <player>", "player to launch: mpv | vlc | none", "mpv")
  .option("-P, --port <port>", "local streaming HTTP port", "8888")
  .option("-f, --file <index>", "file index inside multi-file torrent (default: largest video)")
  .option("--list", "list files in the torrent and exit (no playback)")
  .option("--no-quit-on-exit", "keep seeding after the player closes")
  .action(playCommand);

program
  .command("search")
  .description("Search torrent providers, pick a result interactively, and stream it.")
  .argument("<query>", "search query, e.g. \"the matrix 1999 1080p\"")
  .option("--provider <providers>", "comma-separated providers or 'all' (1337x,ThePirateBay,Yts,TorrentProject,Limetorrents,Torrentz2)", "all")
  .option("-c, --category <category>", "provider category (Movies, TV, Anime, All)", "All")
  .option("-n, --limit <n>", "max results per provider", "20")
  .option("-p, --player <player>", "player to launch: mpv | vlc | none", "mpv")
  .option("-P, --port <port>", "local streaming HTTP port", "8888")
  .option("--print", "print results and exit (no interactive picker)")
  .action(searchCommand);

program
  .command("serve")
  .description("Start the local web UI (paste box + search + poster list) at 127.0.0.1.")
  .option("-p, --port <port>", "web UI port", "8000")
  .option("-S, --stream-port <port>", "internal torrent stream port", "8888")
  .option("--player <player>", "player to launch when you click Play: mpv | vlc | none", "mpv")
  .option("--no-open", "do not auto-open the browser")
  .action(serveCommand);


program.on("command:*", (args) => {
  console.error(kleur.red(`Unknown command: ${args[0]}`));
  program.help({ error: true });
});

program.parseAsync(process.argv).catch((err) => {
  console.error(kleur.red("Fatal:"), err?.message ?? err);
  process.exit(1);
});

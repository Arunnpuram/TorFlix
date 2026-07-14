# torflix

Stream any torrent (magnet link or `.torrent`) straight into **MPV** or **VLC** from your terminal. No downloads left behind, no browser plugin, no signup.

Inspired by [torflix](https://github.com/jainanuj7/torflix). This is **Phase 1** — the CLI. Search providers and a local web UI ship in phases 2 and 3.

## Install

Requires **Node.js ≥ 20** and **mpv** (recommended) or **vlc**.

```bash
# from source
git clone https://github.com/<you>/torflix.git
cd torflix/cli
npm install
npm run build
npm link           # exposes the `torflix` command globally
```

Install a player:

```bash
# Debian / Ubuntu
sudo apt install mpv          # or: sudo apt install vlc

# Arch
sudo pacman -S mpv

# Fedora
sudo dnf install mpv
```

## Usage

```bash
# Paste a magnet, MPV opens automatically once the buffer is ready
torflix play "magnet:?xt=urn:btih:..."

# Or a .torrent URL / local file
torflix play https://example.com/movie.torrent
torflix play ./movie.torrent

# Multi-file torrent? List first, then pick
torflix play "magnet:?..." --list
torflix play "magnet:?..." --file 3

# Prefer VLC
torflix play "magnet:?..." --player vlc

# Just print the local stream URL (open anywhere)
torflix play "magnet:?..." --player none
```

## How it works

`torflix` runs an ephemeral [WebTorrent](https://webtorrent.io/) node in your terminal, exposes the selected video file over `http://127.0.0.1:8888/<index>`, waits for a small buffer, then execs `mpv <url>`. When the player closes, torflix shuts down and nothing is written to disk beyond the OS temp dir.


## Legal

You are responsible for what you stream. Only use with content you have the right to access.

## License

MIT

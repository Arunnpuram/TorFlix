import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: Landing,
});

const INSTALL = `git clone https://github.com/Arunnpuram/torflix.git
cd torflix/cli
npm install && npm run build && npm link`;

function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/60 p-4 text-sm leading-relaxed text-zinc-100">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="absolute right-2 top-2 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300 opacity-0 transition group-hover:opacity-100 hover:bg-white/10"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#1a1030,_#07080b_60%)] text-zinc-100">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-violet-500 shadow-[0_0_12px] shadow-violet-500" />
          <span className="text-lg font-semibold tracking-tight">torflix</span>
        </div>
        <nav className="flex items-center gap-5 text-sm text-zinc-400">
          <a href="#install" className="hover:text-white">Install</a>
          <a href="#usage" className="hover:text-white">Usage</a>
          
          <a
            href="https://github.com/Arunnpuram/torflix"
            className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 hover:bg-white/10"
          >
            GitHub
          </a>
        </nav>
      </header>

      <section className="mx-auto max-w-5xl px-6 pt-16 pb-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Paste a magnet. <span className="bg-gradient-to-r from-violet-400 to-cyan-300 bg-clip-text text-transparent">Watch a movie.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
          torflix is a tiny Node.js CLI that streams torrents straight into MPV or VLC.
          No downloads left behind, no browser plugin, no signup. Search six providers or
          drop a magnet — it hands off to your player in seconds.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <a
            href="#install"
            className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-zinc-200"
          >
            Get started
          </a>
          <a
            href="https://github.com/Arunnpuram/torflix"
            className="rounded-lg border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
          >
            View on GitHub →
          </a>
        </div>

        <div className="mx-auto mt-12 max-w-2xl text-left">
          <CopyBlock code={`torflix play "magnet:?xt=urn:btih:..."`} />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { t: "Zero downloads", d: "Streams while it downloads. Buffer 5 MB and mpv opens automatically." },
            { t: "Search built-in", d: "1337x, TPB, YTS, Nyaa-adjacent — pick a result, hit enter, done." },
            { t: "Local web UI", d: "torflix serve gives you a paste-and-play page at 127.0.0.1:8000." },
          ].map((f) => (
            <div key={f.t} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <div className="text-sm font-semibold text-white">{f.t}</div>
              <div className="mt-2 text-sm text-zinc-400">{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="install" className="mx-auto max-w-3xl px-6 pb-20">
        <h2 className="text-2xl font-bold">Install</h2>
        <p className="mt-2 text-zinc-400">Requires Node.js ≥ 20 and MPV (or VLC).</p>
        <div className="mt-4"><CopyBlock code={INSTALL} /></div>
        <p className="mt-4 text-sm text-zinc-500">
          On Debian/Ubuntu: <code className="rounded bg-white/10 px-1">sudo apt install mpv</code>
        </p>
      </section>

      <section id="usage" className="mx-auto max-w-3xl px-6 pb-20">
        <h2 className="text-2xl font-bold">Usage</h2>
        <div className="mt-4 space-y-4">
          <div>
            <div className="mb-2 text-sm font-semibold text-zinc-300">Paste a magnet</div>
            <CopyBlock code={`torflix play "magnet:?xt=urn:btih:..."`} />
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold text-zinc-300">Search providers</div>
            <CopyBlock code={`torflix search "the matrix 1999 1080p"`} />
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold text-zinc-300">Local web UI</div>
            <CopyBlock code={`torflix serve   # opens http://127.0.0.1:8000`} />
          </div>
        </div>
      </section>


      <footer className="border-t border-white/5 py-8 text-center text-sm text-zinc-500">
        MIT · You are responsible for what you stream.
      </footer>
    </div>
  );
}

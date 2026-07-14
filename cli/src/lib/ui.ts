// Inline single-file UI served by `torflix serve`. Kept dependency-free
// (vanilla HTML/JS) so we don't need a build step for the CLI package.
export const INDEX_HTML = /* html */ `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>torflix — local</title>
<style>
  :root { color-scheme: dark; --bg:#0b0d10; --panel:#14181d; --line:#232a33; --fg:#e6edf3; --mut:#8b98a5; --acc:#7c5cff; --ok:#3fb950; --warn:#d29922; }
  * { box-sizing: border-box; }
  body { margin:0; font: 15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; background:var(--bg); color:var(--fg); }
  header { padding: 20px 28px; border-bottom:1px solid var(--line); display:flex; align-items:center; gap:12px; }
  header h1 { margin:0; font-size:18px; letter-spacing:.5px; }
  header .dot { width:10px; height:10px; border-radius:50%; background:var(--acc); box-shadow:0 0 10px var(--acc); }
  main { max-width: 960px; margin: 0 auto; padding: 28px; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:20px; margin-bottom:20px; }
  .card h2 { margin:0 0 12px; font-size:14px; text-transform:uppercase; letter-spacing:1px; color:var(--mut); }
  .row { display:flex; gap:8px; }
  input, button, select { font: inherit; border-radius:8px; border:1px solid var(--line); background:#0f1216; color:var(--fg); padding:10px 12px; }
  input { flex:1; min-width:0; }
  button { background:var(--acc); border-color:var(--acc); color:#fff; cursor:pointer; font-weight:600; }
  button.secondary { background:transparent; color:var(--fg); }
  button:disabled { opacity:.5; cursor:not-allowed; }
  table { width:100%; border-collapse: collapse; font-size:14px; }
  th, td { text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); }
  th { color:var(--mut); font-weight:500; font-size:12px; text-transform:uppercase; letter-spacing:1px; }
  tr:hover td { background:#0f1216; cursor:pointer; }
  .seeds { color:var(--ok); font-variant-numeric:tabular-nums; }
  .peers { color:var(--warn); font-variant-numeric:tabular-nums; }
  .muted { color:var(--mut); }
  .status { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
  .stat { background:#0f1216; border:1px solid var(--line); border-radius:8px; padding:12px; }
  .stat .label { color:var(--mut); font-size:12px; text-transform:uppercase; letter-spacing:1px; }
  .stat .val { font-size:18px; font-weight:600; font-variant-numeric:tabular-nums; margin-top:4px; }
  .bar { height:6px; background:#0f1216; border-radius:4px; overflow:hidden; margin-top:12px; border:1px solid var(--line); }
  .bar > div { height:100%; background:linear-gradient(90deg,var(--acc),#00d4ff); transition:width .5s; }
  .files li { padding:6px 8px; border-radius:6px; cursor:pointer; list-style:none; display:flex; justify-content:space-between; gap:12px; }
  .files li:hover { background:#0f1216; }
  .files li.active { background:rgba(124,92,255,.15); color:#fff; }
  .files ul { padding:0; margin:0; max-height:220px; overflow:auto; }
  .hint { font-size:12px; color:var(--mut); margin-top:8px; }
  a { color:#7cc4ff; }
</style>
</head>
<body>
<header><span class="dot"></span><h1>torflix</h1><span class="muted" style="margin-left:auto;font-size:13px">local · 127.0.0.1</span></header>
<main>

  <div class="card">
    <h2>Paste magnet or .torrent URL</h2>
    <div class="row">
      <input id="magnet" placeholder="magnet:?xt=urn:btih:… or https://…/file.torrent" />
      <button id="playBtn">Play</button>
    </div>
    <div class="hint">Buffers a few MB, then launches your player.</div>
  </div>

  <div class="card">
    <h2>Search providers</h2>
    <div class="row">
      <input id="query" placeholder="the matrix 1999 1080p" />
      <select id="category">
        <option>All</option><option>Movies</option><option>TV</option><option>Anime</option>
      </select>
      <button id="searchBtn" class="secondary">Search</button>
    </div>
    <div id="results" style="margin-top:14px"></div>
  </div>

  <div class="card" id="playerCard" style="display:none">
    <h2>Now streaming</h2>
    <div id="nowName" style="font-weight:600; margin-bottom:8px"></div>
    <div class="status">
      <div class="stat"><div class="label">Progress</div><div class="val" id="pct">0%</div></div>
      <div class="stat"><div class="label">↓ Speed</div><div class="val" id="dspeed">–</div></div>
      <div class="stat"><div class="label">↑ Speed</div><div class="val" id="uspeed">–</div></div>
      <div class="stat"><div class="label">Peers</div><div class="val" id="peers">0</div></div>
    </div>
    <div class="bar"><div id="progBar" style="width:0%"></div></div>
    <div class="row" style="margin-top:14px">
      <button id="launchBtn">Launch player</button>
      <button id="copyBtn" class="secondary">Copy stream URL</button>
      <button id="stopBtn" class="secondary" style="margin-left:auto">Stop</button>
    </div>
    <div class="files" style="margin-top:14px"><div class="label muted" style="margin-bottom:6px">Files</div><ul id="fileList"></ul></div>
  </div>

</main>
<script>
const $ = (id) => document.getElementById(id);
const fmt = (b) => { if (!b) return "0 B"; const u=["B","KB","MB","GB","TB"]; let i=0; while (b>=1024&&i<4){b/=1024;i++;} return b.toFixed(b>=10?0:1)+" "+u[i]; };
const api = async (path, body) => {
  const res = await fetch(path, body ? { method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify(body) } : {});
  if (!res.ok) throw new Error((await res.json()).error || res.statusText);
  return res.json();
};

async function play(source) {
  $("playBtn").disabled = true; $("playBtn").textContent = "Fetching…";
  try {
    const data = await api("/api/play", { source });
    showPlayer(data);
    await api("/api/launch", {});
  } catch (e) { alert(e.message); }
  finally { $("playBtn").disabled = false; $("playBtn").textContent = "Play"; }
}

function showPlayer(data) {
  $("playerCard").style.display = "block";
  $("nowName").textContent = data.name;
  const ul = $("fileList"); ul.innerHTML = "";
  data.files.forEach((f) => {
    const li = document.createElement("li");
    if (f.index === data.selectedIndex) li.className = "active";
    li.innerHTML = \`<span>\${f.name}</span><span class="muted">\${fmt(f.length)}</span>\`;
    li.onclick = async () => { await api("/api/select", { index: f.index }); showPlayer({ ...data, selectedIndex: f.index }); };
    ul.appendChild(li);
  });
}

async function poll() {
  try {
    const s = await api("/api/status");
    if (!s.active) return;
    const pct = Math.round((s.progress || 0) * 100);
    $("pct").textContent = pct + "%";
    $("progBar").style.width = pct + "%";
    $("dspeed").textContent = fmt(s.downloadSpeed) + "/s";
    $("uspeed").textContent = fmt(s.uploadSpeed) + "/s";
    $("peers").textContent = s.peers;
  } catch {}
}
setInterval(poll, 1000);

$("playBtn").onclick = () => { const v = $("magnet").value.trim(); if (v) play(v); };
$("magnet").addEventListener("keydown", (e) => { if (e.key === "Enter") $("playBtn").click(); });
$("launchBtn").onclick = () => api("/api/launch", {}).catch((e) => alert(e.message));
$("stopBtn").onclick = async () => { await api("/api/stop", {}); $("playerCard").style.display = "none"; };
$("copyBtn").onclick = async () => {
  const s = await api("/api/status"); if (s.url) { await navigator.clipboard.writeText(s.url); $("copyBtn").textContent = "Copied!"; setTimeout(() => $("copyBtn").textContent = "Copy stream URL", 1200); }
};

$("searchBtn").onclick = async () => {
  const query = $("query").value.trim(); if (!query) return;
  const category = $("category").value;
  const box = $("results"); box.innerHTML = '<div class="muted">Searching…</div>';
  try {
    const { results } = await api("/api/search", { query, category, limit: 20 });
    if (!results.length) { box.innerHTML = '<div class="muted">No results.</div>'; return; }
    const rows = results.map((r, i) => \`<tr data-i="\${i}"><td class="seeds">\${r.seeds}</td><td class="peers">\${r.peers}</td><td class="muted">\${r.size}</td><td class="muted">\${r.provider}</td><td>\${r.title}</td></tr>\`).join("");
    box.innerHTML = \`<table><thead><tr><th>S</th><th>P</th><th>Size</th><th>Provider</th><th>Title</th></tr></thead><tbody>\${rows}</tbody></table>\`;
    box.querySelectorAll("tbody tr").forEach((tr) => {
      tr.onclick = async () => {
        const r = results[+tr.dataset.i];
        let magnet = r.magnet;
        if (!magnet || !magnet.startsWith("magnet:")) {
          tr.style.opacity = ".5";
          try { magnet = (await api("/api/magnet", r)).magnet; } catch (e) { alert(e.message); tr.style.opacity = "1"; return; }
        }
        play(magnet);
      };
    });
  } catch (e) { box.innerHTML = '<div class="muted">Error: '+ e.message +'</div>'; }
};
$("query").addEventListener("keydown", (e) => { if (e.key === "Enter") $("searchBtn").click(); });
</script>
</body>
</html>`;

import { execa, type ResultPromise } from "execa";
import kleur from "kleur";

export type PlayerName = "mpv" | "vlc" | "none";

/**
 * Launch the chosen player pointed at a local HTTP stream URL.
 * Returns the child process (or null if player = "none").
 * On mpv failure we transparently fall back to vlc.
 */
export async function launchPlayer(
  player: PlayerName,
  url: string,
): Promise<ResultPromise | null> {
  if (player === "none") {
    console.log(kleur.cyan("Stream URL:"), url);
    console.log(kleur.dim("Open it in any player. Ctrl-C here to stop seeding."));
    return null;
  }

  const tryOne = async (bin: string, args: string[]): Promise<ResultPromise | null> => {
    try {
      const child = execa(bin, args, { stdio: "inherit", reject: false });
      // Give the binary ~200ms to fail-fast on ENOENT
      await new Promise((r) => setTimeout(r, 200));
      if (child.exitCode !== null && child.exitCode !== 0) return null;
      return child;
    } catch {
      return null;
    }
  };

  if (player === "mpv") {
    const child = await tryOne("mpv", ["--force-window=immediate", url]);
    if (child) return child;
    console.log(kleur.yellow("mpv not found or failed, falling back to vlc..."));
    const vlc = await tryOne("vlc", [url]);
    if (vlc) return vlc;
    throw new Error("Neither mpv nor vlc is installed. Install one, or use --player none.");
  }

  const vlc = await tryOne("vlc", [url]);
  if (!vlc) throw new Error("vlc not found. Install vlc, or use --player none / --player mpv.");
  return vlc;
}

import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Config } from "@remotion/cli/config";

// The headless shell Remotion downloads aborts on this Mac (icudtl.dat not found in bundle), so
// use the one Playwright already installed for the repo's scripts. The opening is a 2D canvas:
// software GL is enough, and --gl=angle aborts the same way.
const cache = join(homedir(), "Library/Caches/ms-playwright");
const shell = existsSync(cache)
  ? readdirSync(cache)
      .filter((d) => d.startsWith("chromium_headless_shell-"))
      .sort()
      .map((d) => join(cache, d, "chrome-headless-shell-mac-arm64/chrome-headless-shell"))
      .filter((p) => existsSync(p))
      .pop()
  : undefined;
if (shell) Config.setBrowserExecutable(shell);
Config.setChromiumOpenGlRenderer("swangle");

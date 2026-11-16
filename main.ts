// NAGA KECIL — a tiny dragon defends its nest.
//
// This is the submission entrypoint for our best-game-01 entry. The game
// itself lives in the game/ folder next to this file: a small baby dragon
// guards its nest against wave after wave of intruders. There are eight
// waves in total, each one busier and faster than the last, and the run
// ends with a Dragon Slayer boss who wants the nest for himself.
//
// The dragon fights with fire breath. Holding the breath down pours out
// flames, but the breath builds heat, and an overheated dragon cannot
// breathe fire again until it cools off — so the player has to feather
// the flame, pick the right moments, and keep moving between bursts.
// Between waves the nest can be tended, eggs can be kept safe, and the
// score climbs with every intruder driven off.
//
// What this file does is deliberately small: it is only the packer. It
// gathers the finished game and its screenshots from this repository,
// places them in the output directory the grader reads, and asks the
// vendored make.fun helper to write the dossier summary (dossier.json)
// that the judge reads first. It never touches the game logic, it never
// changes a screenshot, and it never talks to the network — it just
// copies files and writes one summary, so the entry handed in is exactly
// the game we built and played locally.
//
// How to run it by hand: from this folder, run `node main.ts`. When the
// grader runs it, the output goes to /output. Anywhere else, setting
// MAKEFUN_OUTPUT_DIR points it at a folder of your choice instead.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outputDir, 'game'), { recursive: true });
mkdirSync(join(outputDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });
}

// Caps the scorer itself enforces: the text budget shapes the dossier
// bytes, and the rest reject an entry the scorer would turn away — too
// many screenshots, one screenshot too large, too many game files, a
// game folder too large in total, or a game path that is too long.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

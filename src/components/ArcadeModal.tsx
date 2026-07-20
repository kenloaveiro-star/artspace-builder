import { lazy, Suspense, useState } from "react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { DifficultyProvider, getDifficultyConfig, type GameDifficultyConfig } from "@/contexts/DifficultyContext";
import { ArcadeExitProvider } from "@/lib/arcade-exit";
import { games } from "@/lib/gameData";
import { X } from "lucide-react";

type GameId =
  | "memory" | "2048" | "snake" | "tictactoe" | "flappy" | "clicker"
  | "tetris" | "breakout" | "dino" | "bubble" | "pong" | "simon"
  | "spaceinvaders" | "pacman" | "fruitninja";

// Lazy-loaded so all 15 games don't ship in the home bundle.
const GAME_LOADERS: Record<GameId, ReturnType<typeof lazy>> = {
  memory: lazy(() => import("@/games/MemoryGame")),
  "2048": lazy(() => import("@/games/Game2048")),
  snake: lazy(() => import("@/games/SnakeGame")),
  tictactoe: lazy(() => import("@/games/TicTacToe")),
  flappy: lazy(() => import("@/games/FlappyBird")),
  clicker: lazy(() => import("@/games/ClickerGame")),
  tetris: lazy(() => import("@/games/TetrisGame")),
  breakout: lazy(() => import("@/games/BreakoutGame")),
  dino: lazy(() => import("@/games/DinoGame")),
  bubble: lazy(() => import("@/games/BubbleShooter")),
  pong: lazy(() => import("@/games/PongGame")),
  simon: lazy(() => import("@/games/SimonGame")),
  spaceinvaders: lazy(() => import("@/games/SpaceInvadersGame")),
  pacman: lazy(() => import("@/games/PacManGame")),
  fruitninja: lazy(() => import("@/games/FruitNinjaGame")),
};

// Bright kid-friendly card gradients keyed to gameData.color labels.
const CARD_GRADIENTS: Record<string, string> = {
  "neon-pink": "from-pink-300 to-pink-500",
  "neon-orange": "from-orange-300 to-orange-500",
  "neon-green": "from-emerald-300 to-emerald-500",
  "neon-blue": "from-sky-300 to-sky-500",
  "neon-yellow": "from-yellow-300 to-yellow-500",
  "neon-purple": "from-purple-300 to-fuchsia-500",
};

interface ArcadeModalProps {
  onClose: () => void;
}

export function ArcadeModal({ onClose }: ArcadeModalProps) {
  const [selected, setSelected] = useState<GameId | null>(null);

  const config: GameDifficultyConfig = getDifficultyConfig("normal");
  const GameComponent = selected ? GAME_LOADERS[selected] : null;
  const selectedGame = selected ? games.find((g) => g.id === selected) : null;

  return (
    <LanguageProvider>
      <DifficultyProvider>
        <ArcadeExitProvider exit={() => setSelected(null)}>
          <div className="fixed inset-0 z-[100] flex flex-col bg-gradient-to-br from-purple-900 via-fuchsia-900 to-indigo-900">
            {/* Top bar */}
            <div className="flex items-center justify-between border-b-4 border-yellow-300/50 bg-black/40 px-4 py-3 backdrop-blur">
              <div className="flex items-center gap-3">
                {selected ? (
                  <button
                    onClick={() => setSelected(null)}
                    className="rounded-full bg-yellow-300 px-4 py-2 text-sm font-black text-purple-900 shadow-md transition active:scale-95"
                  >
                    ← 選遊戲
                  </button>
                ) : (
                  <div className="text-xl font-black text-yellow-300 drop-shadow">🎮 遊戲機中心</div>
                )}
              </div>
              <button
                onClick={onClose}
                aria-label="關閉"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Body */}
            {!selected ? (
              <div className="flex-1 overflow-auto p-4 sm:p-6">
                <p className="mb-4 text-center text-sm text-white/80">揀一個鍾意嘅遊戲玩啦!</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {games.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setSelected(g.id as GameId)}
                      className={
                        "group flex flex-col items-center rounded-3xl border-4 border-white/70 bg-gradient-to-br p-4 text-center shadow-xl transition-transform hover:scale-105 active:scale-95 " +
                        (CARD_GRADIENTS[g.color] ?? "from-pink-300 to-pink-500")
                      }
                    >
                      <div className="text-5xl drop-shadow group-hover:animate-bounce">{g.emoji}</div>
                      <div className="mt-2 text-sm font-black text-white drop-shadow">{g.name}</div>
                      <div className="mt-1 text-[10px] font-medium text-white/85">{g.nameEn}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="relative flex-1 overflow-auto bg-slate-950">
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center text-white">
                      <div className="text-center">
                        <div className="mb-3 text-6xl animate-bounce">{selectedGame?.emoji ?? "🎮"}</div>
                        <div className="text-lg font-bold">載入中…</div>
                      </div>
                    </div>
                  }
                >
                  {GameComponent && <GameComponent config={config} />}
                </Suspense>
              </div>
            )}
          </div>
        </ArcadeExitProvider>
      </DifficultyProvider>
    </LanguageProvider>
  );
}

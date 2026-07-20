import { useLanguage } from "@/contexts/LanguageContext";
import { useArcadeExit } from "@/lib/arcade-exit";
import { Home, Pause, Play, RotateCcw } from "lucide-react";

interface GameHeaderProps {
  score: number;
  highScore: number;
  timeLeft?: number;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  gameName: string;
}

const GameHeader: React.FC<GameHeaderProps> = ({
  score,
  highScore,
  timeLeft,
  isPaused,
  onPause,
  onResume,
  onRestart,
}) => {
  const { t } = useLanguage();
  const exit = useArcadeExit();

  return (
    <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-black/40 px-4 py-3 backdrop-blur">
      <button
        onClick={exit}
        aria-label={t("返回選單", "Back to menu")}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        <Home className="h-5 w-5" />
      </button>

      <div className="text-center">
        <div className="score-display neon-text text-2xl font-bold">
          {score.toLocaleString()}
        </div>
        <div className="text-xs text-white/60">
          {timeLeft !== undefined && <span className="mr-2">⏱️ {timeLeft}s</span>}
          {t("最高", "Best")}: {highScore.toLocaleString()}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onRestart}
          aria-label={t("重新開始", "Restart")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        >
          <RotateCcw className="h-5 w-5" />
        </button>
        <button
          onClick={isPaused ? onResume : onPause}
          aria-label={isPaused ? t("繼續", "Resume") : t("暫停", "Pause")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        >
          {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
};

export default GameHeader;

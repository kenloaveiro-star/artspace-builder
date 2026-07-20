import { RotateCcw, Home, Trophy } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useArcadeExit } from "@/lib/arcade-exit";

interface GameOverModalProps {
  score: number;
  highScore: number;
  isNewRecord: boolean;
  gameName: string;
  gameId: string;
  onRestart: () => void;
}

const GameOverModal: React.FC<GameOverModalProps> = ({
  score,
  highScore,
  isNewRecord,
  gameName,
  onRestart,
}) => {
  const { t } = useLanguage();
  const exit = useArcadeExit();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border-4 border-yellow-300/60 bg-gradient-to-br from-pink-100 via-yellow-50 to-sky-100 p-6 text-center shadow-2xl">
        <h2 className="mb-2 text-2xl font-black text-purple-700">{gameName}</h2>
        {isNewRecord && (
          <div className="mb-3 flex items-center justify-center gap-2 text-amber-500">
            <Trophy className="h-5 w-5" />
            <span className="font-bold">{t("新紀錄!", "New Record!")}</span>
          </div>
        )}
        <div className="my-4">
          <div className="text-sm text-slate-500">{t("分數", "Score")}</div>
          <div className="text-6xl font-black text-pink-500 drop-shadow">{score}</div>
          <div className="mt-2 text-sm text-slate-500">
            {t("最高分", "Best")}: {highScore}
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onRestart}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-500 px-4 py-3 font-bold text-white shadow-lg transition active:scale-95"
          >
            <RotateCcw className="h-4 w-4" />
            {t("再玩一次", "Play again")}
          </button>
          <button
            onClick={exit}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-sky-400 to-sky-500 px-4 py-3 font-bold text-white shadow-lg transition active:scale-95"
          >
            <Home className="h-4 w-4" />
            {t("返回", "Back")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameOverModal;

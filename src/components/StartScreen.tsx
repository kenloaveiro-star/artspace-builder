import { useLanguage } from '@/contexts/LanguageContext';
import { Play } from 'lucide-react';

interface StartScreenProps {
  gameName: string;
  gameNameEn: string;
  emoji: string;
  onStart: () => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ gameName, gameNameEn, emoji, onStart }) => {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm p-6">
      <div className="text-8xl mb-6 float">{emoji}</div>
      <h2 className="text-3xl font-bold mb-2 neon-text">
        {t(gameName, gameNameEn)}
      </h2>
      <p className="text-muted-foreground mb-8 text-center">
        {t('準備好了嗎？', 'Ready to play?')}
      </p>
      <button
        onClick={onStart}
        className="btn-game text-lg px-10 py-4 flex items-center gap-3 pulse-neon"
      >
        <Play className="w-6 h-6" />
        {t('開始遊戲', 'Start Game')}
      </button>
    </div>
  );
};

export default StartScreen;

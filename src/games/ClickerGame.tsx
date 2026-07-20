import { useState, useEffect, useCallback, useRef } from 'react';
import GameHeader from '@/components/GameHeader';
import GameOverModal from '@/components/GameOverModal';
import StartScreen from '@/components/StartScreen';
import { getHighScore, setHighScore } from '@/lib/storage';
import { useLanguage } from '@/contexts/LanguageContext';
import { playTap } from '@/lib/sounds';
import { getSettings } from '@/lib/storage';
import { GameDifficultyConfig } from '@/contexts/DifficultyContext';

interface Props {
  config: GameDifficultyConfig;
}

const ClickerGame: React.FC<Props> = ({ config }) => {
  const { t } = useLanguage();
  const GAME_TIME = config.clickerTime;
  
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [highScore, setHighScoreState] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [clickEffects, setClickEffects] = useState<{ id: number; x: number; y: number }[]>([]);
  const effectIdRef = useRef(0);

  const initGame = useCallback(() => {
    setScore(0);
    setTimeLeft(GAME_TIME);
    setIsGameOver(false);
    setIsPaused(false);
    setGameStarted(false);
    setIsNewRecord(false);
    setClickEffects([]);
    setHighScoreState(getHighScore('clicker'));
  }, [GAME_TIME]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  useEffect(() => {
    if (!gameStarted || isPaused || isGameOver || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setIsGameOver(true);
          setScore(s => {
            const isNew = setHighScore('clicker', s);
            setIsNewRecord(isNew);
            return s;
          });
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, isPaused, isGameOver, timeLeft]);

  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (isGameOver || isPaused) return;

    if (!gameStarted) setGameStarted(true);

    const settings = getSettings();
    if (settings.soundEnabled) playTap();

    setScore(s => s + 1);

    // Add click effect
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const id = effectIdRef.current++;
    setClickEffects(prev => [...prev, { id, x, y }]);
    
    setTimeout(() => {
      setClickEffects(prev => prev.filter(effect => effect.id !== id));
    }, 500);
  };

  const cps = gameStarted && timeLeft < GAME_TIME ? 
    (score / (GAME_TIME - timeLeft)).toFixed(1) : '0.0';

  return (
    <>
      <GameHeader
        score={score}
        highScore={highScore}
        isPaused={isPaused}
        onPause={() => setIsPaused(true)}
        onResume={() => setIsPaused(false)}
        onRestart={initGame}
        gameName={t('點擊狂人', 'Clicker')}
      />

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="text-xl font-bold mb-4 flex items-center gap-4">
          <span className={timeLeft <= 5 ? 'text-destructive animate-pulse' : ''}>
            ⏱️ {timeLeft}s
          </span>
          <span className="text-muted-foreground text-sm">
            {cps} {t('點/秒', 'CPS')}
          </span>
        </div>

        <button
          onClick={handleClick}
          onTouchStart={handleClick}
          disabled={isGameOver || isPaused}
          className="relative w-48 h-48 rounded-full bg-primary text-primary-foreground font-bold text-6xl transition-transform active:scale-95 hover:scale-105"
          style={{
            boxShadow: '0 0 40px hsl(var(--primary) / 0.5), inset 0 -8px 20px rgba(0,0,0,0.3)',
          }}
        >
          👆
          
          {clickEffects.map(effect => (
            <span
              key={effect.id}
              className="absolute text-2xl font-bold text-white pointer-events-none animate-fade-in-up"
              style={{
                left: effect.x,
                top: effect.y,
                transform: 'translate(-50%, -50%)',
              }}
            >
              +1
            </span>
          ))}
        </button>

        <div className="mt-6 text-center">
          <div className="text-4xl font-bold neon-text">{score}</div>
          <div className="text-muted-foreground">
            {t('總點擊數', 'Total Clicks')}
          </div>
        </div>
      </div>

      {!gameStarted && !isGameOver && (
        <StartScreen
          gameName="點擊狂人"
          gameNameEn="Clicker"
          emoji="👆"
          onStart={() => setGameStarted(true)}
        />
      )}

      {isPaused && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-2xl font-bold">{t('暫停中', 'Paused')}</div>
        </div>
      )}

      {isGameOver && (
        <GameOverModal
          score={score}
          highScore={Math.max(highScore, score)}
          isNewRecord={isNewRecord}
          gameName={t('點擊狂人', 'Clicker')}
          gameId="clicker"
          onRestart={initGame}
        />
      )}
    </>
  );
};

export default ClickerGame;

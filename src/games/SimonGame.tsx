import { useState, useEffect, useCallback, useRef } from 'react';
import GameHeader from '@/components/GameHeader';
import GameOverModal from '@/components/GameOverModal';
import { getHighScore, setHighScore } from '@/lib/storage';
import { useLanguage } from '@/contexts/LanguageContext';
import { playError } from '@/lib/sounds';
import { getSettings } from '@/lib/storage';
import { GameDifficultyConfig } from '@/contexts/DifficultyContext';

const COLORS = [
  { bg: 'hsl(0, 70%, 45%)', active: 'hsl(0, 80%, 60%)', freq: 329.63 },    // Red
  { bg: 'hsl(120, 60%, 35%)', active: 'hsl(120, 70%, 50%)', freq: 261.63 }, // Green
  { bg: 'hsl(220, 70%, 45%)', active: 'hsl(220, 80%, 60%)', freq: 220.00 }, // Blue
  { bg: 'hsl(50, 80%, 45%)', active: 'hsl(50, 90%, 60%)', freq: 164.81 },   // Yellow
];

interface Props {
  config: GameDifficultyConfig;
}

const SimonGame: React.FC<Props> = ({ config }) => {
  const { t } = useLanguage();
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [highScore, setHighScoreState] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerIndex, setPlayerIndex] = useState(0);
  const [isShowingSequence, setIsShowingSequence] = useState(false);
  const [activeColor, setActiveColor] = useState<number | null>(null);
  const [gameStarted, setGameStarted] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const showTime = config.simonShowTime;

  const playTone = useCallback((colorIndex: number) => {
    const settings = getSettings();
    if (!settings.soundEnabled) return;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(COLORS[colorIndex].freq, ctx.currentTime);
    
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.3);
  }, []);

  const showSequence = useCallback(async (seq: number[]) => {
    setIsShowingSequence(true);
    
    for (let i = 0; i < seq.length; i++) {
      await new Promise(resolve => setTimeout(resolve, showTime));
      setActiveColor(seq[i]);
      playTone(seq[i]);
      await new Promise(resolve => setTimeout(resolve, showTime * 0.75));
      setActiveColor(null);
    }

    await new Promise(resolve => setTimeout(resolve, 200));
    setIsShowingSequence(false);
    setPlayerIndex(0);
  }, [playTone, showTime]);

  const addToSequence = useCallback(() => {
    const nextColor = Math.floor(Math.random() * 4);
    const newSequence = [...sequence, nextColor];
    setSequence(newSequence);
    showSequence(newSequence);
  }, [sequence, showSequence]);

  const initGame = useCallback(() => {
    setSequence([]);
    setPlayerIndex(0);
    setScore(0);
    setIsGameOver(false);
    setIsPaused(false);
    setGameStarted(false);
    setIsNewRecord(false);
    setActiveColor(null);
    setIsShowingSequence(false);
    setHighScoreState(getHighScore('simon'));
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const startGame = useCallback(() => {
    setGameStarted(true);
    const firstColor = Math.floor(Math.random() * 4);
    setSequence([firstColor]);
    setTimeout(() => showSequence([firstColor]), 500);
  }, [showSequence]);

  const handleColorClick = useCallback((colorIndex: number) => {
    if (isShowingSequence || isGameOver || isPaused || !gameStarted) return;

    setActiveColor(colorIndex);
    playTone(colorIndex);
    setTimeout(() => setActiveColor(null), 200);

    if (colorIndex === sequence[playerIndex]) {
      const nextIndex = playerIndex + 1;
      
      if (nextIndex === sequence.length) {
        // Completed sequence
        const newScore = sequence.length;
        setScore(newScore);
        
        setTimeout(() => {
          addToSequence();
        }, 1000);
      } else {
        setPlayerIndex(nextIndex);
      }
    } else {
      // Wrong!
      setIsGameOver(true);
      const finalScore = Math.max(0, sequence.length - 1);
      setScore(finalScore);
      const isNew = setHighScore('simon', finalScore);
      setIsNewRecord(isNew);
      const settings = getSettings();
      if (settings.soundEnabled) playError();
    }
  }, [isShowingSequence, isGameOver, isPaused, gameStarted, sequence, playerIndex, addToSequence, playTone]);

  return (
    <>
      <GameHeader
        score={score}
        highScore={highScore}
        isPaused={isPaused}
        onPause={() => setIsPaused(true)}
        onResume={() => setIsPaused(false)}
        onRestart={initGame}
        gameName={t('顏色記憶', 'Simon Says')}
      />

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {!gameStarted ? (
          <button
            onClick={startGame}
            className="btn-game text-xl px-8 py-4"
          >
            {t('開始遊戲', 'Start Game')}
          </button>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="text-lg text-muted-foreground">
                {isShowingSequence 
                  ? t('記住順序...', 'Watch carefully...')
                  : t('你嘅回合！', 'Your turn!')
                }
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {t('回合', 'Round')} {sequence.length}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full max-w-[280px]">
              {COLORS.map((color, index) => (
                <button
                  key={index}
                  onClick={() => handleColorClick(index)}
                  disabled={isShowingSequence || isGameOver}
                  className="aspect-square rounded-2xl transition-all duration-100 transform active:scale-95"
                  style={{
                    backgroundColor: activeColor === index ? color.active : color.bg,
                    boxShadow: activeColor === index 
                      ? `0 0 30px ${color.active}, inset 0 0 20px rgba(255,255,255,0.3)` 
                      : 'inset 0 -8px 20px rgba(0,0,0,0.3)',
                  }}
                />
              ))}
            </div>

            <div className="mt-6 flex gap-2">
              {sequence.map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full ${
                    i < playerIndex ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

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
          gameName={t('顏色記憶', 'Simon Says')}
          gameId="simon"
          onRestart={initGame}
        />
      )}
    </>
  );
};

export default SimonGame;

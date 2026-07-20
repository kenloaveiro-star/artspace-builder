import { useState, useEffect, useCallback } from 'react';
import GameHeader from '@/components/GameHeader';
import GameOverModal from '@/components/GameOverModal';
import StartScreen from '@/components/StartScreen';
import { getHighScore, setHighScore } from '@/lib/storage';
import { useLanguage } from '@/contexts/LanguageContext';
import { playTap, playSuccess, playError } from '@/lib/sounds';
import { getSettings } from '@/lib/storage';
import { GameDifficultyConfig } from '@/contexts/DifficultyContext';

const EMOJIS_ALL = ['🍰', '🧁', '🍩', '🍪', '🎂', '🍮', '🍡', '🍫', '🍦', '🍨'];

interface Card {
  id: number;
  emoji: string;
  isFlipped: boolean;
  isMatched: boolean;
}

interface Props {
  config: GameDifficultyConfig;
}

const MemoryGame: React.FC<Props> = ({ config }) => {
  const { t } = useLanguage();
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedCards, setFlippedCards] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.memoryTime);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [highScore, setHighScoreState] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const pairCount = Math.floor(config.memoryCards / 2);

  const initGame = useCallback(() => {
    const emojis = EMOJIS_ALL.slice(0, pairCount);
    const shuffled = [...emojis, ...emojis]
      .sort(() => Math.random() - 0.5)
      .map((emoji, index) => ({
        id: index,
        emoji,
        isFlipped: false,
        isMatched: false,
      }));
    setCards(shuffled);
    setFlippedCards([]);
    setScore(0);
    setTimeLeft(config.memoryTime);
    setIsGameOver(false);
    setIsPaused(false);
    setIsNewRecord(false);
    setGameStarted(false);
    setHighScoreState(getHighScore('memory'));
  }, [pairCount, config.memoryTime]);

  useEffect(() => {
    if (!initialized) {
      initGame();
      setInitialized(true);
    }
  }, [initialized, initGame]);

  useEffect(() => {
    if (!gameStarted || isPaused || isGameOver || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setIsGameOver(true);
          const isNew = setHighScore('memory', score);
          setIsNewRecord(isNew);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, isGameOver, score, timeLeft]);

  useEffect(() => {
    if (isGameOver) return;
    const allMatched = cards.length > 0 && cards.every(c => c.isMatched);
    if (allMatched) {
      const bonusScore = score + timeLeft * 10;
      setScore(bonusScore);
      setIsGameOver(true);
      const isNew = setHighScore('memory', bonusScore);
      setIsNewRecord(isNew);
    }
  }, [cards, isGameOver, score, timeLeft]);

  const handleCardClick = (id: number) => {
    if (isPaused || isGameOver) return;
    if (flippedCards.length >= 2) return;
    if (cards[id].isFlipped || cards[id].isMatched) return;

    const settings = getSettings();
    if (settings.soundEnabled) playTap();

    const newCards = [...cards];
    newCards[id].isFlipped = true;
    setCards(newCards);
    setFlippedCards([...flippedCards, id]);

    if (flippedCards.length === 1) {
      const firstCard = cards[flippedCards[0]];
      const secondCard = newCards[id];

      if (firstCard.emoji === secondCard.emoji) {
        setTimeout(() => {
          const matched = [...newCards];
          matched[flippedCards[0]].isMatched = true;
          matched[id].isMatched = true;
          setCards(matched);
          setFlippedCards([]);
          setScore(s => s + 100);
          if (settings.soundEnabled) playSuccess();
        }, 300);
      } else {
        setTimeout(() => {
          const reset = [...newCards];
          reset[flippedCards[0]].isFlipped = false;
          reset[id].isFlipped = false;
          setCards(reset);
          setFlippedCards([]);
          if (settings.soundEnabled) playError();
        }, 800);
      }
    }
  };

  const cols = cards.length <= 12 ? 4 : cards.length <= 16 ? 4 : 5;

  return (
    <>
      <GameHeader
        score={score}
        highScore={highScore}
        isPaused={isPaused}
        onPause={() => setIsPaused(true)}
        onResume={() => setIsPaused(false)}
        onRestart={initGame}
        gameName={t('甜點記憶配對', 'Memory Match')}
      />

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="text-xl font-bold mb-4 flex items-center gap-2">
          <span>⏱️</span>
          <span className={timeLeft <= 10 ? 'text-destructive animate-pulse' : ''}>
            {timeLeft}s
          </span>
        </div>

        <div 
          className="grid gap-2 w-full max-w-[360px]"
          style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
        >
          {cards.map(card => (
            <button
              key={card.id}
              onClick={() => handleCardClick(card.id)}
              disabled={card.isFlipped || card.isMatched || isPaused}
              className={`aspect-square rounded-xl text-2xl sm:text-3xl transition-all duration-300 transform ${
                card.isFlipped || card.isMatched
                  ? 'bg-primary/20 scale-100'
                  : 'bg-muted hover:bg-muted/80 hover:scale-105'
              } ${card.isMatched ? 'opacity-50' : ''}`}
            >
              {card.isFlipped || card.isMatched ? card.emoji : '?'}
            </button>
          ))}
        </div>
      </div>

      {!gameStarted && !isGameOver && (
        <StartScreen
          gameName="甜點記憶配對"
          gameNameEn="Memory Match"
          emoji="🍰"
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
          gameName={t('甜點記憶配對', 'Memory Match')}
          gameId="memory"
          onRestart={initGame}
        />
      )}
    </>
  );
};

export default MemoryGame;

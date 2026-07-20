import { useState, useEffect, useCallback, useRef } from 'react';
import GameHeader from '@/components/GameHeader';
import GameOverModal from '@/components/GameOverModal';
import StartScreen from '@/components/StartScreen';
import { getHighScore, setHighScore } from '@/lib/storage';
import { useLanguage } from '@/contexts/LanguageContext';
import { playPoint, playError } from '@/lib/sounds';
import { getSettings } from '@/lib/storage';
import { useCanvas } from '@/hooks/useGameLoop';
import { GameDifficultyConfig } from '@/contexts/DifficultyContext';

const GRID_SIZE = 20;
const CELL_SIZE = 15;

type Direction = 'up' | 'down' | 'left' | 'right';
type Point = { x: number; y: number };

interface Props {
  config: GameDifficultyConfig;
}

const SnakeGame: React.FC<Props> = ({ config }) => {
  const { t } = useLanguage();
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [highScore, setHighScoreState] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const snakeRef = useRef<Point[]>([{ x: 10, y: 10 }]);
  const directionRef = useRef<Direction>('right');
  const foodRef = useRef<Point>({ x: 15, y: 10 });
  const lastMoveRef = useRef(0);
  const touchStartRef = useRef<Point | null>(null);
  const baseSpeed = config.snakeSpeed;

  const spawnFood = useCallback(() => {
    let newFood: Point;
    do {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
    } while (snakeRef.current.some(s => s.x === newFood.x && s.y === newFood.y));
    foodRef.current = newFood;
  }, []);

  const initGame = useCallback(() => {
    snakeRef.current = [{ x: 10, y: 10 }];
    directionRef.current = 'right';
    spawnFood();
    setScore(0);
    setIsGameOver(false);
    setIsPaused(false);
    setIsNewRecord(false);
    setGameStarted(false);
    setHighScoreState(getHighScore('snake'));
  }, [spawnFood]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const canvasRef = useCanvas((ctx, canvas) => {
    if (isPaused || isGameOver) return;

    const now = Date.now();
    const speed = Math.max(60, baseSpeed - score * 2);
    
    if (now - lastMoveRef.current < speed) {
      // Just redraw
      ctx.fillStyle = 'hsl(240, 15%, 6%)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid
      ctx.strokeStyle = 'hsl(240, 10%, 15%)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= GRID_SIZE; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL_SIZE, 0);
        ctx.lineTo(i * CELL_SIZE, GRID_SIZE * CELL_SIZE);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * CELL_SIZE);
        ctx.lineTo(GRID_SIZE * CELL_SIZE, i * CELL_SIZE);
        ctx.stroke();
      }

      // Draw food
      ctx.fillStyle = 'hsl(0, 80%, 60%)';
      ctx.beginPath();
      ctx.arc(
        foodRef.current.x * CELL_SIZE + CELL_SIZE / 2,
        foodRef.current.y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 2 - 2,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Draw snake
      snakeRef.current.forEach((segment, i) => {
        const hue = 156 - (i * 2);
        ctx.fillStyle = `hsl(${hue}, 100%, ${50 - i * 2}%)`;
        ctx.fillRect(
          segment.x * CELL_SIZE + 1,
          segment.y * CELL_SIZE + 1,
          CELL_SIZE - 2,
          CELL_SIZE - 2
        );
      });

      return;
    }

    lastMoveRef.current = now;

    if (!gameStarted) return;

    // Move snake
    const head = { ...snakeRef.current[0] };
    switch (directionRef.current) {
      case 'up': head.y--; break;
      case 'down': head.y++; break;
      case 'left': head.x--; break;
      case 'right': head.x++; break;
    }

    // Check collision with walls
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      setIsGameOver(true);
      const isNew = setHighScore('snake', score);
      setIsNewRecord(isNew);
      const settings = getSettings();
      if (settings.soundEnabled) playError();
      return;
    }

    // Check collision with self
    if (snakeRef.current.some(s => s.x === head.x && s.y === head.y)) {
      setIsGameOver(true);
      const isNew = setHighScore('snake', score);
      setIsNewRecord(isNew);
      const settings = getSettings();
      if (settings.soundEnabled) playError();
      return;
    }

    snakeRef.current.unshift(head);

    // Check if ate food
    if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
      setScore(s => s + 10);
      spawnFood();
      const settings = getSettings();
      if (settings.soundEnabled) playPoint();
    } else {
      snakeRef.current.pop();
    }
  }, !isPaused && !isGameOver);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMap: Record<string, Direction> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
      };
      const newDir = keyMap[e.key];
      if (newDir) {
        e.preventDefault();
        setGameStarted(true);
        const opposite: Record<Direction, Direction> = {
          up: 'down',
          down: 'up',
          left: 'right',
          right: 'left',
        };
        if (opposite[newDir] !== directionRef.current) {
          directionRef.current = newDir;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!touchStartRef.current) return;
    
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) > 30) {
      setGameStarted(true);
      const opposite: Record<Direction, Direction> = {
        up: 'down',
        down: 'up',
        left: 'right',
        right: 'left',
      };
      let newDir: Direction;
      if (absDx > absDy) {
        newDir = dx > 0 ? 'right' : 'left';
      } else {
        newDir = dy > 0 ? 'down' : 'up';
      }
      if (opposite[newDir] !== directionRef.current) {
        directionRef.current = newDir;
      }
    }
    touchStartRef.current = null;
  };

  const handleDirection = (dir: Direction) => {
    setGameStarted(true);
    const opposite: Record<Direction, Direction> = {
      up: 'down',
      down: 'up',
      left: 'right',
      right: 'left',
    };
    if (opposite[dir] !== directionRef.current) {
      directionRef.current = dir;
    }
  };

  return (
    <>
      <GameHeader
        score={score}
        highScore={highScore}
        isPaused={isPaused}
        onPause={() => setIsPaused(true)}
        onResume={() => setIsPaused(false)}
        onRestart={initGame}
        gameName={t('貪食蛇', 'Snake')}
      />

      <div 
        className="flex-1 flex flex-col items-center justify-center p-4 touch-none select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <canvas
          ref={canvasRef}
          width={GRID_SIZE * CELL_SIZE}
          height={GRID_SIZE * CELL_SIZE}
          className="rounded-xl border border-border"
        />

        {!gameStarted && !isGameOver && (
          <div className="mt-2 text-center text-muted-foreground text-sm">
            {t('用下方按鈕控制', 'Use buttons below')}
          </div>
        )}

        {/* Virtual D-Pad */}
        <div className="mt-6 grid grid-cols-3 gap-2 w-48">
          <div />
          <button
            className="dpad-btn"
            onTouchStart={(e) => { e.preventDefault(); handleDirection('up'); }}
            onClick={() => handleDirection('up')}
          >
            ▲
          </button>
          <div />
          <button
            className="dpad-btn"
            onTouchStart={(e) => { e.preventDefault(); handleDirection('left'); }}
            onClick={() => handleDirection('left')}
          >
            ◀
          </button>
          <div className="touch-btn bg-muted/10 rounded-xl" />
          <button
            className="dpad-btn"
            onTouchStart={(e) => { e.preventDefault(); handleDirection('right'); }}
            onClick={() => handleDirection('right')}
          >
            ▶
          </button>
          <div />
          <button
            className="dpad-btn"
            onTouchStart={(e) => { e.preventDefault(); handleDirection('down'); }}
            onClick={() => handleDirection('down')}
          >
            ▼
          </button>
          <div />
        </div>
      </div>

      {!gameStarted && !isGameOver && (
        <StartScreen
          gameName="貪食蛇"
          gameNameEn="Snake"
          emoji="🐍"
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
          gameName={t('貪食蛇', 'Snake')}
          gameId="snake"
          onRestart={initGame}
        />
      )}
    </>
  );
};

export default SnakeGame;

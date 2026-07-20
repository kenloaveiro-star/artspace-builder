import { useState, useEffect, useCallback, useRef } from 'react';
import GameHeader from '@/components/GameHeader';
import GameOverModal from '@/components/GameOverModal';
import StartScreen from '@/components/StartScreen';
import { getHighScore, setHighScore } from '@/lib/storage';
import { useLanguage } from '@/contexts/LanguageContext';
import { playMove, playSuccess } from '@/lib/sounds';
import { getSettings } from '@/lib/storage';
import { GameDifficultyConfig } from '@/contexts/DifficultyContext';

type Grid = number[][];

const SIZE = 4;

const getEmptyGrid = (): Grid => 
  Array(SIZE).fill(null).map(() => Array(SIZE).fill(0));

const addRandomTile = (grid: Grid, chanceOf4: number): Grid => {
  const empty: [number, number][] = [];
  grid.forEach((row, i) => {
    row.forEach((cell, j) => {
      if (cell === 0) empty.push([i, j]);
    });
  });
  if (empty.length === 0) return grid;
  const [i, j] = empty[Math.floor(Math.random() * empty.length)];
  const newGrid = grid.map(row => [...row]);
  newGrid[i][j] = Math.random() < (1 - chanceOf4) ? 2 : 4;
  return newGrid;
};

const slideRow = (row: number[]): { row: number[]; score: number } => {
  let score = 0;
  const filtered = row.filter(x => x !== 0);
  const result: number[] = [];
  
  for (let i = 0; i < filtered.length; i++) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const merged = filtered[i] * 2;
      result.push(merged);
      score += merged;
      i++;
    } else {
      result.push(filtered[i]);
    }
  }
  
  while (result.length < SIZE) result.push(0);
  return { row: result, score };
};

const moveLeft = (grid: Grid): { grid: Grid; score: number } => {
  let totalScore = 0;
  const newGrid = grid.map(row => {
    const { row: newRow, score } = slideRow(row);
    totalScore += score;
    return newRow;
  });
  return { grid: newGrid, score: totalScore };
};

const rotateGrid = (grid: Grid): Grid => {
  return grid[0].map((_, i) => grid.map(row => row[i]).reverse());
};

const move = (grid: Grid, direction: string): { grid: Grid; score: number; moved: boolean } => {
  let rotations = { left: 0, up: 1, right: 2, down: 3 }[direction] || 0;
  let rotated = grid;
  
  for (let i = 0; i < rotations; i++) rotated = rotateGrid(rotated);
  
  const { grid: moved, score } = moveLeft(rotated);
  
  for (let i = 0; i < (4 - rotations) % 4; i++) moved.splice(0, 4, ...rotateGrid(moved));
  
  let finalGrid = moved;
  for (let i = 0; i < (4 - rotations) % 4; i++) finalGrid = rotateGrid(finalGrid);
  
  const gridChanged = JSON.stringify(grid) !== JSON.stringify(finalGrid);
  return { grid: finalGrid, score, moved: gridChanged };
};

const canMove = (grid: Grid): boolean => {
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE; j++) {
      if (grid[i][j] === 0) return true;
      if (i < SIZE - 1 && grid[i][j] === grid[i + 1][j]) return true;
      if (j < SIZE - 1 && grid[i][j] === grid[i][j + 1]) return true;
    }
  }
  return false;
};

const getTileColor = (value: number): string => {
  const colors: Record<number, string> = {
    2: 'bg-[hsl(40,60%,50%)]',
    4: 'bg-[hsl(35,70%,50%)]',
    8: 'bg-[hsl(25,80%,50%)]',
    16: 'bg-[hsl(15,85%,55%)]',
    32: 'bg-[hsl(5,85%,55%)]',
    64: 'bg-[hsl(0,85%,50%)]',
    128: 'bg-[hsl(50,90%,50%)]',
    256: 'bg-[hsl(48,90%,48%)]',
    512: 'bg-[hsl(46,95%,45%)]',
    1024: 'bg-[hsl(44,95%,42%)]',
    2048: 'bg-[hsl(42,100%,40%)]',
  };
  return colors[value] || 'bg-primary';
};

interface Props {
  config: GameDifficultyConfig;
}

const Game2048: React.FC<Props> = ({ config }) => {
  const { t } = useLanguage();
  const [grid, setGrid] = useState<Grid>(getEmptyGrid);
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [highScore, setHighScoreState] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const chanceOf4 = config.game2048ChanceOf4;

  const initGame = useCallback(() => {
    let newGrid = getEmptyGrid();
    newGrid = addRandomTile(newGrid, chanceOf4);
    newGrid = addRandomTile(newGrid, chanceOf4);
    setGrid(newGrid);
    setScore(0);
    setIsGameOver(false);
    setIsPaused(false);
    setIsNewRecord(false);
    setGameStarted(false);
    setHighScoreState(getHighScore('2048'));
  }, [chanceOf4]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const handleMove = useCallback((direction: string) => {
    if (!gameStarted || isPaused || isGameOver) return;

    const { grid: newGrid, score: addedScore, moved } = move(grid, direction);
    
    if (moved) {
      const settings = getSettings();
      if (settings.soundEnabled) {
        addedScore > 0 ? playSuccess() : playMove();
      }

      const withNewTile = addRandomTile(newGrid, chanceOf4);
      setGrid(withNewTile);
      setScore(s => s + addedScore);

      if (!canMove(withNewTile)) {
        const finalScore = score + addedScore;
        setIsGameOver(true);
        const isNew = setHighScore('2048', finalScore);
        setIsNewRecord(isNew);
      }
    }
  }, [grid, isPaused, isGameOver, gameStarted, score, chanceOf4]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMap: Record<string, string> = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowUp: 'up',
        ArrowDown: 'down',
      };
      if (keyMap[e.key]) {
        e.preventDefault();
        handleMove(keyMap[e.key]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleMove]);

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!touchStart.current) return;
    
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) > 30) {
      if (absDx > absDy) {
        handleMove(dx > 0 ? 'right' : 'left');
      } else {
        handleMove(dy > 0 ? 'down' : 'up');
      }
    }
    touchStart.current = null;
  };

  const handleDirection = (direction: string) => {
    handleMove(direction);
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
        gameName="2048"
      />

      <div 
        className="flex-1 flex flex-col items-center justify-center p-4 touch-none select-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="bg-muted/50 p-3 rounded-2xl">
          <div className="grid grid-cols-4 gap-2">
            {grid.flat().map((value, i) => (
              <div
                key={i}
                className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex items-center justify-center font-bold text-lg sm:text-xl transition-all ${
                  value === 0 ? 'bg-muted' : getTileColor(value)
                } ${value > 0 ? 'text-white' : ''}`}
              >
                {value > 0 && value}
              </div>
            ))}
          </div>
        </div>

        {/* Virtual D-Pad for mobile */}
        <div className="mt-6 grid grid-cols-3 gap-2 w-48">
          <div />
          <button
            className="w-14 h-14 rounded-xl bg-primary/20 hover:bg-primary/30 active:bg-primary/40 flex items-center justify-center text-2xl font-bold text-primary transition-colors touch-none"
            onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); handleDirection('up'); }}
            onClick={() => handleDirection('up')}
          >
            ▲
          </button>
          <div />
          <button
            className="w-14 h-14 rounded-xl bg-primary/20 hover:bg-primary/30 active:bg-primary/40 flex items-center justify-center text-2xl font-bold text-primary transition-colors touch-none"
            onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); handleDirection('left'); }}
            onClick={() => handleDirection('left')}
          >
            ◀
          </button>
          <div className="w-14 h-14 rounded-xl bg-muted/10" />
          <button
            className="w-14 h-14 rounded-xl bg-primary/20 hover:bg-primary/30 active:bg-primary/40 flex items-center justify-center text-2xl font-bold text-primary transition-colors touch-none"
            onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); handleDirection('right'); }}
            onClick={() => handleDirection('right')}
          >
            ▶
          </button>
          <div />
          <button
            className="w-14 h-14 rounded-xl bg-primary/20 hover:bg-primary/30 active:bg-primary/40 flex items-center justify-center text-2xl font-bold text-primary transition-colors touch-none"
            onTouchStart={(e) => { e.preventDefault(); e.stopPropagation(); handleDirection('down'); }}
            onClick={() => handleDirection('down')}
          >
            ▼
          </button>
          <div />
        </div>
      </div>

      <div className="text-center text-sm text-muted-foreground pb-4">
        {t('滑動或點擊方向鍵', 'Swipe or tap arrows')}
      </div>

      {!gameStarted && !isGameOver && (
        <StartScreen
          gameName="2048"
          gameNameEn="2048"
          emoji="🔢"
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
          gameName="2048"
          gameId="2048"
          onRestart={initGame}
        />
      )}
    </>
  );
};

export default Game2048;

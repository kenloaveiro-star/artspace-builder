import { useState, useEffect, useCallback, useRef } from 'react';
import GameHeader from '@/components/GameHeader';
import GameOverModal from '@/components/GameOverModal';
import StartScreen from '@/components/StartScreen';
import { getHighScore, setHighScore } from '@/lib/storage';
import { useLanguage } from '@/contexts/LanguageContext';
import { playMove, playSuccess, playError } from '@/lib/sounds';
import { getSettings } from '@/lib/storage';
import { GameDifficultyConfig } from '@/contexts/DifficultyContext';

const COLS = 10;
const ROWS = 20;
const CELL_SIZE = 20;

const SHAPES = [
  [[1, 1, 1, 1]], // I
  [[1, 1], [1, 1]], // O
  [[0, 1, 0], [1, 1, 1]], // T
  [[1, 0, 0], [1, 1, 1]], // L
  [[0, 0, 1], [1, 1, 1]], // J
  [[0, 1, 1], [1, 1, 0]], // S
  [[1, 1, 0], [0, 1, 1]], // Z
];

const COLORS = [
  'hsl(195, 100%, 50%)', // I - cyan
  'hsl(50, 100%, 50%)',  // O - yellow
  'hsl(280, 100%, 60%)', // T - purple
  'hsl(25, 100%, 55%)',  // L - orange
  'hsl(220, 100%, 50%)', // J - blue
  'hsl(120, 100%, 40%)', // S - green
  'hsl(0, 100%, 50%)',   // Z - red
];

type Board = (number | null)[][];
type Piece = { shape: number[][]; x: number; y: number; color: number };

interface Props {
  config: GameDifficultyConfig;
}

const TetrisGame: React.FC<Props> = ({ config }) => {
  const { t } = useLanguage();
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [highScore, setHighScoreState] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const boardRef = useRef<Board>(Array(ROWS).fill(null).map(() => Array(COLS).fill(null)));
  const pieceRef = useRef<Piece | null>(null);
  const lastDropRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseSpeed = config.tetrisSpeed;

  const createPiece = useCallback((): Piece => {
    const idx = Math.floor(Math.random() * SHAPES.length);
    return {
      shape: SHAPES[idx],
      x: Math.floor(COLS / 2) - 1,
      y: 0,
      color: idx,
    };
  }, []);

  const checkCollision = useCallback((piece: Piece, board: Board): boolean => {
    for (let row = 0; row < piece.shape.length; row++) {
      for (let col = 0; col < piece.shape[row].length; col++) {
        if (piece.shape[row][col]) {
          const newX = piece.x + col;
          const newY = piece.y + row;
          if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
          if (newY >= 0 && board[newY][newX] !== null) return true;
        }
      }
    }
    return false;
  }, []);

  const mergePiece = useCallback((piece: Piece, board: Board): Board => {
    const newBoard = board.map(row => [...row]);
    for (let row = 0; row < piece.shape.length; row++) {
      for (let col = 0; col < piece.shape[row].length; col++) {
        if (piece.shape[row][col]) {
          const newY = piece.y + row;
          const newX = piece.x + col;
          if (newY >= 0) newBoard[newY][newX] = piece.color;
        }
      }
    }
    return newBoard;
  }, []);

  const clearLines = useCallback((board: Board): { board: Board; lines: number } => {
    let lines = 0;
    const newBoard = board.filter(row => {
      if (row.every(cell => cell !== null)) {
        lines++;
        return false;
      }
      return true;
    });
    while (newBoard.length < ROWS) {
      newBoard.unshift(Array(COLS).fill(null));
    }
    return { board: newBoard, lines };
  }, []);

  const rotatePiece = useCallback((piece: Piece): Piece => {
    const rotated = piece.shape[0].map((_, i) =>
      piece.shape.map(row => row[i]).reverse()
    );
    return { ...piece, shape: rotated };
  }, []);

  const initGame = useCallback(() => {
    boardRef.current = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
    pieceRef.current = createPiece();
    setScore(0);
    setIsGameOver(false);
    setIsPaused(false);
    setIsNewRecord(false);
    setGameStarted(false);
    setHighScoreState(getHighScore('tetris'));
  }, [createPiece]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const movePiece = useCallback((dx: number, dy: number) => {
    if (!pieceRef.current || isGameOver || isPaused) return;

    const newPiece = { ...pieceRef.current, x: pieceRef.current.x + dx, y: pieceRef.current.y + dy };
    
    if (!checkCollision(newPiece, boardRef.current)) {
      pieceRef.current = newPiece;
      const settings = getSettings();
      if (settings.soundEnabled && dx !== 0) playMove();
    } else if (dy > 0) {
      // Can't move down - merge
      boardRef.current = mergePiece(pieceRef.current, boardRef.current);
      const { board: clearedBoard, lines } = clearLines(boardRef.current);
      boardRef.current = clearedBoard;
      
      if (lines > 0) {
        const points = [0, 100, 300, 500, 800][lines] || 0;
        setScore(s => s + points);
        const settings = getSettings();
        if (settings.soundEnabled) playSuccess();
      }

      pieceRef.current = createPiece();
      
      if (checkCollision(pieceRef.current, boardRef.current)) {
        setIsGameOver(true);
        setScore(s => {
          const isNew = setHighScore('tetris', s);
          setIsNewRecord(isNew);
          const settings = getSettings();
          if (settings.soundEnabled) playError();
          return s;
        });
      }
    }
  }, [isGameOver, isPaused, checkCollision, mergePiece, clearLines, createPiece]);

  const rotate = useCallback(() => {
    if (!pieceRef.current || isGameOver || isPaused) return;
    const rotated = rotatePiece(pieceRef.current);
    if (!checkCollision(rotated, boardRef.current)) {
      pieceRef.current = rotated;
      const settings = getSettings();
      if (settings.soundEnabled) playMove();
    }
  }, [isGameOver, isPaused, rotatePiece, checkCollision]);

  const hardDrop = useCallback(() => {
    if (!pieceRef.current || isGameOver || isPaused) return;
    while (!checkCollision({ ...pieceRef.current!, y: pieceRef.current!.y + 1 }, boardRef.current)) {
      pieceRef.current.y++;
    }
    movePiece(0, 1);
  }, [isGameOver, isPaused, checkCollision, movePiece]);

  // Game loop
  useEffect(() => {
    if (isGameOver || isPaused || !gameStarted) return;

    const gameLoop = () => {
      const now = Date.now();
      const speed = Math.max(100, baseSpeed - Math.floor(score / 500) * 50);
      
      if (now - lastDropRef.current > speed) {
        lastDropRef.current = now;
        movePiece(0, 1);
      }

      // Draw
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = 'hsl(240, 15%, 8%)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid
      ctx.strokeStyle = 'hsl(240, 10%, 15%)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= COLS; i++) {
        ctx.beginPath();
        ctx.moveTo(i * CELL_SIZE, 0);
        ctx.lineTo(i * CELL_SIZE, ROWS * CELL_SIZE);
        ctx.stroke();
      }
      for (let i = 0; i <= ROWS; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * CELL_SIZE);
        ctx.lineTo(COLS * CELL_SIZE, i * CELL_SIZE);
        ctx.stroke();
      }

      // Draw board
      boardRef.current.forEach((row, y) => {
        row.forEach((cell, x) => {
          if (cell !== null) {
            ctx.fillStyle = COLORS[cell];
            ctx.fillRect(x * CELL_SIZE + 1, y * CELL_SIZE + 1, CELL_SIZE - 2, CELL_SIZE - 2);
          }
        });
      });

      // Draw piece
      if (pieceRef.current) {
        ctx.fillStyle = COLORS[pieceRef.current.color];
        pieceRef.current.shape.forEach((row, dy) => {
          row.forEach((cell, dx) => {
            if (cell) {
              const x = (pieceRef.current!.x + dx) * CELL_SIZE + 1;
              const y = (pieceRef.current!.y + dy) * CELL_SIZE + 1;
              ctx.fillRect(x, y, CELL_SIZE - 2, CELL_SIZE - 2);
            }
          });
        });
      }
    };

    const interval = setInterval(gameLoop, 16);
    return () => clearInterval(interval);
  }, [isGameOver, isPaused, score, movePiece, baseSpeed]);

  // Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft': movePiece(-1, 0); break;
        case 'ArrowRight': movePiece(1, 0); break;
        case 'ArrowDown': movePiece(0, 1); break;
        case 'ArrowUp': rotate(); break;
        case ' ': e.preventDefault(); hardDrop(); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [movePiece, rotate, hardDrop]);

  return (
    <>
      <GameHeader
        score={score}
        highScore={highScore}
        isPaused={isPaused}
        onPause={() => setIsPaused(true)}
        onResume={() => setIsPaused(false)}
        onRestart={initGame}
        gameName={t('俄羅斯方塊', 'Tetris')}
      />

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <canvas
          ref={canvasRef}
          width={COLS * CELL_SIZE}
          height={ROWS * CELL_SIZE}
          className="rounded-xl border border-border"
        />

        {/* Touch controls */}
        <div className="mt-4 grid grid-cols-3 gap-2 w-full max-w-[200px]">
          <button onClick={() => movePiece(-1, 0)} className="p-4 bg-muted rounded-xl text-xl">←</button>
          <button onClick={rotate} className="p-4 bg-muted rounded-xl text-xl">↻</button>
          <button onClick={() => movePiece(1, 0)} className="p-4 bg-muted rounded-xl text-xl">→</button>
          <button onClick={() => movePiece(0, 1)} className="p-4 bg-muted rounded-xl text-xl col-span-2">↓</button>
          <button onClick={hardDrop} className="p-4 bg-primary text-primary-foreground rounded-xl text-xl">⬇</button>
        </div>
      </div>

      {!gameStarted && !isGameOver && (
        <StartScreen
          gameName="俄羅斯方塊"
          gameNameEn="Tetris"
          emoji="🧩"
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
          gameName={t('俄羅斯方塊', 'Tetris')}
          gameId="tetris"
          onRestart={initGame}
        />
      )}
    </>
  );
};

export default TetrisGame;

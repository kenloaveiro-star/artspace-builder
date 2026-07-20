import { useState, useEffect, useCallback, useRef } from 'react';
import GameHeader from '@/components/GameHeader';
import GameOverModal from '@/components/GameOverModal';
import StartScreen from '@/components/StartScreen';
import { getHighScore, setHighScore, getSettings } from '@/lib/storage';
import { useLanguage } from '@/contexts/LanguageContext';
import { playPoint, playError } from '@/lib/sounds';
import { useCanvas } from '@/hooks/useGameLoop';
import { GameDifficultyConfig } from '@/contexts/DifficultyContext';

const CELL_SIZE = 20;
const MAP = [
  '#####################',
  '#.........#.........#',
  '#.###.###.#.###.###.#',
  '#o###.###.#.###.###o#',
  '#...................#',
  '#.###.#.#####.#.###.#',
  '#.....#...#...#.....#',
  '#####.###.#.###.#####',
  '    #.#.......#.#    ',
  '#####.#.##-##.#.#####',
  '     ...#GGG#...     ',
  '#####.#.#####.#.#####',
  '    #.#.......#.#    ',
  '#####.#.#####.#.#####',
  '#.........#.........#',
  '#.###.###.#.###.###.#',
  '#o..#.....P.....#..o#',
  '###.#.#.#####.#.#.###',
  '#.....#...#...#.....#',
  '#.#######.#.#######.#',
  '#...................#',
  '#####################',
];

interface Ghost {
  x: number;
  y: number;
  dir: { dx: number; dy: number };
  scared: boolean;
}

interface Props {
  config: GameDifficultyConfig;
}

const PacManGame: React.FC<Props> = ({ config }) => {
  const { t } = useLanguage();
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(config.pacmanLives);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [highScore, setHighScoreState] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const playerRef = useRef({ x: 10, y: 16 });
  const playerDirRef = useRef({ dx: 0, dy: 0 });
  const nextDirRef = useRef({ dx: 0, dy: 0 });
  const ghostsRef = useRef<Ghost[]>([]);
  const dotsRef = useRef<Set<string>>(new Set());
  const powerDotsRef = useRef<Set<string>>(new Set());
  const scaredTimerRef = useRef(0);
  const lastMoveRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const CANVAS_WIDTH = MAP[0].length * CELL_SIZE;
  const CANVAS_HEIGHT = MAP.length * CELL_SIZE;

  const initGame = useCallback(() => {
    playerRef.current = { x: 10, y: 16 };
    playerDirRef.current = { dx: 0, dy: 0 };
    nextDirRef.current = { dx: 0, dy: 0 };
    
    ghostsRef.current = [
      { x: 9, y: 10, dir: { dx: 1, dy: 0 }, scared: false },
      { x: 10, y: 10, dir: { dx: -1, dy: 0 }, scared: false },
      { x: 11, y: 10, dir: { dx: 0, dy: -1 }, scared: false },
      { x: 10, y: 9, dir: { dx: 0, dy: 1 }, scared: false },
    ];

    const dots = new Set<string>();
    const powerDots = new Set<string>();
    
    for (let y = 0; y < MAP.length; y++) {
      for (let x = 0; x < MAP[y].length; x++) {
        if (MAP[y][x] === '.') dots.add(`${x},${y}`);
        if (MAP[y][x] === 'o') powerDots.add(`${x},${y}`);
      }
    }
    
    dotsRef.current = dots;
    powerDotsRef.current = powerDots;
    scaredTimerRef.current = 0;
    lastMoveRef.current = 0;

    setScore(0);
    setLives(config.pacmanLives);
    setIsGameOver(false);
    setIsPaused(false);
    setIsNewRecord(false);
    setGameStarted(false);
    setHighScoreState(getHighScore('pacman'));
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const canMove = (x: number, y: number) => {
    if (y < 0 || y >= MAP.length) return false;
    const row = MAP[y];
    if (x < 0) return row[row.length - 1] !== '#';
    if (x >= row.length) return row[0] !== '#';
    const cell = row[x];
    return cell !== '#' && cell !== '-';
  };

  const canvasRef = useCanvas((ctx) => {
    if (isPaused || isGameOver || !gameStarted) return;

    const now = Date.now();
    if (now - lastMoveRef.current < 150) {
      // Just draw
    } else {
      lastMoveRef.current = now;

      // Try to change direction
      const player = playerRef.current;
      const nextDir = nextDirRef.current;
      if (canMove(player.x + nextDir.dx, player.y + nextDir.dy)) {
        playerDirRef.current = { ...nextDir };
      }

      // Move player
      const dir = playerDirRef.current;
      const newX = player.x + dir.dx;
      const newY = player.y + dir.dy;
      
      if (canMove(newX, newY)) {
        player.x = newX < 0 ? MAP[0].length - 1 : newX >= MAP[0].length ? 0 : newX;
        player.y = newY;
      }

      // Collect dots
      const key = `${player.x},${player.y}`;
      if (dotsRef.current.has(key)) {
        dotsRef.current.delete(key);
        setScore(s => s + 10);
        if (getSettings().soundEnabled) playPoint();
      }
      if (powerDotsRef.current.has(key)) {
        powerDotsRef.current.delete(key);
        setScore(s => s + 50);
        scaredTimerRef.current = now + 8000;
        ghostsRef.current.forEach(g => g.scared = true);
        if (getSettings().soundEnabled) playPoint();
      }

      // Update scared state
      if (now > scaredTimerRef.current) {
        ghostsRef.current.forEach(g => g.scared = false);
      }

      // Move ghosts
      for (const ghost of ghostsRef.current) {
        const possibleDirs = [
          { dx: 0, dy: -1 },
          { dx: 0, dy: 1 },
          { dx: -1, dy: 0 },
          { dx: 1, dy: 0 },
        ].filter(d => 
          canMove(ghost.x + d.dx, ghost.y + d.dy) &&
          !(d.dx === -ghost.dir.dx && d.dy === -ghost.dir.dy)
        );

        if (possibleDirs.length > 0) {
          if (Math.random() < 0.7 && !ghost.scared) {
            // Chase player
            possibleDirs.sort((a, b) => {
              const distA = Math.hypot(ghost.x + a.dx - player.x, ghost.y + a.dy - player.y);
              const distB = Math.hypot(ghost.x + b.dx - player.x, ghost.y + b.dy - player.y);
              return distA - distB;
            });
          } else {
            // Random or flee
            possibleDirs.sort(() => Math.random() - 0.5);
          }
          ghost.dir = possibleDirs[0];
        }

        ghost.x += ghost.dir.dx;
        ghost.y += ghost.dir.dy;
        if (ghost.x < 0) ghost.x = MAP[0].length - 1;
        if (ghost.x >= MAP[0].length) ghost.x = 0;
      }

      // Check collision with ghosts
      for (const ghost of ghostsRef.current) {
        if (ghost.x === player.x && ghost.y === player.y) {
          if (ghost.scared) {
            setScore(s => s + 200);
            ghost.x = 10;
            ghost.y = 10;
            ghost.scared = false;
          } else {
            setLives(l => {
              if (l <= 1) {
                setIsGameOver(true);
                const isNew = setHighScore('pacman', score);
                setIsNewRecord(isNew);
                if (getSettings().soundEnabled) playError();
                return 0;
              }
              playerRef.current = { x: 10, y: 16 };
              playerDirRef.current = { dx: 0, dy: 0 };
              return l - 1;
            });
          }
        }
      }

      // Check win
      if (dotsRef.current.size === 0 && powerDotsRef.current.size === 0) {
        setScore(s => s + 1000);
        initGame();
      }
    }

    // Draw
    ctx.fillStyle = 'hsl(240, 30%, 5%)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw map
    for (let y = 0; y < MAP.length; y++) {
      for (let x = 0; x < MAP[y].length; x++) {
        const cell = MAP[y][x];
        const px = x * CELL_SIZE;
        const py = y * CELL_SIZE;

        if (cell === '#') {
          ctx.fillStyle = 'hsl(240, 60%, 30%)';
          ctx.fillRect(px, py, CELL_SIZE, CELL_SIZE);
        } else if (cell === '-') {
          ctx.fillStyle = 'hsl(300, 60%, 50%)';
          ctx.fillRect(px, py + CELL_SIZE / 2 - 2, CELL_SIZE, 4);
        }
      }
    }

    // Draw dots
    ctx.fillStyle = 'hsl(60, 100%, 70%)';
    for (const key of dotsRef.current) {
      const [x, y] = key.split(',').map(Number);
      ctx.beginPath();
      ctx.arc(x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw power dots
    ctx.fillStyle = 'hsl(60, 100%, 80%)';
    for (const key of powerDotsRef.current) {
      const [x, y] = key.split(',').map(Number);
      ctx.beginPath();
      ctx.arc(x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw ghosts
    const ghostColors = ['hsl(0, 80%, 50%)', 'hsl(300, 80%, 60%)', 'hsl(180, 80%, 50%)', 'hsl(30, 80%, 50%)'];
    ghostsRef.current.forEach((ghost, i) => {
      ctx.fillStyle = ghost.scared ? 'hsl(240, 80%, 50%)' : ghostColors[i];
      ctx.beginPath();
      ctx.arc(ghost.x * CELL_SIZE + CELL_SIZE / 2, ghost.y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
      
      // Eyes
      ctx.fillStyle = 'white';
      ctx.beginPath();
      ctx.arc(ghost.x * CELL_SIZE + CELL_SIZE / 2 - 3, ghost.y * CELL_SIZE + CELL_SIZE / 2 - 2, 3, 0, Math.PI * 2);
      ctx.arc(ghost.x * CELL_SIZE + CELL_SIZE / 2 + 3, ghost.y * CELL_SIZE + CELL_SIZE / 2 - 2, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw player
    const player = playerRef.current;
    ctx.fillStyle = 'hsl(60, 100%, 50%)';
    ctx.beginPath();
    const mouthAngle = 0.2 + Math.sin(Date.now() / 100) * 0.15;
    const dir = playerDirRef.current;
    const startAngle = Math.atan2(dir.dy, dir.dx) + mouthAngle;
    const endAngle = Math.atan2(dir.dy, dir.dx) - mouthAngle + Math.PI * 2;
    ctx.arc(player.x * CELL_SIZE + CELL_SIZE / 2, player.y * CELL_SIZE + CELL_SIZE / 2, CELL_SIZE / 2 - 2, startAngle, endAngle);
    ctx.lineTo(player.x * CELL_SIZE + CELL_SIZE / 2, player.y * CELL_SIZE + CELL_SIZE / 2);
    ctx.fill();

    // Lives
    ctx.fillStyle = 'hsl(0, 0%, 80%)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`❤️ x${lives}`, 5, CANVAS_HEIGHT - 5);

  }, !isPaused && !isGameOver);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': nextDirRef.current = { dx: 0, dy: -1 }; break;
        case 'ArrowDown': nextDirRef.current = { dx: 0, dy: 1 }; break;
        case 'ArrowLeft': nextDirRef.current = { dx: -1, dy: 0 }; break;
        case 'ArrowRight': nextDirRef.current = { dx: 1, dy: 0 }; break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!touchStartRef.current) return;
    
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (Math.max(absDx, absDy) > 20) {
      if (absDx > absDy) {
        nextDirRef.current = { dx: dx > 0 ? 1 : -1, dy: 0 };
      } else {
        nextDirRef.current = { dx: 0, dy: dy > 0 ? 1 : -1 };
      }
    }
    touchStartRef.current = null;
  };

  const handleDirection = (dx: number, dy: number) => {
    nextDirRef.current = { dx, dy };
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
        gameName={t('貪吃鬼', 'Pac-Man')}
      />

      <div 
        className="flex-1 flex flex-col items-center justify-center p-2 touch-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="rounded-xl border border-border"
        />

        {/* Virtual D-Pad */}
        <div className="mt-6 grid grid-cols-3 gap-2 w-48 safe-bottom">
          <div />
          <button
            className="dpad-btn"
            onTouchStart={(e) => { e.preventDefault(); handleDirection(0, -1); }}
            onClick={() => handleDirection(0, -1)}
          >
            ▲
          </button>
          <div />
          <button
            className="dpad-btn"
            onTouchStart={(e) => { e.preventDefault(); handleDirection(-1, 0); }}
            onClick={() => handleDirection(-1, 0)}
          >
            ◀
          </button>
          <div className="touch-btn bg-muted/10 rounded-xl" />
          <button
            className="dpad-btn"
            onTouchStart={(e) => { e.preventDefault(); handleDirection(1, 0); }}
            onClick={() => handleDirection(1, 0)}
          >
            ▶
          </button>
          <div />
          <button
            className="dpad-btn"
            onTouchStart={(e) => { e.preventDefault(); handleDirection(0, 1); }}
            onClick={() => handleDirection(0, 1)}
          >
            ▼
          </button>
          <div />
        </div>
      </div>

      {!gameStarted && !isGameOver && (
        <StartScreen
          gameName="貪吃鬼"
          gameNameEn="Pac-Man"
          emoji="🟡"
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
          gameName={t('貪吃鬼', 'Pac-Man')}
          gameId="pacman"
          onRestart={initGame}
        />
      )}
    </>
  );
};

export default PacManGame;

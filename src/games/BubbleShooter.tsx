import { useState, useEffect, useCallback, useRef } from 'react';
import GameHeader from '@/components/GameHeader';
import GameOverModal from '@/components/GameOverModal';
import StartScreen from '@/components/StartScreen';
import { getHighScore, setHighScore } from '@/lib/storage';
import { useLanguage } from '@/contexts/LanguageContext';
import { playTap, playSuccess } from '@/lib/sounds';
import { getSettings } from '@/lib/storage';
import { ChevronLeft, ChevronRight, Target } from 'lucide-react';
import { GameDifficultyConfig } from '@/contexts/DifficultyContext';

const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 400;
const BUBBLE_RADIUS = 16;
const COLORS = [
  'hsl(0, 80%, 55%)',
  'hsl(45, 90%, 55%)',
  'hsl(120, 70%, 45%)',
  'hsl(200, 90%, 50%)',
  'hsl(280, 70%, 55%)',
];
const COLS = 10;

interface Bubble {
  color: number;
}

interface Props {
  config: GameDifficultyConfig;
}

const BubbleShooter: React.FC<Props> = ({ config }) => {
  const { t } = useLanguage();
  const INITIAL_ROWS = config.bubbleRows;
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [highScore, setHighScoreState] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [angle, setAngle] = useState(Math.PI / 2);

  const gridRef = useRef<(Bubble | null)[][]>([]);
  const shooterColorRef = useRef(0);
  const flyingBubbleRef = useRef<{ x: number; y: number; dx: number; dy: number; color: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);

  const getX = (row: number, col: number) => {
    const offset = row % 2 === 1 ? BUBBLE_RADIUS : 0;
    return offset + col * BUBBLE_RADIUS * 2 + BUBBLE_RADIUS;
  };

  const getY = (row: number) => {
    return row * BUBBLE_RADIUS * 1.732 + BUBBLE_RADIUS + 10;
  };

  const createGrid = useCallback(() => {
    const grid: (Bubble | null)[][] = [];
    for (let row = 0; row < INITIAL_ROWS; row++) {
      const cols = row % 2 === 0 ? COLS : COLS - 1;
      const rowData: (Bubble | null)[] = [];
      for (let col = 0; col < cols; col++) {
        rowData.push({ color: Math.floor(Math.random() * COLORS.length) });
      }
      grid.push(rowData);
    }
    return grid;
  }, []);

  const initGame = useCallback(() => {
    gridRef.current = createGrid();
    shooterColorRef.current = Math.floor(Math.random() * COLORS.length);
    flyingBubbleRef.current = null;
    setAngle(Math.PI / 2);
    setScore(0);
    setIsGameOver(false);
    setIsPaused(false);
    setIsNewRecord(false);
    setHighScoreState(getHighScore('bubble'));
  }, [createGrid]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const findMatches = useCallback((grid: (Bubble | null)[][], startRow: number, startCol: number, color: number): [number, number][] => {
    const matches: [number, number][] = [];
    const visited = new Set<string>();

    const getNeighbors = (row: number, col: number): [number, number][] => {
      const neighbors: [number, number][] = [];
      const isOddRow = row % 2 === 1;
      
      // Same row
      neighbors.push([row, col - 1], [row, col + 1]);
      // Row above
      if (isOddRow) {
        neighbors.push([row - 1, col], [row - 1, col + 1]);
      } else {
        neighbors.push([row - 1, col - 1], [row - 1, col]);
      }
      // Row below
      if (isOddRow) {
        neighbors.push([row + 1, col], [row + 1, col + 1]);
      } else {
        neighbors.push([row + 1, col - 1], [row + 1, col]);
      }
      return neighbors;
    };

    const dfs = (r: number, c: number) => {
      const key = `${r},${c}`;
      if (visited.has(key)) return;
      if (r < 0 || r >= grid.length) return;
      if (c < 0 || c >= (grid[r]?.length ?? 0)) return;
      if (!grid[r] || !grid[r][c] || grid[r][c]!.color !== color) return;

      visited.add(key);
      matches.push([r, c]);

      for (const [nr, nc] of getNeighbors(r, c)) {
        dfs(nr, nc);
      }
    };

    dfs(startRow, startCol);
    return matches;
  }, []);

  const removeFloating = useCallback((grid: (Bubble | null)[][]) => {
    const connected = new Set<string>();
    
    const getNeighbors = (row: number, col: number): [number, number][] => {
      const neighbors: [number, number][] = [];
      const isOddRow = row % 2 === 1;
      neighbors.push([row, col - 1], [row, col + 1]);
      if (isOddRow) {
        neighbors.push([row - 1, col], [row - 1, col + 1]);
        neighbors.push([row + 1, col], [row + 1, col + 1]);
      } else {
        neighbors.push([row - 1, col - 1], [row - 1, col]);
        neighbors.push([row + 1, col - 1], [row + 1, col]);
      }
      return neighbors;
    };

    // Start from top row
    const dfs = (r: number, c: number) => {
      const key = `${r},${c}`;
      if (connected.has(key)) return;
      if (r < 0 || r >= grid.length) return;
      if (c < 0 || c >= (grid[r]?.length ?? 0)) return;
      if (!grid[r] || !grid[r][c]) return;

      connected.add(key);
      for (const [nr, nc] of getNeighbors(r, c)) {
        dfs(nr, nc);
      }
    };

    // Connect from top row
    if (grid[0]) {
      for (let c = 0; c < grid[0].length; c++) {
        if (grid[0][c]) dfs(0, c);
      }
    }

    // Remove floating
    let removed = 0;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < (grid[r]?.length ?? 0); c++) {
        if (grid[r][c] && !connected.has(`${r},${c}`)) {
          grid[r][c] = null;
          removed++;
        }
      }
    }
    return removed;
  }, []);

  const shoot = useCallback(() => {
    if (flyingBubbleRef.current || isGameOver || isPaused) return;

    const shooterX = CANVAS_WIDTH / 2;
    const shooterY = CANVAS_HEIGHT - 30;

    flyingBubbleRef.current = {
      x: shooterX,
      y: shooterY,
      dx: Math.cos(angle) * 10,
      dy: -Math.sin(angle) * 10,
      color: shooterColorRef.current,
    };

    shooterColorRef.current = Math.floor(Math.random() * COLORS.length);
    const settings = getSettings();
    if (settings.soundEnabled) playTap();
  }, [isGameOver, isPaused, angle]);

  const adjustAngle = useCallback((delta: number) => {
    setAngle(prev => Math.max(0.2, Math.min(Math.PI - 0.2, prev + delta)));
  }, []);

  // Game loop
  useEffect(() => {
    if (isGameOver || isPaused) return;

    const gameLoop = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear
      ctx.fillStyle = 'hsl(240, 15%, 8%)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid bubbles
      const grid = gridRef.current;
      for (let row = 0; row < grid.length; row++) {
        const rowData = grid[row];
        if (!rowData) continue;
        for (let col = 0; col < rowData.length; col++) {
          const bubble = rowData[col];
          if (bubble) {
            const x = getX(row, col);
            const y = getY(row);
            ctx.fillStyle = COLORS[bubble.color];
            ctx.beginPath();
            ctx.arc(x, y, BUBBLE_RADIUS - 2, 0, Math.PI * 2);
            ctx.fill();
            // Highlight
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.beginPath();
            ctx.arc(x - 4, y - 4, 5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Update flying bubble
      if (flyingBubbleRef.current) {
        const fb = flyingBubbleRef.current;
        fb.x += fb.dx;
        fb.y += fb.dy;

        // Wall bounce
        if (fb.x < BUBBLE_RADIUS) {
          fb.x = BUBBLE_RADIUS;
          fb.dx = -fb.dx;
        }
        if (fb.x > CANVAS_WIDTH - BUBBLE_RADIUS) {
          fb.x = CANVAS_WIDTH - BUBBLE_RADIUS;
          fb.dx = -fb.dx;
        }

        // Check collision with grid bubbles
        let hitRow = -1;
        let hitCol = -1;

        for (let row = 0; row < grid.length && hitRow === -1; row++) {
          const rowData = grid[row];
          if (!rowData) continue;
          for (let col = 0; col < rowData.length; col++) {
            if (rowData[col]) {
              const bx = getX(row, col);
              const by = getY(row);
              const dist = Math.hypot(fb.x - bx, fb.y - by);
              if (dist < BUBBLE_RADIUS * 1.8) {
                hitRow = row;
                hitCol = col;
                break;
              }
            }
          }
        }

        // Hit top
        if (fb.y <= BUBBLE_RADIUS + 10) {
          hitRow = 0;
          hitCol = -1; // Will calculate below
        }

        if (hitRow >= 0) {
          // Calculate which cell to place bubble
          let targetRow = hitRow;
          let targetCol = 0;
          
          if (hitCol === -1) {
            // Hit top, calculate col
            const isOddRow = targetRow % 2 === 1;
            if (isOddRow) {
              targetCol = Math.round((fb.x - BUBBLE_RADIUS) / (BUBBLE_RADIUS * 2));
              targetCol = Math.max(0, Math.min(targetCol, COLS - 2));
            } else {
              targetCol = Math.round((fb.x - BUBBLE_RADIUS) / (BUBBLE_RADIUS * 2));
              targetCol = Math.max(0, Math.min(targetCol, COLS - 1));
            }
          } else {
            // Find best adjacent empty cell
            const bx = getX(hitRow, hitCol);
            const by = getY(hitRow);
            
            // Determine if we should add to row above, below, or same row
            const isOddRow = hitRow % 2 === 1;
            const candidates: [number, number, number][] = []; // [row, col, distance]
            
            // Check neighboring positions
            const neighbors: [number, number][] = [];
            neighbors.push([hitRow, hitCol - 1], [hitRow, hitCol + 1]);
            if (isOddRow) {
              neighbors.push([hitRow - 1, hitCol], [hitRow - 1, hitCol + 1]);
              neighbors.push([hitRow + 1, hitCol], [hitRow + 1, hitCol + 1]);
            } else {
              neighbors.push([hitRow - 1, hitCol - 1], [hitRow - 1, hitCol]);
              neighbors.push([hitRow + 1, hitCol - 1], [hitRow + 1, hitCol]);
            }
            
            for (const [nr, nc] of neighbors) {
              if (nr < 0) continue;
              const maxCols = nr % 2 === 0 ? COLS : COLS - 1;
              if (nc < 0 || nc >= maxCols) continue;
              
              // Ensure row exists
              while (grid.length <= nr) {
                const newRowCols = grid.length % 2 === 0 ? COLS : COLS - 1;
                grid.push(new Array(newRowCols).fill(null));
              }
              
              if (!grid[nr][nc]) {
                const nx = getX(nr, nc);
                const ny = getY(nr);
                const dist = Math.hypot(fb.x - nx, fb.y - ny);
                candidates.push([nr, nc, dist]);
              }
            }
            
            if (candidates.length > 0) {
              candidates.sort((a, b) => a[2] - b[2]);
              targetRow = candidates[0][0];
              targetCol = candidates[0][1];
            } else {
              // Fallback: add new row
              const newRow = grid.length;
              const newRowCols = newRow % 2 === 0 ? COLS : COLS - 1;
              grid.push(new Array(newRowCols).fill(null));
              targetRow = newRow;
              const isNewOddRow = newRow % 2 === 1;
              if (isNewOddRow) {
                targetCol = Math.round((fb.x - BUBBLE_RADIUS) / (BUBBLE_RADIUS * 2));
                targetCol = Math.max(0, Math.min(targetCol, COLS - 2));
              } else {
                targetCol = Math.round((fb.x - BUBBLE_RADIUS) / (BUBBLE_RADIUS * 2));
                targetCol = Math.max(0, Math.min(targetCol, COLS - 1));
              }
            }
          }

          // Place bubble
          if (!grid[targetRow]) {
            const rowCols = targetRow % 2 === 0 ? COLS : COLS - 1;
            grid[targetRow] = new Array(rowCols).fill(null);
          }
          grid[targetRow][targetCol] = { color: fb.color };

          // Check matches
          const matches = findMatches(grid, targetRow, targetCol, fb.color);
          if (matches.length >= 3) {
            matches.forEach(([r, c]) => {
              if (grid[r]) grid[r][c] = null;
            });
            const floating = removeFloating(grid);
            const points = (matches.length + floating) * 10;
            setScore(s => s + points);
            const settings = getSettings();
            if (settings.soundEnabled) playSuccess();
          }

          flyingBubbleRef.current = null;

          // Check game over (bubbles too low)
          let maxRow = 0;
          for (let r = grid.length - 1; r >= 0; r--) {
            if (grid[r]?.some(b => b !== null)) {
              maxRow = r;
              break;
            }
          }
          const maxY = getY(maxRow);
          
          if (maxY > CANVAS_HEIGHT - 80) {
            setIsGameOver(true);
            setScore(s => {
              const isNew = setHighScore('bubble', s);
              setIsNewRecord(isNew);
              return s;
            });
          }

          // Check win
          const remaining = grid.flat().filter(b => b).length;
          if (remaining === 0) {
            setIsGameOver(true);
            setScore(s => {
              const bonus = s + 500;
              const isNew = setHighScore('bubble', bonus);
              setIsNewRecord(isNew);
              return bonus;
            });
          }
        }

        // Draw flying bubble
        if (flyingBubbleRef.current) {
          ctx.fillStyle = COLORS[fb.color];
          ctx.beginPath();
          ctx.arc(fb.x, fb.y, BUBBLE_RADIUS - 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Draw shooter
      const shooterX = CANVAS_WIDTH / 2;
      const shooterY = CANVAS_HEIGHT - 30;

      // Draw aim line
      const aimLength = 60;
      const aimEndX = shooterX + Math.cos(angle) * aimLength;
      const aimEndY = shooterY - Math.sin(angle) * aimLength;

      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(shooterX, shooterY);
      ctx.lineTo(aimEndX, aimEndY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw shooter bubble
      ctx.fillStyle = COLORS[shooterColorRef.current];
      ctx.beginPath();
      ctx.arc(shooterX, shooterY, BUBBLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();

      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(shooterX - 4, shooterY - 4, 5, 0, Math.PI * 2);
      ctx.fill();

      animationRef.current = requestAnimationFrame(gameLoop);
    };

    animationRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isGameOver, isPaused, findMatches, removeFloating, angle]);

  return (
    <>
      <GameHeader
        score={score}
        highScore={highScore}
        isPaused={isPaused}
        onPause={() => setIsPaused(true)}
        onResume={() => setIsPaused(false)}
        onRestart={initGame}
        gameName={t('泡泡射擊', 'Bubble Shooter')}
      />

      <div className="flex-1 flex flex-col items-center justify-center p-2">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="rounded-xl border border-border touch-none"
        />

        {/* Virtual Controller */}
        <div className="mt-4 flex items-center gap-6">
          <button
            onTouchStart={(e) => { e.preventDefault(); adjustAngle(0.1); }}
            onMouseDown={() => adjustAngle(0.1)}
            className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center active:bg-primary/40 transition-colors"
          >
            <ChevronLeft className="w-8 h-8 text-primary" />
          </button>

          <button
            onTouchStart={(e) => { e.preventDefault(); shoot(); }}
            onMouseDown={shoot}
            className="w-20 h-20 rounded-full bg-accent/30 border-2 border-accent flex items-center justify-center active:bg-accent/50 transition-colors"
          >
            <Target className="w-10 h-10 text-accent" />
          </button>

          <button
            onTouchStart={(e) => { e.preventDefault(); adjustAngle(-0.1); }}
            onMouseDown={() => adjustAngle(-0.1)}
            className="w-16 h-16 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center active:bg-primary/40 transition-colors"
          >
            <ChevronRight className="w-8 h-8 text-primary" />
          </button>
        </div>

        <div className="mt-2 text-muted-foreground text-xs">
          {t('左右調整角度，中間射擊', 'Left/Right to aim, Center to shoot')}
        </div>
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
          gameName={t('泡泡射擊', 'Bubble Shooter')}
          gameId="bubble"
          onRestart={initGame}
        />
      )}
    </>
  );
};

export default BubbleShooter;

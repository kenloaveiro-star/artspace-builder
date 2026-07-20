import { useState, useEffect, useCallback, useRef } from 'react';
import GameHeader from '@/components/GameHeader';
import GameOverModal from '@/components/GameOverModal';
import StartScreen from '@/components/StartScreen';
import { getHighScore, setHighScore, getSettings } from '@/lib/storage';
import { useLanguage } from '@/contexts/LanguageContext';
import { playPoint, playError } from '@/lib/sounds';
import { useCanvas } from '@/hooks/useGameLoop';
import { GameDifficultyConfig } from '@/contexts/DifficultyContext';

interface Fruit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: string;
  sliced: boolean;
  rotation: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  life: number;
}

interface SlicePoint {
  x: number;
  y: number;
  time: number;
}

interface Props {
  config: GameDifficultyConfig;
}

const FRUITS = ['🍎', '🍊', '🍋', '🍇', '🍉', '🍓', '🥝', '🍑'];
const BOMB = '💣';

const FruitNinjaGame: React.FC<Props> = ({ config }) => {
  const { t } = useLanguage();
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(config.fruitNinjaLives);
  const [combo, setCombo] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [highScore, setHighScoreState] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const fruitsRef = useRef<Fruit[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const slicePointsRef = useRef<SlicePoint[]>([]);
  const lastSpawnRef = useRef(0);
  const comboTimerRef = useRef(0);

  const CANVAS_WIDTH = 320;
  const CANVAS_HEIGHT = 480;
  const GRAVITY = 0.15;
  const FRUIT_SIZE = 50;

  const spawnFruit = useCallback(() => {
    const isBomb = Math.random() < 0.1;
    const x = 60 + Math.random() * (CANVAS_WIDTH - 120);
    const fruit: Fruit = {
      x,
      y: CANVAS_HEIGHT + 30,
      vx: (Math.random() - 0.5) * 2,
      vy: -(8 + Math.random() * 3),
      type: isBomb ? BOMB : FRUITS[Math.floor(Math.random() * FRUITS.length)],
      sliced: false,
      rotation: 0,
    };
    fruitsRef.current.push(fruit);
  }, []);

  const initGame = useCallback(() => {
    fruitsRef.current = [];
    particlesRef.current = [];
    slicePointsRef.current = [];
    lastSpawnRef.current = 0;
    comboTimerRef.current = 0;
    setScore(0);
    setLives(config.fruitNinjaLives);
    setCombo(0);
    setIsGameOver(false);
    setIsPaused(false);
    setIsNewRecord(false);
    setGameStarted(false);
    setHighScoreState(getHighScore('fruitninja'));
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const createParticles = (x: number, y: number, color: string) => {
    for (let i = 0; i < 8; i++) {
      particlesRef.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        color,
        life: 30,
      });
    }
  };

  const checkSlice = useCallback((x: number, y: number) => {
    const now = Date.now();
    slicePointsRef.current.push({ x, y, time: now });
    slicePointsRef.current = slicePointsRef.current.filter(p => now - p.time < 100);

    let slicedCount = 0;

    for (const fruit of fruitsRef.current) {
      if (fruit.sliced) continue;
      
      const dist = Math.hypot(x - fruit.x, y - fruit.y);
      if (dist < FRUIT_SIZE) { // Larger hit area
        fruit.sliced = true;
        
        if (fruit.type === BOMB) {
          setLives(l => {
            if (l <= 1) {
              setIsGameOver(true);
              const isNew = setHighScore('fruitninja', score);
              setIsNewRecord(isNew);
              if (getSettings().soundEnabled) playError();
              return 0;
            }
            if (getSettings().soundEnabled) playError();
            return l - 1;
          });
          createParticles(fruit.x, fruit.y, 'hsl(0, 0%, 30%)');
        } else {
          slicedCount++;
          createParticles(fruit.x, fruit.y, 'hsl(0, 80%, 50%)');
          if (getSettings().soundEnabled) playPoint();
        }
      }
    }

    if (slicedCount > 0) {
      setCombo(c => {
        const newCombo = c + slicedCount;
        comboTimerRef.current = Date.now() + 1000;
        const points = slicedCount * 10 * (newCombo > 3 ? 2 : 1);
        setScore(s => s + points);
        return newCombo;
      });
    }
  }, [score]);

  const canvasRef = useCanvas((ctx) => {
    if (isPaused || isGameOver || !gameStarted) return;

    const now = Date.now();

    // Reset combo
    if (now > comboTimerRef.current) {
      setCombo(0);
    }

    // Spawn fruits - spawn fewer at a time, with more delay
    if (now - lastSpawnRef.current > config.fruitNinjaSpawnRate + 500) {
      lastSpawnRef.current = now;
      const count = 1 + Math.floor(Math.random() * 2); // Max 2 fruits at once
      for (let i = 0; i < count; i++) {
        setTimeout(() => spawnFruit(), i * 400);
      }
    }

    // Update fruits
    fruitsRef.current = fruitsRef.current.filter(fruit => {
      fruit.x += fruit.vx;
      fruit.vy += GRAVITY;
      fruit.y += fruit.vy;
      fruit.rotation += 0.1;

      // Check if missed (fell below screen without being sliced)
      if (fruit.y > CANVAS_HEIGHT + 50) {
        if (!fruit.sliced && fruit.type !== BOMB) {
          setLives(l => {
            if (l <= 1) {
              setIsGameOver(true);
              const isNew = setHighScore('fruitninja', score);
              setIsNewRecord(isNew);
              if (getSettings().soundEnabled) playError();
              return 0;
            }
            return l - 1;
          });
        }
        return false;
      }
      return true;
    });

    // Update particles
    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.3;
      p.life--;
      return p.life > 0;
    });

    // Drawing
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, 'hsl(200, 30%, 15%)');
    gradient.addColorStop(1, 'hsl(200, 30%, 5%)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw slice trail
    if (slicePointsRef.current.length > 1) {
      ctx.strokeStyle = 'hsl(0, 0%, 90%)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(slicePointsRef.current[0].x, slicePointsRef.current[0].y);
      for (const point of slicePointsRef.current.slice(1)) {
        ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
    }

    // Draw fruits
    for (const fruit of fruitsRef.current) {
      if (fruit.sliced) continue;
      
      ctx.save();
      ctx.translate(fruit.x, fruit.y);
      ctx.rotate(fruit.rotation);
      ctx.font = '50px serif'; // Larger fruits
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(fruit.type, 0, 0);
      ctx.restore();
    }

    // Draw particles
    for (const p of particlesRef.current) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / 30;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Draw lives
    ctx.fillStyle = 'hsl(0, 0%, 90%)';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < lives; i++) {
      ctx.fillText('❌', 10 + i * 30, 30);
    }

    // Draw combo
    if (combo > 1) {
      ctx.fillStyle = 'hsl(45, 100%, 60%)';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${combo}x COMBO!`, CANVAS_WIDTH / 2, 60);
    }

  }, !isPaused && !isGameOver);

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;
    checkSlice(x, y);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (e.buttons !== 1) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    checkSlice(x, y);
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
        gameName={t('水果忍者', 'Fruit Ninja')}
      />

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="rounded-xl border border-border touch-none cursor-crosshair"
          onTouchMove={handleTouchMove}
          onTouchStart={(e) => { e.preventDefault(); handleTouchMove(e); }}
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseMove}
        />
        <div className="mt-4 text-center text-muted-foreground">
          {t('滑動切水果，避開炸彈', 'Swipe to slice, avoid bombs')}
        </div>
      </div>

      {!gameStarted && !isGameOver && (
        <StartScreen
          gameName="水果忍者"
          gameNameEn="Fruit Ninja"
          emoji="🍉"
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
          gameName={t('水果忍者', 'Fruit Ninja')}
          gameId="fruitninja"
          onRestart={initGame}
        />
      )}
    </>
  );
};

export default FruitNinjaGame;

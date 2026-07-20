import { useState, useEffect, useCallback, useRef } from 'react';
import GameHeader from '@/components/GameHeader';
import GameOverModal from '@/components/GameOverModal';
import StartScreen from '@/components/StartScreen';
import { getHighScore, setHighScore, getSettings } from '@/lib/storage';
import { useLanguage } from '@/contexts/LanguageContext';
import { playPoint, playError } from '@/lib/sounds';
import { useCanvas } from '@/hooks/useGameLoop';
import { GameDifficultyConfig } from '@/contexts/DifficultyContext';

interface Enemy {
  x: number;
  y: number;
  alive: boolean;
}

interface Bullet {
  x: number;
  y: number;
  isEnemy: boolean;
}

interface Props {
  config: GameDifficultyConfig;
}

const SpaceInvadersGame: React.FC<Props> = ({ config }) => {
  const { t } = useLanguage();
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(config.spaceInvadersLives);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [highScore, setHighScoreState] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const playerRef = useRef({ x: 160 });
  const enemiesRef = useRef<Enemy[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const enemyDirRef = useRef(1);
  const lastEnemyMoveRef = useRef(0);
  const lastEnemyShootRef = useRef(0);
  const touchStartRef = useRef<number | null>(null);

  const CANVAS_WIDTH = 320;
  const CANVAS_HEIGHT = 400;
  const PLAYER_WIDTH = 40;
  const PLAYER_HEIGHT = 20;
  const ENEMY_SIZE = 25;
  const BULLET_SPEED = 6;

  const createEnemies = useCallback(() => {
    const enemies: Enemy[] = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 8; col++) {
        enemies.push({
          x: 30 + col * 35,
          y: 50 + row * 35,
          alive: true,
        });
      }
    }
    return enemies;
  }, []);

  const initGame = useCallback(() => {
    playerRef.current = { x: CANVAS_WIDTH / 2 };
    enemiesRef.current = createEnemies();
    bulletsRef.current = [];
    enemyDirRef.current = 1;
    lastEnemyMoveRef.current = 0;
    lastEnemyShootRef.current = 0;
    setScore(0);
    setLives(config.spaceInvadersLives);
    setIsGameOver(false);
    setIsPaused(false);
    setIsNewRecord(false);
    setGameStarted(false);
    setHighScoreState(getHighScore('spaceinvaders'));
  }, [createEnemies]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const shoot = useCallback(() => {
    if (isGameOver || isPaused) return;
    bulletsRef.current.push({
      x: playerRef.current.x,
      y: CANVAS_HEIGHT - 50,
      isEnemy: false,
    });
    if (getSettings().soundEnabled) playPoint();
  }, [isGameOver, isPaused]);

  const canvasRef = useCanvas((ctx) => {
    if (isPaused || isGameOver || !gameStarted) return;

    const now = Date.now();

    // Background
    ctx.fillStyle = 'hsl(240, 30%, 5%)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Stars
    ctx.fillStyle = 'hsl(0, 0%, 80%)';
    for (let i = 0; i < 50; i++) {
      const x = (i * 73 + now / 50) % CANVAS_WIDTH;
      const y = (i * 47) % CANVAS_HEIGHT;
      ctx.fillRect(x, y, 1, 1);
    }

    // Move enemies
    if (now - lastEnemyMoveRef.current > 500) {
      lastEnemyMoveRef.current = now;
      let shouldDrop = false;

      for (const enemy of enemiesRef.current) {
        if (!enemy.alive) continue;
        if (enemy.x < 20 || enemy.x > CANVAS_WIDTH - 20) {
          shouldDrop = true;
          break;
        }
      }

      if (shouldDrop) {
        enemyDirRef.current *= -1;
        for (const enemy of enemiesRef.current) {
          enemy.y += 15;
        }
      }

      for (const enemy of enemiesRef.current) {
        enemy.x += enemyDirRef.current * 10;
      }
    }

    // Enemy shooting
    if (now - lastEnemyShootRef.current > 1500) {
      lastEnemyShootRef.current = now;
      const aliveEnemies = enemiesRef.current.filter(e => e.alive);
      if (aliveEnemies.length > 0) {
        const shooter = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
        bulletsRef.current.push({
          x: shooter.x,
          y: shooter.y + ENEMY_SIZE / 2,
          isEnemy: true,
        });
      }
    }

    // Update bullets
    bulletsRef.current = bulletsRef.current.filter(bullet => {
      bullet.y += bullet.isEnemy ? BULLET_SPEED : -BULLET_SPEED;
      return bullet.y > 0 && bullet.y < CANVAS_HEIGHT;
    });

    // Bullet-enemy collision
    for (const bullet of bulletsRef.current) {
      if (bullet.isEnemy) continue;
      for (const enemy of enemiesRef.current) {
        if (!enemy.alive) continue;
        if (
          Math.abs(bullet.x - enemy.x) < ENEMY_SIZE / 2 &&
          Math.abs(bullet.y - enemy.y) < ENEMY_SIZE / 2
        ) {
          enemy.alive = false;
          bulletsRef.current = bulletsRef.current.filter(b => b !== bullet);
          setScore(s => s + 100);
          if (getSettings().soundEnabled) playPoint();
          break;
        }
      }
    }

    // Bullet-player collision
    for (const bullet of bulletsRef.current) {
      if (!bullet.isEnemy) continue;
      if (
        Math.abs(bullet.x - playerRef.current.x) < PLAYER_WIDTH / 2 &&
        bullet.y > CANVAS_HEIGHT - 50
      ) {
        bulletsRef.current = bulletsRef.current.filter(b => b !== bullet);
        setLives(l => {
          if (l <= 1) {
            setIsGameOver(true);
            const isNew = setHighScore('spaceinvaders', score);
            setIsNewRecord(isNew);
            if (getSettings().soundEnabled) playError();
            return 0;
          }
          return l - 1;
        });
      }
    }

    // Check if enemy reached bottom or all dead
    const aliveEnemies = enemiesRef.current.filter(e => e.alive);
    if (aliveEnemies.length === 0) {
      enemiesRef.current = createEnemies();
      setScore(s => s + 500);
    }

    for (const enemy of aliveEnemies) {
      if (enemy.y > CANVAS_HEIGHT - 80) {
        setIsGameOver(true);
        const isNew = setHighScore('spaceinvaders', score);
        setIsNewRecord(isNew);
        if (getSettings().soundEnabled) playError();
        return;
      }
    }

    // Draw enemies
    for (const enemy of enemiesRef.current) {
      if (!enemy.alive) continue;
      ctx.fillStyle = 'hsl(120, 70%, 50%)';
      ctx.font = '24px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👾', enemy.x, enemy.y);
    }

    // Draw bullets
    for (const bullet of bulletsRef.current) {
      ctx.fillStyle = bullet.isEnemy ? 'hsl(0, 80%, 60%)' : 'hsl(60, 100%, 60%)';
      ctx.fillRect(bullet.x - 2, bullet.y - 6, 4, 12);
    }

    // Draw player
    ctx.fillStyle = 'hsl(200, 80%, 50%)';
    ctx.beginPath();
    ctx.moveTo(playerRef.current.x, CANVAS_HEIGHT - 50);
    ctx.lineTo(playerRef.current.x - PLAYER_WIDTH / 2, CANVAS_HEIGHT - 30);
    ctx.lineTo(playerRef.current.x + PLAYER_WIDTH / 2, CANVAS_HEIGHT - 30);
    ctx.closePath();
    ctx.fill();

    // Lives
    ctx.fillStyle = 'hsl(0, 0%, 80%)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`❤️ x${lives}`, 10, CANVAS_HEIGHT - 10);

  }, !isPaused && !isGameOver);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        playerRef.current.x = Math.max(PLAYER_WIDTH / 2, playerRef.current.x - 15);
      }
      if (e.key === 'ArrowRight') {
        playerRef.current.x = Math.min(CANVAS_WIDTH - PLAYER_WIDTH / 2, playerRef.current.x + 15);
      }
      if (e.key === ' ') {
        e.preventDefault();
        shoot();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shoot]);

  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    touchStartRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (touchStartRef.current === null) return;
    const rect = canvasRef.current!.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    playerRef.current.x = Math.max(PLAYER_WIDTH / 2, Math.min(CANVAS_WIDTH - PLAYER_WIDTH / 2, touchX));
  };

  const movePlayer = (direction: 'left' | 'right') => {
    const moveAmount = 20;
    if (direction === 'left') {
      playerRef.current.x = Math.max(PLAYER_WIDTH / 2, playerRef.current.x - moveAmount);
    } else {
      playerRef.current.x = Math.min(CANVAS_WIDTH - PLAYER_WIDTH / 2, playerRef.current.x + moveAmount);
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
        gameName={t('太空射擊', 'Space Invaders')}
      />

      <div className="flex-1 flex flex-col items-center justify-center p-2">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="rounded-xl border border-border touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onClick={shoot}
        />
        
        {/* Virtual Controls */}
        <div className="mt-6 flex items-center justify-center gap-6 safe-bottom">
          <button
            className="dpad-btn w-16 h-16 rounded-full"
            onTouchStart={(e) => { e.preventDefault(); movePlayer('left'); }}
            onClick={() => movePlayer('left')}
          >
            ◀
          </button>
          <button
            className="action-btn w-20 h-20"
            onTouchStart={(e) => { e.preventDefault(); shoot(); }}
            onClick={shoot}
          >
            🔥
          </button>
          <button
            className="dpad-btn w-16 h-16 rounded-full"
            onTouchStart={(e) => { e.preventDefault(); movePlayer('right'); }}
            onClick={() => movePlayer('right')}
          >
            ▶
          </button>
        </div>
      </div>

      {!gameStarted && !isGameOver && (
        <StartScreen
          gameName="太空射擊"
          gameNameEn="Space Invaders"
          emoji="👾"
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
          gameName={t('太空射擊', 'Space Invaders')}
          gameId="spaceinvaders"
          onRestart={initGame}
        />
      )}
    </>
  );
};

export default SpaceInvadersGame;

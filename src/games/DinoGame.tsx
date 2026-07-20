import { useState, useEffect, useCallback, useRef } from 'react';
import GameHeader from '@/components/GameHeader';
import GameOverModal from '@/components/GameOverModal';
import StartScreen from '@/components/StartScreen';
import { getHighScore, setHighScore } from '@/lib/storage';
import { useLanguage } from '@/contexts/LanguageContext';
import { playTap, playError } from '@/lib/sounds';
import { getSettings } from '@/lib/storage';
import { useCanvas } from '@/hooks/useGameLoop';
import { GameDifficultyConfig } from '@/contexts/DifficultyContext';

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 200;
const GROUND_Y = 160;
const DINO_WIDTH = 40;
const DINO_HEIGHT = 50;
const GRAVITY = 0.8;
const JUMP_FORCE = -14;
const OBSTACLE_WIDTH = 25;
const OBSTACLE_MIN_HEIGHT = 30;
const OBSTACLE_MAX_HEIGHT = 50;

interface Obstacle {
  x: number;
  height: number;
  isBird: boolean;
}

interface Props {
  config: GameDifficultyConfig;
}

const DinoGame: React.FC<Props> = ({ config }) => {
  const { t } = useLanguage();
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [highScore, setHighScoreState] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const dinoYRef = useRef(GROUND_Y - DINO_HEIGHT);
  const velocityRef = useRef(0);
  const isDuckingRef = useRef(false);
  const obstaclesRef = useRef<Obstacle[]>([]);
  const speedRef = useRef(config.dinoSpeed);
  const frameCountRef = useRef(0);
  const obstacleFrequency = config.dinoObstacleFrequency;

  const initGame = useCallback(() => {
    dinoYRef.current = GROUND_Y - DINO_HEIGHT;
    velocityRef.current = 0;
    isDuckingRef.current = false;
    obstaclesRef.current = [];
    speedRef.current = config.dinoSpeed;
    frameCountRef.current = 0;
    setScore(0);
    setIsGameOver(false);
    setIsPaused(false);
    setGameStarted(false);
    setIsNewRecord(false);
    setHighScoreState(getHighScore('dino'));
  }, [config.dinoSpeed]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const jump = useCallback(() => {
    if (isGameOver) return;
    if (!gameStarted) setGameStarted(true);
    
    if (dinoYRef.current >= GROUND_Y - DINO_HEIGHT - 1) {
      velocityRef.current = JUMP_FORCE;
      const settings = getSettings();
      if (settings.soundEnabled) playTap();
    }
  }, [isGameOver, gameStarted]);

  const duck = useCallback((isDucking: boolean) => {
    isDuckingRef.current = isDucking;
  }, []);

  const canvasRef = useCanvas((ctx, canvas) => {
    if (isPaused || isGameOver) return;

    frameCountRef.current++;

    // Clear
    ctx.fillStyle = 'hsl(240, 15%, 6%)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Ground
    ctx.fillStyle = 'hsl(240, 10%, 20%)';
    ctx.fillRect(0, GROUND_Y, canvas.width, 2);

    // Decorative dots on ground
    ctx.fillStyle = 'hsl(240, 10%, 25%)';
    for (let i = 0; i < 30; i++) {
      const x = (i * 25 + frameCountRef.current * speedRef.current * 0.5) % canvas.width;
      ctx.fillRect(x, GROUND_Y + 10, 2, 2);
    }

    if (gameStarted) {
      // Update dino
      velocityRef.current += GRAVITY;
      dinoYRef.current += velocityRef.current;

      if (dinoYRef.current > GROUND_Y - DINO_HEIGHT) {
        dinoYRef.current = GROUND_Y - DINO_HEIGHT;
        velocityRef.current = 0;
      }

      // Spawn obstacles
      if (obstaclesRef.current.length === 0 || 
          obstaclesRef.current[obstaclesRef.current.length - 1].x < canvas.width - 300) {
        if (Math.random() < obstacleFrequency) {
          const isBird = score > 50 && Math.random() < 0.3;
          obstaclesRef.current.push({
            x: canvas.width,
            height: isBird ? 30 : OBSTACLE_MIN_HEIGHT + Math.random() * (OBSTACLE_MAX_HEIGHT - OBSTACLE_MIN_HEIGHT),
            isBird,
          });
        }
      }

      // Update obstacles
      obstaclesRef.current = obstaclesRef.current.filter(obs => {
        obs.x -= speedRef.current;
        return obs.x > -OBSTACLE_WIDTH;
      });

      // Score
      if (frameCountRef.current % 6 === 0) {
        setScore(s => s + 1);
      }

      // Speed up
      speedRef.current = Math.min(15, config.dinoSpeed + score * 0.02);

      // Collision detection
      const dinoHeight = isDuckingRef.current ? DINO_HEIGHT * 0.5 : DINO_HEIGHT;
      const dinoY = isDuckingRef.current ? GROUND_Y - dinoHeight : dinoYRef.current;
      
      for (const obs of obstaclesRef.current) {
        const obsY = obs.isBird ? GROUND_Y - 60 : GROUND_Y - obs.height;
        
        if (
          50 < obs.x + OBSTACLE_WIDTH &&
          50 + DINO_WIDTH > obs.x &&
          dinoY < obsY + (obs.isBird ? 30 : obs.height) &&
          dinoY + dinoHeight > obsY
        ) {
          setIsGameOver(true);
          setScore(s => {
            const isNew = setHighScore('dino', s);
            setIsNewRecord(isNew);
            const settings = getSettings();
            if (settings.soundEnabled) playError();
            return s;
          });
          return;
        }
      }
    }

    // Draw dino
    const dinoHeight = isDuckingRef.current ? DINO_HEIGHT * 0.5 : DINO_HEIGHT;
    const dinoY = isDuckingRef.current ? GROUND_Y - dinoHeight : dinoYRef.current;
    
    ctx.fillStyle = 'hsl(156, 100%, 50%)';
    ctx.fillRect(50, dinoY, DINO_WIDTH, dinoHeight);
    
    // Eye
    ctx.fillStyle = 'white';
    ctx.fillRect(75, dinoY + 8, 8, 8);
    ctx.fillStyle = 'black';
    ctx.fillRect(79, dinoY + 10, 4, 4);

    // Draw obstacles
    obstaclesRef.current.forEach(obs => {
      if (obs.isBird) {
        ctx.fillStyle = 'hsl(0, 80%, 60%)';
        ctx.fillRect(obs.x, GROUND_Y - 60, OBSTACLE_WIDTH, 20);
        // Wing
        ctx.fillRect(obs.x + 5, GROUND_Y - 75, 15, 15);
      } else {
        ctx.fillStyle = 'hsl(120, 50%, 35%)';
        ctx.fillRect(obs.x, GROUND_Y - obs.height, OBSTACLE_WIDTH, obs.height);
      }
    });
  }, !isPaused && !isGameOver);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
      if (e.code === 'ArrowDown') {
        e.preventDefault();
        duck(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown') {
        duck(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [jump, duck]);

  return (
    <>
      <GameHeader
        score={score}
        highScore={highScore}
        isPaused={isPaused}
        onPause={() => setIsPaused(true)}
        onResume={() => setIsPaused(false)}
        onRestart={initGame}
        gameName={t('暴龍跑酷', 'Dino Run')}
      />

      <div 
        className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden"
        onClick={jump}
        onTouchStart={jump}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="rounded-xl border border-border touch-none max-w-full"
          style={{ maxWidth: '100%', height: 'auto' }}
        />

        {!gameStarted && !isGameOver && (
          <div className="mt-4 text-muted-foreground text-center">
            {t('點擊跳躍，向下滑蹲下', 'Tap to jump')}
          </div>
        )}
      </div>

      {!gameStarted && !isGameOver && (
        <StartScreen
          gameName="暴龍跑酷"
          gameNameEn="Dino Run"
          emoji="🦖"
          onStart={() => { setGameStarted(true); jump(); }}
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
          gameName={t('暴龍跑酷', 'Dino Run')}
          gameId="dino"
          onRestart={initGame}
        />
      )}
    </>
  );
};

export default DinoGame;

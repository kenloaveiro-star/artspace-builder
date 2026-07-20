import { useState, useEffect, useCallback, useRef } from 'react';
import GameHeader from '@/components/GameHeader';
import GameOverModal from '@/components/GameOverModal';
import StartScreen from '@/components/StartScreen';
import { getHighScore, setHighScore } from '@/lib/storage';
import { useLanguage } from '@/contexts/LanguageContext';
import { playTap, playPoint, playError } from '@/lib/sounds';
import { getSettings } from '@/lib/storage';
import { useCanvas } from '@/hooks/useGameLoop';
import { GameDifficultyConfig } from '@/contexts/DifficultyContext';

const PIPE_WIDTH = 50;
const BIRD_SIZE = 30;

interface Pipe {
  x: number;
  topHeight: number;
  passed: boolean;
}

interface Props {
  config: GameDifficultyConfig;
}

const FlappyBird: React.FC<Props> = ({ config }) => {
  const { t } = useLanguage();
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [highScore, setHighScoreState] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const birdYRef = useRef(200);
  const velocityRef = useRef(0);
  const pipesRef = useRef<Pipe[]>([]);
  const canvasHeight = 400;
  const canvasWidth = 300;

  const GRAVITY = config.flappyGravity;
  const JUMP_FORCE = -7;
  const PIPE_GAP = config.flappyGap;
  const PIPE_SPEED = config.flappySpeed;

  const initGame = useCallback(() => {
    birdYRef.current = 200;
    velocityRef.current = 0;
    pipesRef.current = [];
    setScore(0);
    setIsGameOver(false);
    setIsPaused(false);
    setGameStarted(false);
    setIsNewRecord(false);
    setHighScoreState(getHighScore('flappy'));
  }, []);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const jump = useCallback(() => {
    if (isGameOver) return;
    if (!gameStarted) setGameStarted(true);
    velocityRef.current = JUMP_FORCE;
    const settings = getSettings();
    if (settings.soundEnabled) playTap();
  }, [isGameOver, gameStarted]);

  const canvasRef = useCanvas((ctx, canvas) => {
    if (isPaused || isGameOver) return;

    // Clear
    ctx.fillStyle = 'hsl(200, 60%, 15%)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw stars
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    for (let i = 0; i < 20; i++) {
      const x = (i * 37 + Date.now() / 100) % canvas.width;
      const y = (i * 23) % canvas.height;
      ctx.fillRect(x, y, 2, 2);
    }

    if (gameStarted) {
      // Update bird
      velocityRef.current += GRAVITY;
      birdYRef.current += velocityRef.current;

      // Add pipes
      if (pipesRef.current.length === 0 || 
          pipesRef.current[pipesRef.current.length - 1].x < canvas.width - 200) {
        pipesRef.current.push({
          x: canvas.width,
          topHeight: Math.random() * (canvas.height - PIPE_GAP - 100) + 50,
          passed: false,
        });
      }

      // Update pipes
      pipesRef.current = pipesRef.current.filter(pipe => {
        pipe.x -= PIPE_SPEED;
        
        // Check if passed
        if (!pipe.passed && pipe.x + PIPE_WIDTH < 50) {
          pipe.passed = true;
          setScore(s => {
            const settings = getSettings();
            if (settings.soundEnabled) playPoint();
            return s + 1;
          });
        }

        // Collision detection
        const birdLeft = 50 - BIRD_SIZE / 2;
        const birdRight = 50 + BIRD_SIZE / 2;
        const birdTop = birdYRef.current - BIRD_SIZE / 2;
        const birdBottom = birdYRef.current + BIRD_SIZE / 2;

        if (birdRight > pipe.x && birdLeft < pipe.x + PIPE_WIDTH) {
          if (birdTop < pipe.topHeight || birdBottom > pipe.topHeight + PIPE_GAP) {
            setIsGameOver(true);
            setScore(s => {
              const isNew = setHighScore('flappy', s);
              setIsNewRecord(isNew);
              const settings = getSettings();
              if (settings.soundEnabled) playError();
              return s;
            });
          }
        }

        return pipe.x > -PIPE_WIDTH;
      });

      // Check bounds
      if (birdYRef.current > canvas.height || birdYRef.current < 0) {
        setIsGameOver(true);
        setScore(s => {
          const isNew = setHighScore('flappy', s);
          setIsNewRecord(isNew);
          return s;
        });
      }
    }

    // Draw pipes
    ctx.fillStyle = 'hsl(156, 100%, 40%)';
    pipesRef.current.forEach(pipe => {
      // Top pipe
      ctx.fillRect(pipe.x, 0, PIPE_WIDTH, pipe.topHeight);
      ctx.fillRect(pipe.x - 5, pipe.topHeight - 20, PIPE_WIDTH + 10, 20);
      
      // Bottom pipe
      const bottomY = pipe.topHeight + PIPE_GAP;
      ctx.fillRect(pipe.x, bottomY, PIPE_WIDTH, canvas.height - bottomY);
      ctx.fillRect(pipe.x - 5, bottomY, PIPE_WIDTH + 10, 20);
    });

    // Draw bird
    ctx.fillStyle = 'hsl(50, 100%, 50%)';
    ctx.beginPath();
    ctx.arc(50, birdYRef.current, BIRD_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();

    // Bird eye
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(55, birdYRef.current - 5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(57, birdYRef.current - 5, 3, 0, Math.PI * 2);
    ctx.fill();

    // Bird beak
    ctx.fillStyle = 'orange';
    ctx.beginPath();
    ctx.moveTo(65, birdYRef.current);
    ctx.lineTo(75, birdYRef.current + 5);
    ctx.lineTo(65, birdYRef.current + 10);
    ctx.closePath();
    ctx.fill();
  }, !isPaused && !isGameOver);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        jump();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jump]);

  return (
    <>
      <GameHeader
        score={score}
        highScore={highScore}
        isPaused={isPaused}
        onPause={() => setIsPaused(true)}
        onResume={() => setIsPaused(false)}
        onRestart={initGame}
        gameName={t('飛鳥跳管', 'Flappy Bird')}
      />

      <div 
        className="flex-1 flex flex-col items-center justify-center p-4"
        onClick={jump}
        onTouchStart={(e) => { e.preventDefault(); jump(); }}
      >
        <canvas
          ref={canvasRef}
          width={canvasWidth}
          height={canvasHeight}
          className="rounded-xl border border-border touch-none"
        />

        {!gameStarted && !isGameOver && (
          <div className="mt-4 text-center text-muted-foreground">
            {t('點擊跳躍', 'Tap to jump')}
          </div>
        )}
      </div>

      {!gameStarted && !isGameOver && (
        <StartScreen
          gameName="飛鳥跳管"
          gameNameEn="Flappy Bird"
          emoji="🐦"
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
          gameName={t('飛鳥跳管', 'Flappy Bird')}
          gameId="flappy"
          onRestart={initGame}
        />
      )}
    </>
  );
};

export default FlappyBird;

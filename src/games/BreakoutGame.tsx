import { useState, useEffect, useCallback, useRef } from 'react';
import GameHeader from '@/components/GameHeader';
import GameOverModal from '@/components/GameOverModal';
import StartScreen from '@/components/StartScreen';
import { getHighScore, setHighScore } from '@/lib/storage';
import { useLanguage } from '@/contexts/LanguageContext';
import { playTap, playSuccess, playError } from '@/lib/sounds';
import { getSettings } from '@/lib/storage';
import { useCanvas } from '@/hooks/useGameLoop';
import { GameDifficultyConfig } from '@/contexts/DifficultyContext';

const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 480;
const PADDLE_HEIGHT = 12;
const BALL_RADIUS = 8;
const BRICK_ROWS = 5;
const BRICK_COLS = 8;
const BRICK_WIDTH = 36;
const BRICK_HEIGHT = 16;
const BRICK_GAP = 4;

interface Brick {
  x: number;
  y: number;
  alive: boolean;
  color: string;
}

const COLORS = [
  'hsl(0, 80%, 60%)',
  'hsl(30, 80%, 60%)',
  'hsl(60, 80%, 60%)',
  'hsl(120, 80%, 50%)',
  'hsl(195, 100%, 50%)',
];

interface Props {
  config: GameDifficultyConfig;
}

const BreakoutGame: React.FC<Props> = ({ config }) => {
  const { t } = useLanguage();
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [highScore, setHighScoreState] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const PADDLE_WIDTH = config.breakoutPaddleWidth;
  const BALL_SPEED = config.breakoutBallSpeed;

  const paddleXRef = useRef(CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2);
  const ballRef = useRef({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 50, dx: BALL_SPEED, dy: -BALL_SPEED });
  const bricksRef = useRef<Brick[]>([]);

  const createBricks = useCallback(() => {
    const bricks: Brick[] = [];
    const offsetX = (CANVAS_WIDTH - (BRICK_COLS * (BRICK_WIDTH + BRICK_GAP) - BRICK_GAP)) / 2;
    
    for (let row = 0; row < BRICK_ROWS; row++) {
      for (let col = 0; col < BRICK_COLS; col++) {
        bricks.push({
          x: offsetX + col * (BRICK_WIDTH + BRICK_GAP),
          y: 60 + row * (BRICK_HEIGHT + BRICK_GAP),
          alive: true,
          color: COLORS[row],
        });
      }
    }
    return bricks;
  }, []);

  const initGame = useCallback(() => {
    paddleXRef.current = CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2;
    ballRef.current = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 50, dx: BALL_SPEED, dy: -BALL_SPEED };
    bricksRef.current = createBricks();
    setScore(0);
    setIsGameOver(false);
    setIsPaused(false);
    setGameStarted(false);
    setIsNewRecord(false);
    setHighScoreState(getHighScore('breakout'));
  }, [createBricks, PADDLE_WIDTH, BALL_SPEED]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const canvasRef = useCanvas((ctx, canvas) => {
    if (isPaused || isGameOver) return;

    // Clear
    ctx.fillStyle = 'hsl(240, 15%, 6%)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw bricks
    bricksRef.current.forEach(brick => {
      if (brick.alive) {
        ctx.fillStyle = brick.color;
        ctx.fillRect(brick.x, brick.y, BRICK_WIDTH, BRICK_HEIGHT);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.strokeRect(brick.x, brick.y, BRICK_WIDTH, BRICK_HEIGHT);
      }
    });

    // Draw paddle
    ctx.fillStyle = 'hsl(156, 100%, 50%)';
    ctx.fillRect(paddleXRef.current, CANVAS_HEIGHT - 30, PADDLE_WIDTH, PADDLE_HEIGHT);

    // Draw ball
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(ballRef.current.x, ballRef.current.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    if (!gameStarted) return;

    // Update ball
    const ball = ballRef.current;
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Wall collision
    if (ball.x - BALL_RADIUS < 0 || ball.x + BALL_RADIUS > CANVAS_WIDTH) {
      ball.dx = -ball.dx;
      const settings = getSettings();
      if (settings.soundEnabled) playTap();
    }
    if (ball.y - BALL_RADIUS < 0) {
      ball.dy = -ball.dy;
      const settings = getSettings();
      if (settings.soundEnabled) playTap();
    }

    // Paddle collision
    if (
      ball.y + BALL_RADIUS > CANVAS_HEIGHT - 30 &&
      ball.y - BALL_RADIUS < CANVAS_HEIGHT - 30 + PADDLE_HEIGHT &&
      ball.x > paddleXRef.current &&
      ball.x < paddleXRef.current + PADDLE_WIDTH
    ) {
      const hitPos = (ball.x - paddleXRef.current) / PADDLE_WIDTH;
      ball.dx = 8 * (hitPos - 0.5);
      ball.dy = -Math.abs(ball.dy);
      const settings = getSettings();
      if (settings.soundEnabled) playTap();
    }

    // Brick collision
    bricksRef.current.forEach(brick => {
      if (!brick.alive) return;
      if (
        ball.x > brick.x &&
        ball.x < brick.x + BRICK_WIDTH &&
        ball.y > brick.y &&
        ball.y < brick.y + BRICK_HEIGHT
      ) {
        brick.alive = false;
        ball.dy = -ball.dy;
        setScore(s => s + 10);
        const settings = getSettings();
        if (settings.soundEnabled) playSuccess();
      }
    });

    // Check win
    if (bricksRef.current.every(b => !b.alive)) {
      setScore(s => {
        const finalScore = s + 500; // Bonus
        setIsGameOver(true);
        const isNew = setHighScore('breakout', finalScore);
        setIsNewRecord(isNew);
        return finalScore;
      });
    }

    // Ball out of bounds
    if (ball.y > CANVAS_HEIGHT) {
      setIsGameOver(true);
      setScore(s => {
        const isNew = setHighScore('breakout', s);
        setIsNewRecord(isNew);
        const settings = getSettings();
        if (settings.soundEnabled) playError();
        return s;
      });
    }
  }, !isPaused && !isGameOver);

  const handleMove = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    paddleXRef.current = Math.max(0, Math.min(CANVAS_WIDTH - PADDLE_WIDTH, x - PADDLE_WIDTH / 2));
    if (!gameStarted) setGameStarted(true);
  }, [gameStarted, PADDLE_WIDTH]);

  return (
    <>
      <GameHeader
        score={score}
        highScore={highScore}
        isPaused={isPaused}
        onPause={() => setIsPaused(true)}
        onResume={() => setIsPaused(false)}
        onRestart={initGame}
        gameName={t('打磚塊', 'Breakout')}
      />

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="rounded-xl border border-border touch-none"
          onMouseMove={(e) => handleMove(e.clientX)}
          onTouchMove={(e) => handleMove(e.touches[0].clientX)}
          onTouchStart={(e) => handleMove(e.touches[0].clientX)}
        />

        {!gameStarted && !isGameOver && (
          <div className="mt-4 text-muted-foreground">
            {t('滑動控制底板', 'Slide to control paddle')}
          </div>
        )}
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
          gameName={t('打磚塊', 'Breakout')}
          gameId="breakout"
          onRestart={initGame}
        />
      )}
    </>
  );
};

export default BreakoutGame;

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
const PADDLE_WIDTH = 60;
const PADDLE_HEIGHT = 10;
const BALL_SIZE = 12;
const WIN_SCORE = 7;

interface Props {
  config: GameDifficultyConfig;
}

const PongGame: React.FC<Props> = ({ config }) => {
  const { t } = useLanguage();
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [highScore, setHighScoreState] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);

  const AI_SPEED = config.pongAISpeed;
  const BALL_SPEED = config.pongBallSpeed;

  const playerPaddleRef = useRef(CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2);
  const aiPaddleRef = useRef(CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2);
  const ballRef = useRef({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, dx: BALL_SPEED, dy: BALL_SPEED });

  const initGame = useCallback(() => {
    playerPaddleRef.current = CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2;
    aiPaddleRef.current = CANVAS_WIDTH / 2 - PADDLE_WIDTH / 2;
    ballRef.current = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, dx: BALL_SPEED, dy: BALL_SPEED };
    setPlayerScore(0);
    setAiScore(0);
    setIsGameOver(false);
    setIsPaused(false);
    setGameStarted(false);
    setIsNewRecord(false);
    setHighScoreState(getHighScore('pong'));
  }, [BALL_SPEED]);

  useEffect(() => {
    initGame();
  }, [initGame]);

  const resetBall = useCallback((towardsPlayer: boolean) => {
    ballRef.current = {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      dx: (Math.random() > 0.5 ? 1 : -1) * BALL_SPEED,
      dy: towardsPlayer ? BALL_SPEED : -BALL_SPEED,
    };
  }, [BALL_SPEED]);

  const canvasRef = useCanvas((ctx, canvas) => {
    if (isPaused || isGameOver) return;

    // Clear
    ctx.fillStyle = 'hsl(240, 15%, 6%)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Center line
    ctx.strokeStyle = 'hsl(240, 10%, 20%)';
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (gameStarted) {
      const ball = ballRef.current;

      // Update ball
      ball.x += ball.dx;
      ball.y += ball.dy;

      // Wall collision
      if (ball.x < BALL_SIZE / 2 || ball.x > canvas.width - BALL_SIZE / 2) {
        ball.dx = -ball.dx;
        const settings = getSettings();
        if (settings.soundEnabled) playTap();
      }

      // Player paddle collision
      if (
        ball.y > canvas.height - 40 &&
        ball.y < canvas.height - 30 &&
        ball.x > playerPaddleRef.current &&
        ball.x < playerPaddleRef.current + PADDLE_WIDTH
      ) {
        ball.dy = -Math.abs(ball.dy) - 0.2;
        const hitPos = (ball.x - playerPaddleRef.current) / PADDLE_WIDTH;
        ball.dx = (hitPos - 0.5) * 10;
        const settings = getSettings();
        if (settings.soundEnabled) playTap();
      }

      // AI paddle collision
      if (
        ball.y < 40 &&
        ball.y > 30 &&
        ball.x > aiPaddleRef.current &&
        ball.x < aiPaddleRef.current + PADDLE_WIDTH
      ) {
        ball.dy = Math.abs(ball.dy) + 0.2;
        const hitPos = (ball.x - aiPaddleRef.current) / PADDLE_WIDTH;
        ball.dx = (hitPos - 0.5) * 10;
        const settings = getSettings();
        if (settings.soundEnabled) playTap();
      }

      // AI movement
      const aiCenter = aiPaddleRef.current + PADDLE_WIDTH / 2;
      if (ball.x < aiCenter - 10) {
        aiPaddleRef.current = Math.max(0, aiPaddleRef.current - AI_SPEED);
      } else if (ball.x > aiCenter + 10) {
        aiPaddleRef.current = Math.min(canvas.width - PADDLE_WIDTH, aiPaddleRef.current + AI_SPEED);
      }

      // Scoring
      if (ball.y < 0) {
        setPlayerScore(s => {
          const newScore = s + 1;
          if (newScore >= WIN_SCORE) {
            setIsGameOver(true);
            const isNew = setHighScore('pong', newScore);
            setIsNewRecord(isNew);
          } else {
            resetBall(false);
          }
          const settings = getSettings();
          if (settings.soundEnabled) playSuccess();
          return newScore;
        });
      }

      if (ball.y > canvas.height) {
        setAiScore(s => {
          const newScore = s + 1;
          if (newScore >= WIN_SCORE) {
            setIsGameOver(true);
            setPlayerScore(ps => {
              const isNew = setHighScore('pong', ps);
              setIsNewRecord(isNew);
              return ps;
            });
          } else {
            resetBall(true);
          }
          const settings = getSettings();
          if (settings.soundEnabled) playError();
          return newScore;
        });
      }
    }

    // Draw AI paddle
    ctx.fillStyle = 'hsl(0, 80%, 55%)';
    ctx.fillRect(aiPaddleRef.current, 30, PADDLE_WIDTH, PADDLE_HEIGHT);

    // Draw player paddle
    ctx.fillStyle = 'hsl(156, 100%, 50%)';
    ctx.fillRect(playerPaddleRef.current, canvas.height - 40, PADDLE_WIDTH, PADDLE_HEIGHT);

    // Draw ball
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(ballRef.current.x, ballRef.current.y, BALL_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();

    // Draw scores
    ctx.fillStyle = 'hsl(240, 10%, 40%)';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(aiScore), canvas.width / 2, canvas.height / 2 - 30);
    ctx.fillText(String(playerScore), canvas.width / 2, canvas.height / 2 + 60);
  }, !isPaused && !isGameOver);

  const handleMove = useCallback((clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    playerPaddleRef.current = Math.max(0, Math.min(CANVAS_WIDTH - PADDLE_WIDTH, x - PADDLE_WIDTH / 2));
    if (!gameStarted) setGameStarted(true);
  }, [gameStarted]);

  return (
    <>
      <GameHeader
        score={playerScore}
        highScore={highScore}
        isPaused={isPaused}
        onPause={() => setIsPaused(true)}
        onResume={() => setIsPaused(false)}
        onRestart={initGame}
        gameName={t('乒乓對戰', 'Pong')}
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
            {t('滑動控制球拍，先得7分贏', 'Slide to move, first to 7 wins')}
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
          score={playerScore}
          highScore={Math.max(highScore, playerScore)}
          isNewRecord={isNewRecord}
          gameName={t('乒乓對戰', 'Pong')}
          gameId="pong"
          onRestart={initGame}
        />
      )}
    </>
  );
};

export default PongGame;

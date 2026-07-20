import { useState, useCallback } from 'react';
import GameHeader from '@/components/GameHeader';
import GameOverModal from '@/components/GameOverModal';
import StartScreen from '@/components/StartScreen';
import { getHighScore, setHighScore } from '@/lib/storage';
import { useLanguage } from '@/contexts/LanguageContext';
import { playTap, playSuccess, playError } from '@/lib/sounds';
import { getSettings } from '@/lib/storage';
import { GameDifficultyConfig } from '@/contexts/DifficultyContext';

type Cell = 'X' | 'O' | null;
type Board = Cell[];

const WINNING_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6], // diagonals
];

const checkWinner = (board: Board): Cell => {
  for (const [a, b, c] of WINNING_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
};

const getRandomMove = (board: Board): number => {
  const empty = board.map((c, i) => c === null ? i : -1).filter(i => i !== -1);
  return empty[Math.floor(Math.random() * empty.length)];
};

const getSmartMove = (board: Board): number => {
  // Try to win
  for (const [a, b, c] of WINNING_LINES) {
    const cells = [board[a], board[b], board[c]];
    if (cells.filter(c => c === 'O').length === 2 && cells.includes(null)) {
      return [a, b, c][cells.indexOf(null)];
    }
  }
  
  // Block player
  for (const [a, b, c] of WINNING_LINES) {
    const cells = [board[a], board[b], board[c]];
    if (cells.filter(c => c === 'X').length === 2 && cells.includes(null)) {
      return [a, b, c][cells.indexOf(null)];
    }
  }
  
  // Take center
  if (board[4] === null) return 4;
  
  // Take corner
  const corners = [0, 2, 6, 8].filter(i => board[i] === null);
  if (corners.length > 0) {
    return corners[Math.floor(Math.random() * corners.length)];
  }
  
  // Take any
  return getRandomMove(board);
};

const getPerfectMove = (board: Board): number => {
  // Minimax algorithm
  const minimax = (b: Board, isMaximizing: boolean): number => {
    const winner = checkWinner(b);
    if (winner === 'O') return 10;
    if (winner === 'X') return -10;
    if (!b.includes(null)) return 0;

    if (isMaximizing) {
      let best = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (b[i] === null) {
          b[i] = 'O';
          best = Math.max(best, minimax(b, false));
          b[i] = null;
        }
      }
      return best;
    } else {
      let best = Infinity;
      for (let i = 0; i < 9; i++) {
        if (b[i] === null) {
          b[i] = 'X';
          best = Math.min(best, minimax(b, true));
          b[i] = null;
        }
      }
      return best;
    }
  };

  let bestMove = -1;
  let bestScore = -Infinity;
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      const newBoard = [...board];
      newBoard[i] = 'O';
      const score = minimax(newBoard, false);
      if (score > bestScore) {
        bestScore = score;
        bestMove = i;
      }
    }
  }
  return bestMove;
};

interface Props {
  config: GameDifficultyConfig;
}

const TicTacToe: React.FC<Props> = ({ config }) => {
  const { t } = useLanguage();
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [wins, setWins] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [highScore, setHighScoreState] = useState(getHighScore('tictactoe'));
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [result, setResult] = useState<'win' | 'lose' | 'draw' | null>(null);

  const aiLevel = config.tictactoeAILevel;

  const getAIMove = useCallback((b: Board): number => {
    switch (aiLevel) {
      case 'random':
        return getRandomMove(b);
      case 'perfect':
        return getPerfectMove(b);
      default:
        return getSmartMove(b);
    }
  }, [aiLevel]);

  const initGame = useCallback(() => {
    setBoard(Array(9).fill(null));
    setIsGameOver(false);
    setIsPaused(false);
    setResult(null);
    setIsNewRecord(false);
    setHighScoreState(getHighScore('tictactoe'));
  }, []);

  const handleClick = (index: number) => {
    if (board[index] || isGameOver || isPaused) return;

    const settings = getSettings();
    if (settings.soundEnabled) playTap();

    const newBoard = [...board];
    newBoard[index] = 'X';
    setBoard(newBoard);

    const winner = checkWinner(newBoard);
    if (winner === 'X') {
      const newWins = wins + 1;
      setWins(newWins);
      setResult('win');
      setIsGameOver(true);
      const isNew = setHighScore('tictactoe', newWins);
      setIsNewRecord(isNew);
      if (settings.soundEnabled) playSuccess();
      return;
    }

    if (!newBoard.includes(null)) {
      setResult('draw');
      setIsGameOver(true);
      return;
    }

    // AI move
    setTimeout(() => {
      const aiMove = getAIMove(newBoard);
      if (aiMove !== undefined && aiMove !== -1) {
        newBoard[aiMove] = 'O';
        setBoard([...newBoard]);

        const aiWinner = checkWinner(newBoard);
        if (aiWinner === 'O') {
          setResult('lose');
          setIsGameOver(true);
          if (settings.soundEnabled) playError();
        } else if (!newBoard.includes(null)) {
          setResult('draw');
          setIsGameOver(true);
        }
      }
    }, 300);
  };

  const resetAll = () => {
    setWins(0);
    initGame();
  };

  return (
    <>
      <GameHeader
        score={wins}
        highScore={highScore}
        isPaused={isPaused}
        onPause={() => setIsPaused(true)}
        onResume={() => setIsPaused(false)}
        onRestart={resetAll}
        gameName={t('井字遊戲', 'Tic Tac Toe')}
      />

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="text-center mb-4">
          <span className="text-lg font-medium">{t('連勝', 'Wins')}: </span>
          <span className="text-2xl font-bold neon-text">{wins}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 bg-muted/30 p-2 rounded-2xl">
          {board.map((cell, i) => (
            <button
              key={i}
              onClick={() => handleClick(i)}
              disabled={!!cell || isGameOver || isPaused}
              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-xl text-4xl font-bold transition-all ${
                cell === 'X'
                  ? 'bg-primary text-primary-foreground'
                  : cell === 'O'
                  ? 'bg-secondary text-secondary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {cell}
            </button>
          ))}
        </div>

        {result && (
          <div className="mt-4 text-xl font-bold">
            {result === 'win' && <span className="text-primary">{t('你贏咗！', 'You win!')}</span>}
            {result === 'lose' && <span className="text-destructive">{t('你輸咗！', 'You lose!')}</span>}
            {result === 'draw' && <span className="text-muted-foreground">{t('平手！', 'Draw!')}</span>}
          </div>
        )}
      </div>

      {isPaused && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-2xl font-bold">{t('暫停中', 'Paused')}</div>
        </div>
      )}

      {isGameOver && result === 'win' && (
        <GameOverModal
          score={wins}
          highScore={Math.max(highScore, wins)}
          isNewRecord={isNewRecord}
          gameName={t('井字遊戲', 'Tic Tac Toe')}
          gameId="tictactoe"
          onRestart={initGame}
        />
      )}

      {isGameOver && result !== 'win' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-card rounded-3xl p-6 shadow-2xl animate-scale-in text-center">
            <h2 className="text-2xl font-bold mb-4">
              {result === 'lose' ? t('你輸咗！', 'You lose!') : t('平手！', 'Draw!')}
            </h2>
            <button
              onClick={initGame}
              className="btn-game"
            >
              {t('再玩一局', 'Play Again')}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default TicTacToe;

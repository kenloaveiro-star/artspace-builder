import React, { createContext, useContext, useState, useCallback } from 'react';

export type Difficulty = 'easy' | 'normal' | 'hard';

interface DifficultyContextType {
  difficulty: Difficulty;
  setDifficulty: (difficulty: Difficulty) => void;
}

const DifficultyContext = createContext<DifficultyContextType | undefined>(undefined);

export const DifficultyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [difficulty, setDifficultyState] = useState<Difficulty>('normal');

  const setDifficulty = useCallback((d: Difficulty) => {
    setDifficultyState(d);
  }, []);

  return (
    <DifficultyContext.Provider value={{ difficulty, setDifficulty }}>
      {children}
    </DifficultyContext.Provider>
  );
};

export const useDifficulty = () => {
  const context = useContext(DifficultyContext);
  if (context === undefined) {
    throw new Error('useDifficulty must be used within a DifficultyProvider');
  }
  return context;
};

// Game-specific difficulty configurations
export interface GameDifficultyConfig {
  // Memory Game
  memoryTime: number;
  memoryCards: number;
  
  // Snake
  snakeSpeed: number;
  
  // Tetris
  tetrisSpeed: number;
  
  // Flappy Bird
  flappyGap: number;
  flappySpeed: number;
  flappyGravity: number;
  
  // Breakout
  breakoutBallSpeed: number;
  breakoutPaddleWidth: number;
  
  // Dino
  dinoSpeed: number;
  dinoObstacleFrequency: number;
  
  // Pong
  pongAISpeed: number;
  pongBallSpeed: number;
  
  // Simon
  simonShowTime: number;
  
  // Clicker
  clickerTime: number;
  
  // Bubble Shooter
  bubbleRows: number;
  
  // 2048
  game2048ChanceOf4: number;
  
  // TicTacToe
  tictactoeAILevel: 'random' | 'smart' | 'perfect';
  
  // Gold Miner
  goldMinerTime: number;
  goldMinerHookSpeed: number;
  
  // Space Invaders
  spaceInvadersEnemySpeed: number;
  spaceInvadersLives: number;
  
  // Pac-Man
  pacmanGhostSpeed: number;
  pacmanLives: number;
  
  // Stacker
  stackerSpeed: number;
  
  // Fruit Ninja
  fruitNinjaLives: number;
  fruitNinjaSpawnRate: number;
}

export const getDifficultyConfig = (difficulty: Difficulty): GameDifficultyConfig => {
  switch (difficulty) {
    case 'easy':
      return {
        memoryTime: 90,
        memoryCards: 12,
        snakeSpeed: 180,
        tetrisSpeed: 600,
        flappyGap: 200,
        flappySpeed: 1.5,
        flappyGravity: 0.25,
        breakoutBallSpeed: 3,
        breakoutPaddleWidth: 100,
        dinoSpeed: 5,
        dinoObstacleFrequency: 0.01,
        pongAISpeed: 2,
        pongBallSpeed: 3,
        simonShowTime: 500,
        clickerTime: 45,
        bubbleRows: 4,
        game2048ChanceOf4: 0.05,
        tictactoeAILevel: 'random',
        goldMinerTime: 45,
        goldMinerHookSpeed: 3,
        spaceInvadersEnemySpeed: 600,
        spaceInvadersLives: 5,
        pacmanGhostSpeed: 200,
        pacmanLives: 5,
        stackerSpeed: 1.5,
        fruitNinjaLives: 5,
        fruitNinjaSpawnRate: 1200,
      };
    case 'hard':
      return {
        memoryTime: 40,
        memoryCards: 20,
        snakeSpeed: 80,
        tetrisSpeed: 350,
        flappyGap: 140,
        flappySpeed: 3,
        flappyGravity: 0.5,
        breakoutBallSpeed: 6,
        breakoutPaddleWidth: 60,
        dinoSpeed: 8,
        dinoObstacleFrequency: 0.04,
        pongAISpeed: 5,
        pongBallSpeed: 6,
        simonShowTime: 250,
        clickerTime: 20,
        bubbleRows: 8,
        game2048ChanceOf4: 0.2,
        tictactoeAILevel: 'perfect',
        goldMinerTime: 20,
        goldMinerHookSpeed: 5,
        spaceInvadersEnemySpeed: 300,
        spaceInvadersLives: 2,
        pacmanGhostSpeed: 100,
        pacmanLives: 2,
        stackerSpeed: 4,
        fruitNinjaLives: 2,
        fruitNinjaSpawnRate: 600,
      };
    default: // normal
      return {
        memoryTime: 60,
        memoryCards: 16,
        snakeSpeed: 120,
        tetrisSpeed: 500,
        flappyGap: 170,
        flappySpeed: 2,
        flappyGravity: 0.35,
        breakoutBallSpeed: 4,
        breakoutPaddleWidth: 80,
        dinoSpeed: 6,
        dinoObstacleFrequency: 0.02,
        pongAISpeed: 3,
        pongBallSpeed: 4,
        simonShowTime: 350,
        clickerTime: 30,
        bubbleRows: 6,
        game2048ChanceOf4: 0.1,
        tictactoeAILevel: 'smart',
        goldMinerTime: 30,
        goldMinerHookSpeed: 4,
        spaceInvadersEnemySpeed: 500,
        spaceInvadersLives: 3,
        pacmanGhostSpeed: 150,
        pacmanLives: 3,
        stackerSpeed: 2.5,
        fruitNinjaLives: 3,
        fruitNinjaSpawnRate: 900,
      };
  }
};

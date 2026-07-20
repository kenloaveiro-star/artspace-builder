export interface GameInfo {
  id: string;
  name: string;
  nameEn: string;
  emoji: string;
  description: string;
  descriptionEn: string;
  color: string;
}

export const games: GameInfo[] = [
  {
    id: "memory",
    name: "甜點記憶配對",
    nameEn: "Memory Match",
    emoji: "🍰",
    description: "記性差？食多啲甜嘢補腦啦！",
    descriptionEn: "Match the desserts before time runs out!",
    color: "neon-pink",
  },
  {
    id: "2048",
    name: "2048",
    nameEn: "2048",
    emoji: "🔢",
    description: "滑到2048你就係數學天才！",
    descriptionEn: "Slide and merge to reach 2048!",
    color: "neon-orange",
  },
  {
    id: "snake",
    name: "貪食蛇",
    nameEn: "Snake",
    emoji: "🐍",
    description: "好肚餓，食晒成個畫面！",
    descriptionEn: "Eat and grow, don't hit yourself!",
    color: "neon-green",
  },
  {
    id: "tictactoe",
    name: "井字遊戲",
    nameEn: "Tic Tac Toe",
    emoji: "⭕",
    description: "AI都贏唔到你...hopefully",
    descriptionEn: "Beat the AI in this classic game!",
    color: "neon-blue",
  },
  {
    id: "flappy",
    name: "飛鳥跳管",
    nameEn: "Flappy Bird",
    emoji: "🐦",
    description: "撞管等於遲到，小心！",
    descriptionEn: "Tap to fly, avoid the pipes!",
    color: "neon-yellow",
  },
  {
    id: "clicker",
    name: "點擊狂人",
    nameEn: "Clicker",
    emoji: "👆",
    description: "手指運動，練到打字快三倍",
    descriptionEn: "Click as fast as you can!",
    color: "neon-purple",
  },
  {
    id: "tetris",
    name: "俄羅斯方塊",
    nameEn: "Tetris",
    emoji: "🧱",
    description: "人生就係俾方塊填滿...",
    descriptionEn: "Stack blocks and clear lines!",
    color: "neon-blue",
  },
  {
    id: "breakout",
    name: "打磚塊",
    nameEn: "Breakout",
    emoji: "🎯",
    description: "發洩一下，打爆啲磚！",
    descriptionEn: "Break all the bricks!",
    color: "neon-orange",
  },
  {
    id: "dino",
    name: "暴龍跑酷",
    nameEn: "Dino Run",
    emoji: "🦖",
    description: "斷網都玩得嘅經典！",
    descriptionEn: "Jump over cacti and birds!",
    color: "neon-green",
  },
  {
    id: "bubble",
    name: "泡泡射擊",
    nameEn: "Bubble Shooter",
    emoji: "🫧",
    description: "三個波波消失，好治癒",
    descriptionEn: "Match 3 bubbles to pop them!",
    color: "neon-pink",
  },
  {
    id: "pong",
    name: "乒乓對戰",
    nameEn: "Pong",
    emoji: "🏓",
    description: "打低AI證明你係真波王",
    descriptionEn: "Beat the AI in classic Pong!",
    color: "neon-yellow",
  },
  {
    id: "simon",
    name: "顏色記憶",
    nameEn: "Simon Says",
    emoji: "🎨",
    description: "記住燈光順序，考你腦力",
    descriptionEn: "Remember the color sequence!",
    color: "neon-purple",
  },
  {
    id: "spaceinvaders",
    name: "太空射擊",
    nameEn: "Space Invaders",
    emoji: "👾",
    description: "射射射外星人，通勤守衛地球！",
    descriptionEn: "Defend Earth from alien invaders!",
    color: "neon-green",
  },
  {
    id: "pacman",
    name: "貪吃鬼",
    nameEn: "Pac-Man",
    emoji: "🟡",
    description: "吃吃吃豆豆，通勤避鬼大師！",
    descriptionEn: "Eat dots and avoid ghosts!",
    color: "neon-yellow",
  },
  {
    id: "fruitninja",
    name: "水果忍者",
    nameEn: "Fruit Ninja",
    emoji: "🍉",
    description: "刷刷刷切水果，通勤解壓神技！",
    descriptionEn: "Slice fruits, avoid bombs!",
    color: "neon-green",
  },
];

export const getRandomGame = (): GameInfo => {
  return games[Math.floor(Math.random() * games.length)];
};

export const getGameById = (id: string): GameInfo | undefined => {
  return games.find(game => game.id === id);
};

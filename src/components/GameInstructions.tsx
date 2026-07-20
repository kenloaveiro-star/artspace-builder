import { useState, useEffect } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { X } from 'lucide-react';

interface GameInstructionsProps {
  gameId: string;
  onDismiss: () => void;
}

interface Instructions {
  title: string;
  titleEn: string;
  steps: string[];
  stepsEn: string[];
  tip: string;
  tipEn: string;
}

const gameInstructions: Record<string, Instructions> = {
  memory: {
    title: "甜點記憶配對",
    titleEn: "Memory Match",
    steps: ["點擊卡片翻開", "記住圖案位置", "配對相同圖案"],
    stepsEn: ["Tap cards to flip", "Remember positions", "Match pairs"],
    tip: "60秒內配對所有卡片",
    tipEn: "Match all cards in 60 seconds",
  },
  "2048": {
    title: "2048",
    titleEn: "2048",
    steps: ["上下左右滑動", "相同數字會合併", "目標合成2048"],
    stepsEn: ["Swipe up/down/left/right", "Same numbers merge", "Reach 2048"],
    tip: "保持最大數字在角落",
    tipEn: "Keep largest number in corner",
  },
  snake: {
    title: "貪食蛇",
    titleEn: "Snake",
    steps: ["用方向按鈕控制", "食紅色豆豆長身", "避開牆壁和自己"],
    stepsEn: ["Use D-pad to move", "Eat red dots to grow", "Avoid walls and yourself"],
    tip: "唔好回頭！",
    tipEn: "Don't turn back!",
  },
  tictactoe: {
    title: "井字遊戲",
    titleEn: "Tic Tac Toe",
    steps: ["點擊格子落子", "三個連成一線就贏", "你係 X，AI係 O"],
    stepsEn: ["Tap to place your mark", "Get 3 in a row to win", "You are X, AI is O"],
    tip: "先佔角落或中間",
    tipEn: "Take corners or center first",
  },
  flappy: {
    title: "飛鳥跳管",
    titleEn: "Flappy Bird",
    steps: ["點擊屏幕跳起", "穿過綠色水管", "撞到即死"],
    stepsEn: ["Tap anywhere to jump", "Fly through pipes", "Don't crash!"],
    tip: "輕輕點，保持穩定",
    tipEn: "Tap gently, stay steady",
  },
  clicker: {
    title: "點擊狂人",
    titleEn: "Clicker",
    steps: ["瘋狂點擊按鈕", "30秒內盡量點", "挑戰最高紀錄"],
    stepsEn: ["Tap the button fast", "Click as much in 30s", "Beat your record"],
    tip: "用多隻手指輪流點",
    tipEn: "Use multiple fingers",
  },
  tetris: {
    title: "俄羅斯方塊",
    titleEn: "Tetris",
    steps: ["左右滑動移動方塊", "點擊旋轉", "填滿一行會消除"],
    stepsEn: ["Swipe left/right to move", "Tap to rotate", "Clear full rows"],
    tip: "唔好堆太高！",
    tipEn: "Don't stack too high!",
  },
  breakout: {
    title: "打磚塊",
    titleEn: "Breakout",
    steps: ["左右滑動底板", "彈球打磚塊", "唔好漏波"],
    stepsEn: ["Slide paddle left/right", "Bounce ball to break bricks", "Don't miss the ball"],
    tip: "用板邊控制球方向",
    tipEn: "Use paddle edges to aim",
  },
  dino: {
    title: "暴龍跑酷",
    titleEn: "Dino Run",
    steps: ["點擊跳躍", "再點擊蹲下", "避開仙人掌和飛鳥"],
    stepsEn: ["Tap to jump", "Tap again to duck", "Avoid cacti and birds"],
    tip: "睇準時機跳！",
    tipEn: "Time your jumps!",
  },
  bubble: {
    title: "泡泡射擊",
    titleEn: "Bubble Shooter",
    steps: ["拖曳瞄準方向", "放開射出泡泡", "3個同色消除"],
    stepsEn: ["Drag to aim", "Release to shoot", "Match 3 to pop"],
    tip: "用牆壁反彈射死角",
    tipEn: "Bounce off walls",
  },
  pong: {
    title: "乒乓對戰",
    titleEn: "Pong",
    steps: ["上下滑動控制球拍", "打走對手的球", "得5分勝出"],
    stepsEn: ["Slide up/down to move", "Return the ball", "First to 5 wins"],
    tip: "預判球嘅角度",
    tipEn: "Predict ball angle",
  },
  simon: {
    title: "顏色記憶",
    titleEn: "Simon Says",
    steps: ["睇住燈光順序", "按順序點擊顏色", "每輪增加一個"],
    stepsEn: ["Watch the light sequence", "Repeat the pattern", "Gets longer each round"],
    tip: "用口講出顏色幫記",
    tipEn: "Say colors out loud",
  },
  goldminer: {
    title: "礦工挖金",
    titleEn: "Gold Miner",
    steps: ["點擊放下鉤子", "抓取金塊得分", "達到目標分數過關"],
    stepsEn: ["Tap to drop hook", "Grab gold for points", "Reach target to pass level"],
    tip: "大金塊分數高但拉得慢",
    tipEn: "Big gold = more points but slower",
  },
  spaceinvaders: {
    title: "太空射擊",
    titleEn: "Space Invaders",
    steps: ["用左右按鈕移動", "點擊射擊按鈕開火", "消滅所有外星人"],
    stepsEn: ["Use L/R buttons to move", "Tap FIRE to shoot", "Destroy all aliens"],
    tip: "唔好企喺原地！",
    tipEn: "Keep moving!",
  },
  pacman: {
    title: "貪吃鬼",
    titleEn: "Pac-Man",
    steps: ["用方向按鈕移動", "食晒所有豆豆", "大豆可以反殺鬼"],
    stepsEn: ["Use D-pad to move", "Eat all dots", "Power pellets let you eat ghosts"],
    tip: "避開4隻鬼！",
    tipEn: "Avoid the 4 ghosts!",
  },
  stacker: {
    title: "接方塊",
    titleEn: "Stacker",
    steps: ["方塊自動左右移動", "點擊屏幕放下方塊", "疊得越高分越高"],
    stepsEn: ["Blocks move automatically", "Tap to drop block", "Stack higher for more points"],
    tip: "對準下面嘅方塊！",
    tipEn: "Align with block below!",
  },
  fruitninja: {
    title: "水果忍者",
    titleEn: "Fruit Ninja",
    steps: ["滑動手指切水果", "連切多個得combo", "避開炸彈！"],
    stepsEn: ["Swipe to slice fruits", "Combo for bonus points", "Avoid bombs!"],
    tip: "炸彈會扣命",
    tipEn: "Bombs cost a life",
  },
};

const GameInstructions: React.FC<GameInstructionsProps> = ({ gameId, onDismiss }) => {
  const { t } = useLanguage();
  const [show, setShow] = useState(true);
  
  const instructions = gameInstructions[gameId];
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      onDismiss();
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [onDismiss]);
  
  if (!instructions || !show) return null;
  
  const handleDismiss = () => {
    setShow(false);
    onDismiss();
  };
  
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm animate-fade-in"
      onClick={handleDismiss}
    >
      <div 
        className="bg-card border border-border rounded-2xl p-6 mx-4 max-w-sm w-full shadow-xl animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-primary">
            {t(instructions.title, instructions.titleEn)}
          </h2>
          <button 
            onClick={handleDismiss}
            className="p-1 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
        
        <div className="space-y-3 mb-4">
          {(t(instructions.steps.join('|'), instructions.stepsEn.join('|'))).split('|').map((step, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 text-primary font-bold text-sm flex items-center justify-center">
                {i + 1}
              </span>
              <span className="text-foreground">{step}</span>
            </div>
          ))}
        </div>
        
        <div className="bg-primary/10 rounded-xl p-3 border border-primary/20">
          <p className="text-sm text-primary">
            💡 {t(instructions.tip, instructions.tipEn)}
          </p>
        </div>
        
        <p className="text-center text-xs text-muted-foreground mt-4">
          {t('點擊任意處開始', 'Tap anywhere to start')}
        </p>
      </div>
    </div>
  );
};

export default GameInstructions;
import React from 'react';
import { Difficulty, useDifficulty } from '@/contexts/DifficultyContext';
import { useLanguage } from '@/contexts/LanguageContext';

interface DifficultySelectorProps {
  onSelect: () => void;
  gameName: string;
}

const DifficultySelector: React.FC<DifficultySelectorProps> = ({ onSelect, gameName }) => {
  const { t } = useLanguage();
  const { difficulty, setDifficulty } = useDifficulty();

  const difficulties: { value: Difficulty; label: string; labelEn: string; emoji: string; color: string }[] = [
    { value: 'easy', label: '簡單', labelEn: 'Easy', emoji: '😊', color: 'bg-emerald-500 hover:bg-emerald-600' },
    { value: 'normal', label: '普通', labelEn: 'Normal', emoji: '😎', color: 'bg-amber-500 hover:bg-amber-600' },
    { value: 'hard', label: '困難', labelEn: 'Hard', emoji: '😈', color: 'bg-red-500 hover:bg-red-600' },
  ];

  const handleSelect = (d: Difficulty) => {
    setDifficulty(d);
    onSelect();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/90 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm bg-card rounded-3xl p-6 shadow-2xl animate-scale-in border border-border">
        <h2 className="text-2xl font-bold text-center mb-2">{gameName}</h2>
        <p className="text-center text-muted-foreground mb-6">
          {t('選擇難度', 'Select Difficulty')}
        </p>
        
        <div className="space-y-3">
          {difficulties.map((d) => (
            <button
              key={d.value}
              onClick={() => handleSelect(d.value)}
              className={`w-full py-4 px-6 rounded-2xl text-white font-bold text-lg flex items-center justify-between transition-all transform hover:scale-[1.02] active:scale-[0.98] ${d.color} ${
                difficulty === d.value ? 'ring-4 ring-white/50' : ''
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="text-2xl">{d.emoji}</span>
                <span>{t(d.label, d.labelEn)}</span>
              </span>
              {difficulty === d.value && (
                <span className="text-sm bg-white/20 px-2 py-1 rounded-full">
                  {t('已選', 'Selected')}
                </span>
              )}
            </button>
          ))}
        </div>
        
        <p className="text-center text-xs text-muted-foreground mt-4">
          {t('難度會影響遊戲速度和挑戰性', 'Difficulty affects game speed and challenge')}
        </p>
      </div>
    </div>
  );
};

export default DifficultySelector;

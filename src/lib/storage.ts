const HIGH_SCORE_PREFIX = "artspace_game_highscore_";
const SETTINGS_KEY = "artspace_game_settings";

export interface AppSettings {
  soundEnabled: boolean;
  language: "zh" | "en";
}

const DEFAULT_SETTINGS: AppSettings = {
  soundEnabled: true,
  language: "zh",
};

export const getHighScore = (gameId: string): number => {
  try {
    if (typeof window === "undefined") return 0;
    const v = window.localStorage.getItem(HIGH_SCORE_PREFIX + gameId);
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    return 0;
  }
};

/** Returns true when the score is a new record. */
export const setHighScore = (gameId: string, score: number): boolean => {
  try {
    if (typeof window === "undefined") return false;
    const current = getHighScore(gameId);
    if (score > current) {
      window.localStorage.setItem(HIGH_SCORE_PREFIX + gameId, String(score));
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

export const getSettings = (): AppSettings => {
  try {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const setSettings = (settings: Partial<AppSettings>): void => {
  try {
    if (typeof window === "undefined") return;
    const merged = { ...getSettings(), ...settings };
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  } catch {
    /* ignore */
  }
};

// Alias used by LanguageContext from the skill.
export const saveSettings = setSettings;

export interface QuizQuestion {
  id: number;
  word: string;
  description: string;
}

export interface Player {
  name: string;
  score: number;
  timestamp: number;
}

export type GameState = 'start' | 'playing' | 'gameOver' | 'ranking'; 
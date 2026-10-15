export type BattingFigure = {
  playerId: string;
  player: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  dismissal: string | null;
};

export type BowlingFigure = {
  playerId: string;
  player: string;
  runsConceded: number;
  legalBalls: number;
  maidens: number;
  wickets: number;
  overs: string;
};

export type InningsScorecard = {
  inningsNumber: number;
  battingTeam: string | null;
  isSuperOver: boolean;
  totalRuns: number;
  wickets: number;
  legalBalls: number;
  overs: string;
  runRate: number;
  extras: {
    total: number;
    wides: number;
    noBalls: number;
    byes: number;
    legByes: number;
    penalty: number;
    other: number;
  };
  batting: BattingFigure[];
  bowling: BowlingFigure[];
};

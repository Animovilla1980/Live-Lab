export type GateStatus = 'PASS' | 'BLOCK' | 'UNKNOWN';
export type GateResult = { status: GateStatus; predictedScore: string | null; totalGoals: number | null; reason: string };

export function parsePredictedScore(score?: string | null): [number, number] | null {
  if (!score) return null;
  const m = String(score).trim().match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
}

// Live Lab rule: the Forebet Gate blocks ONLY exact scores incompatible with Over 1.5.
// Therefore 0-0, 1-0 and 0-1 are blocked; 2-0, 0-2, 3-0, 0-3 etc. pass.
export function evaluateForebetGate(predictedScore?: string | null): GateResult {
  const parsed = parsePredictedScore(predictedScore);
  if (!parsed) return { status:'UNKNOWN', predictedScore: predictedScore ?? null, totalGoals:null, reason:'Risultato esatto Forebet non disponibile o non leggibile: alert consentito.' };
  const totalGoals = parsed[0] + parsed[1];
  if (totalGoals < 2) return { status:'BLOCK', predictedScore: `${parsed[0]}-${parsed[1]}`, totalGoals, reason:'RE Forebet con meno di 2 gol totali: incompatibile con Over 1,5.' };
  return { status:'PASS', predictedScore: `${parsed[0]}-${parsed[1]}`, totalGoals, reason:'RE Forebet con almeno 2 gol totali: compatibile con Over 1,5.' };
}

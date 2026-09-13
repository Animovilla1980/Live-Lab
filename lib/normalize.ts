export function normTeam(v=''){return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\b(fc|cf|ac|sc|fk|calcio|football club)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim()}
export function sameTeam(a='',b=''){const x=normTeam(a),y=normTeam(b);return !!x&&!!y&&(x===y||x.includes(y)||y.includes(x))}

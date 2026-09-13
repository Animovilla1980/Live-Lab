export const DEFAULT_WHITELIST = [
  'Australia A-League',
  'Austria 2. Liga','Austria Bundesliga',
  'Belgium Cup','Belgium First Division A','Belgium Reserve League',
  'Bosnia & Herzegovina Premier Liga','Bulgaria First League','Chile Primera Division',
  'Croatia 1.HNL','Croatia 2.HNL','Czech Republic First League','Denmark Superligaen',
  'Estonia Esiliiga','Estonia Meistriliiga',
  'Finland Kakkonen Group A','Finland Kakkonen Group B','Finland Kakkonen Group C','Finland Kakkonnen Play-Offs','Finland Kolmonen','Finland Veikkausliiga','Finland Ykkonen',
  'France National',
  'Germany 3.Liga','Germany Bundesliga I','Germany Bundesliga II','Germany Bundesliga II Play-Offs','Germany Bundesliga Play-Offs',
  'Greece Super League 1','Hungary NB I','Iceland Premier League','India I-League','Indonesia Liga 1','Northern Ireland Premier','Israel Premier League',
  'Itália - Série B','Italy Serie A','Italy Serie B','Japan J-League','Latvia 1. Liga',
  'Netherlands Eerste Divisie','Netherlands Eredivisie','Norway Division 1','Norway Eliteserien','Peru Liga 1','Poland Ekstraklasa','Portugal Primeira Liga',
  'Romania Liga II','Saudi Arabia Premier League','Serbia Super Liga','Slovakia Super Liga',
  'South Korea K League 1','South Korea K League 2','South Korea K-League 1','South Korea K-League 2',
  'Spain Primera Liga',
  'Sweden 1.div Norra','Sweden 1.div Södra','Sweden 2.div Norra Götaland','Sweden 2.div Norra Svealand','Sweden 2.div Norrland','Sweden 2.div Södra Götaland','Sweden 2.div Västra Götaland','Sweden Allsvenskan','Sweden Superettan',
  'Switzerland Super League','Tunisia League 1',
  'England Championship','England FA Cup','England League 1','England League 2','England National League','Scotland Championship','Scotland League One','Scotland League Two','Wales Premier League',
  'AFC Asian Cup','AFC Asian Cup Qualifiers','AFC Champions League','AFC Champions League Qualification','FIFA Club World Cup'
];

// Dati mostrati nello storico InPlayGuru condiviso dall'utente. Sono mantenuti come
// baseline separata e non vengono reinterpretati: picks/strike/fairOdd sono quelli visualizzati.
export const LEGACY_OVERALL = { picks: 106, resolved: 101, hits: 75, misses: 26, pending: 5, strike: 74, fairOdd: 1.35 };

export const LEGACY_LEAGUE_STATS = {
  'England League 1': { picks: 11, strike: 64, fairOdd: 1.56 },
  'Japan J-League': { picks: 11, strike: 90, fairOdd: 1.11 },
  'England League 2': { picks: 10, strike: 78, fairOdd: 1.28 },
  'Poland Ekstraklasa': { picks: 8, strike: 75, fairOdd: 1.33 },
  'Peru Liga 1': { picks: 8, strike: 86, fairOdd: 1.16 },
  'Sweden Allsvenskan': { picks: 7, strike: 57, fairOdd: 1.75 },
  'Italy Serie A': { picks: 7, strike: 71, fairOdd: 1.41 },
  'Portugal Primeira Liga': { picks: 6, strike: 67, fairOdd: 1.49 },
  'Denmark Superligaen': { picks: 5, strike: 80, fairOdd: 1.25 },
  'Belgium First Division A': { picks: 5, strike: 75, fairOdd: 1.33 },
  'England Championship': { picks: 5, strike: 60, fairOdd: 1.67 },
  'Netherlands Eerste Divisie': { picks: 5, strike: 80, fairOdd: 1.25 },
  'Germany Bundesliga II': { picks: 4, strike: 100, fairOdd: 1.00 },
  'Austria Bundesliga': { picks: 4, strike: 67, fairOdd: 1.49 },
  'Slovakia Super Liga': { picks: 4, strike: 75, fairOdd: 1.33 },
  'Italy Serie B': { picks: 2, strike: 50, fairOdd: 2.00 },
  'Netherlands Eredivisie': { picks: 1, strike: 100, fairOdd: 1.00 },
  'Switzerland Super League': { picks: 1, strike: 0, fairOdd: null },
  'Norway Eliteserien': { picks: 1, strike: 100, fairOdd: 1.00 },
  'Greece Super League 1': { picks: 1, strike: 100, fairOdd: 1.00 }
};

const WORD_MAP = [
  [/\binghilterra\b/g,'england'],[/\bscozia\b/g,'scotland'],[/\bgalles\b/g,'wales'],[/\birlanda del nord\b/g,'northern ireland'],
  [/\bitalia\b/g,'italy'],[/\bgermania\b/g,'germany'],[/\bpolonia\b/g,'poland'],[/\bportogallo\b/g,'portugal'],[/\bspagna\b/g,'spain'],
  [/\bfrancia\b/g,'france'],[/\bolanda\b/g,'netherlands'],[/\bpaesi bassi\b/g,'netherlands'],[/\bsvezia\b/g,'sweden'],[/\bnorvegia\b/g,'norway'],
  [/\bdanimarca\b/g,'denmark'],[/\bgrecia\b/g,'greece'],[/\bsvizzera\b/g,'switzerland'],[/\brepubblica ceca\b/g,'czech republic'],[/\bcechia\b/g,'czech republic'],
  [/\bcroazia\b/g,'croatia'],[/\bbosnia erzegovina\b/g,'bosnia herzegovina'],[/\bcorea del sud\b/g,'south korea'],[/\bgiappone\b/g,'japan'],
  [/\bperu\b/g,'peru'],[/\barabia saudita\b/g,'saudi arabia'],[/\bromania\b/g,'romania'],[/\bserbia\b/g,'serbia'],[/\bslovacchia\b/g,'slovakia'],
  [/\bungheria\b/g,'hungary'],[/\bislanda\b/g,'iceland'],[/\bfinlandia\b/g,'finland'],[/\bestonia\b/g,'estonia'],[/\blettonia\b/g,'latvia'],
  [/\baustralia\b/g,'australia'],[/\baustria\b/g,'austria'],[/\bbelgio\b/g,'belgium'],[/\bbulgaria\b/g,'bulgaria'],[/\bcile\b/g,'chile'],
  [/\bindia\b/g,'india'],[/\bindonesia\b/g,'indonesia'],[/\bisraele\b/g,'israel'],[/\btunisia\b/g,'tunisia']
];

export function normalizeLeagueName(value = '') {
  let s = String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  s = s.replace(/[–—:|/()\[\],.]/g,' ').replace(/[-_]/g,' ');
  for (const [re, out] of WORD_MAP) s = s.replace(re, out);
  s = s.replace(/\b2 bundesliga\b/g,'bundesliga ii')
       .replace(/\b1 bundesliga\b/g,'bundesliga i')
       .replace(/\b2 liga\b/g,'2 liga')
       .replace(/\bserie b brasil\b/g,'serie b')
       .replace(/\bprima divisione\b/g,'first division')
       .replace(/\bprima liga\b/g,'primeira liga')
       .replace(/\bdivisione 1\b/g,'division 1')
       .replace(/\bleague one\b/g,'league 1')
       .replace(/\bleague two\b/g,'league 2')
       .replace(/\s+/g,' ').trim();
  return s;
}

const SPECIAL_ALIASES = {
  'Germany Bundesliga I': ['germany bundesliga','bundesliga'],
  'Germany Bundesliga II': ['germany bundesliga ii','germany 2 bundesliga','2 bundesliga'],
  'Germany 3.Liga': ['germany 3 liga','3 liga'],
  'Czech Republic First League': ['czech republic first league','czech republic chance liga','czech republic 1 liga','chance liga'],
  'Austria 2. Liga': ['austria 2 liga'],
  'Austria Bundesliga': ['austria bundesliga'],
  'Belgium First Division A': ['belgium first division a','belgium jupiler pro league','jupiler pro league'],
  'Bosnia & Herzegovina Premier Liga': ['bosnia herzegovina premier liga','bosnia herzegovina premier league'],
  'Bulgaria First League': ['bulgaria first league','bulgaria efbet league'],
  'Croatia 1.HNL': ['croatia 1 hnl','croatia hnl'],
  'Croatia 2.HNL': ['croatia 2 hnl','croatia first nl'],
  'Denmark Superligaen': ['denmark superligaen','denmark superliga'],
  'France National': ['france national'],
  'Greece Super League 1': ['greece super league 1','greece super league'],
  'Hungary NB I': ['hungary nb i','hungary otp bank liga'],
  'Iceland Premier League': ['iceland premier league','iceland besta deild karla'],
  'Northern Ireland Premier': ['northern ireland premier','northern ireland nifl premiership'],
  'Israel Premier League': ['israel premier league','israel ligat ha al'],
  'Japan J-League': ['japan j league','japan j1 league'],
  'Netherlands Eerste Divisie': ['netherlands eerste divisie'],
  'Netherlands Eredivisie': ['netherlands eredivisie'],
  'Norway Division 1': ['norway division 1','norway obos ligaen','obos ligaen'],
  'Norway Eliteserien': ['norway eliteserien'],
  'Poland Ekstraklasa': ['poland ekstraklasa'],
  'Portugal Primeira Liga': ['portugal primeira liga','portugal liga portugal'],
  'Romania Liga II': ['romania liga ii','romania liga 2'],
  'Saudi Arabia Premier League': ['saudi arabia premier league','saudi arabia saudi professional league','saudi pro league'],
  'Serbia Super Liga': ['serbia super liga','serbia superliga'],
  'Slovakia Super Liga': ['slovakia super liga','slovakia nike liga'],
  'Spain Primera Liga': ['spain primera liga','spain la liga','laliga'],
  'Sweden Allsvenskan': ['sweden allsvenskan'],
  'Sweden Superettan': ['sweden superettan'],
  'Switzerland Super League': ['switzerland super league'],
  'Tunisia League 1': ['tunisia league 1','tunisia ligue 1'],
  'England Championship': ['england championship'],
  'England FA Cup': ['england fa cup'],
  'England League 1': ['england league 1','england league one'],
  'England League 2': ['england league 2','england league two'],
  'England National League': ['england national league'],
  'Scotland Championship': ['scotland championship'],
  'Scotland League One': ['scotland league one','scotland league 1'],
  'Scotland League Two': ['scotland league two','scotland league 2'],
  'Wales Premier League': ['wales premier league','wales cymru premier','cymru premier'],
  'AFC Champions League': ['afc champions league','afc champions league elite'],
  'AFC Champions League Qualification': ['afc champions league qualification','afc champions league qualifiers'],
  'FIFA Club World Cup': ['fifa club world cup','club world cup']
};

export function aliasesFor(canonical) {
  const base = normalizeLeagueName(canonical);
  return [...new Set([base, ...(SPECIAL_ALIASES[canonical] || []).map(normalizeLeagueName)])];
}

export function findCanonicalLeague(rawLeague, whitelist = DEFAULT_WHITELIST) {
  const raw = normalizeLeagueName(rawLeague);
  if (!raw) return null;
  let best = null;
  let bestScore = -1;
  for (const canonical of whitelist) {
    for (const alias of aliasesFor(canonical)) {
      if (!alias) continue;
      if (raw === alias) return canonical;
      if (raw.includes(alias) || alias.includes(raw)) {
        const score = Math.min(raw.length, alias.length);
        if (score > bestScore) { best = canonical; bestScore = score; }
      }
    }
  }
  return best;
}

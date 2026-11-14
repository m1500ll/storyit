import { describe, expect, it } from 'vitest';
import { conceptToStory, parseTrendReport } from '@shared/trends.ts';

const REPORT = `CONCEPT DU 10 NOVEMBRE 🔥
📈 PARTIE 1 — CE QUI MARCHE VRAIMENT (chiffres relevés aujourd'hui)
1️⃣ LE FORMAT DU JOUR : LE TRAJET ABSURDE.
• Une fille arrive dans un dortoir : son lit est au 299e étage.
🍓 PARTIE 2 — 100 CONCEPTS PRÊTS À TOURNER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔥 LES VRAIS HITS (#1 à #10)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#1 — Le lit au 299e étage | 🇫🇷 compte basé en France, vidéo en anglais | 🔴 « Le dortoir » fait 1,3 M en FR
📊 2,5 M vues en 67 h, rétention 72,4 %
👥 Lisa, kiwi, nouvelle étudiante · La gardienne du dortoir. Résidence étudiante géante à Lyon.
🪝 Hook :
Lisa, à la gardienne, en tombant dans le hall : « Bonjour. Pardon. Il est où, mon lit ? »
La gardienne, en lui tendant un ticket : « B12. Crois-moi, tu vas vouloir être plus haut. »
🎬 Déroulé :
1. Le panneau : « 299 étages. Arrivée estimée : 67 jours. »
2. Un bouchon sur l'échelle.
🔚 Fin de la vidéo : Le haut-parleur : « Étages du bas, préparez-vous à l'inondation. » Lisa : « Quoi ?! »
🖼️ Couverture : MON LIT EST AU 299e ÉTAGE
✍️ Légende : 67 jours de montée pour aller se coucher 🛏️ Partie 1
🔁 À répéter : « J'ai demandé un dortoir, pas l'Everest ! »
💬 À l'écran : « Tu prends l'étage du haut ou du bas ? »
🔗 https://www.tiktok.com/@lovedrama479/video/7705494225487465761
#7 — Elle part vivre chez un garçon | 🇧🇷 Brésil | 🟢 aucune version FR repérée
🪝 Hook :
La mère, à Mélinda : « Tu pars vivre chez un inconnu ? Non ! »
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 LES VARIANTES (#11 à #100), NON TESTÉES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#11 — Le bureau au 300e étage | variante
📊 Variante de « le lit au 299e étage »
🪝 Hook :
Tom, à l'agent d'accueil : « Bonjour, premier jour. C'est quel étage ? »
🔁 À répéter : « J'ai signé un stage, pas une expédition ! »`;

describe('trend report parser', () => {
  const r = parseTrendReport(REPORT);
  it('keeps Part 1 as the insights', () => {
    expect(r.insights).toContain('LE TRAJET ABSURDE');
    expect(r.insights).not.toContain('PARTIE 2');
  });
  it('splits the concepts with their fields, status and kind', () => {
    expect(r.concepts.map((c) => c.number)).toEqual([1, 7, 11]);
    const c1 = r.concepts[0]!;
    expect(c1.title).toBe('Le lit au 299e étage');
    expect(c1.fr_status).toBe('red');
    expect(c1.kind).toBe('hit');
    expect(c1.hook.split('\n')).toHaveLength(2);
    expect(c1.outline).toContain('Un bouchon');
    expect(c1.cover).toBe('MON LIT EST AU 299e ÉTAGE');
    expect(c1.repeat_line).toContain('Everest');
    expect(c1.screen_line).toContain('étage du haut');
    expect(c1.source_url).toMatch(/^https:\/\/www\.tiktok\.com/);
    expect(r.concepts[1]!.fr_status).toBe('green');
    expect(r.concepts[2]!.kind).toBe('variant');
    expect(r.concepts[2]!.outline).toBe(''); // the separator and the "LES VARIANTES" title are not glued to #7
  });
  it('builds the story the Creative Studio prefills', () => {
    const s = conceptToStory(r.concepts[0]!);
    expect(s).toContain('Réplique à répéter (partages)');
    expect(s).toContain('Jeu pour les commentaires');
  });
});

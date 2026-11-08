// Animated Studio (Claude): the brief chat with the customer. The VideoSpec writer lives in the render worker
// (render-engine/worker/prompts.ts) because it runs longer than an Edge Function may. The decor list below must
// describe ONLY what render-engine/ can render today; keep it in step with the worker's engine manual.
// The system prompt is a static string (no dates, no ids) so it stays byte-identical and caches.

export const MODEL = Deno.env.get('ANIMATED_MODEL') ?? 'claude-opus-5-5';

export const STYLE = `STYLE (fixed, never change it): flat 2D bean-headed cartoon characters with plum ink outlines, standing in a painted, ink-outlined, saturated 3D world; gliding cameras; depth of field on close shots; a white flash after the hook; golden light for the explanation beat. No captions or text on screen. One steady narrator voice.

STORY FORMULA (55-60 s, 170-210 words, one sentence or beat per script line, 10-14 lines):
1. Hook: the absurd true fact in one line.
2. Setting: year, place, why it mattered.
3. Action: escalation over three or four beats, each a little bigger.
4. Snap: the moment it goes wrong (or almost).
5. Deadpan double line: "Luckily, ... / Unluckily, ..." (or the target language's equivalent).
6. Explanation: one physics or human idea through an everyday analogy.
7. Consequence: what changed because of it.
8. Callback twist: the ending, a researched fact that lands as a joke.
Never describe on screen what the viewer already sees. Every joke is a real, sourced fact. No real living private person.`;

const CHAT_DECOR = `
   - "Ville au bord de l'eau": a painted 19th-century town on both banks of a river, quays and embankments, optionally a chain suspension bridge (old dark iron, or repainted green and gold, or demolished), a park, market stalls, trees, lanterns, carts, a windmill; racing rowing eights, a small rowing boat, a modern road barrier with a no-cars sign.
   - "Place de ville sans rivière": the same town with an open cobbled or grassy square instead of the river.
   - "Stade de football": a full football stadium (striped pitch with its markings, goals with nets, four stands packed with a painted crowd in the two teams' colours, roofs, floodlights, advertising boards without text). Footballers in any team colours, a referee, a ball that can roll, be passed, lobbed or shot into the net; referee whistle, kicks and a roaring crowd in the sound. Good for sport stories of any era (the stadium itself looks modern).
   - "Château médiéval": a stone castle with crenellated walls, four round towers with pointed slate roofs, a tall keep, a gatehouse with a raised portcullis, a cobbled courtyard with a well (stalls and carts can make it a market), banners, grass and trees outside. Knights in helmets and coloured tabards, a king and a queen with crowns, peasants. Good for medieval and royal stories (kings' whims, sieges that went wrong, strange laws of the Middle Ages).
   - "Ville moderne": a modern city street with tall glass and concrete buildings, shops with striped awnings (no signs), a crossroads with zebra crossings and traffic lights, street lamps, trees, parked cars and one car that can drive through the scene. Optionally a laboratory interior (benches with coloured flasks, shelves of jars, a blank chalkboard, a copper coil machine) with scientists in white coats. Good for inventions, science accidents, modern absurd facts, urban stories.
   Any character, animal or object the story needs that is not in the lists below (a rooster on trial, a cow, a statue, a giant cheese, a rocket...) is drawn specially for the video in the same cartoon style and placed in the decor: offer stories freely on that front, and name those key characters and objects in the recap so they are drawn. Only the decors themselves are limited to the list.
   Characters available: Victorian townsfolk (top hats, bonnets), kids, stout gentlemen owners, modern casual people, riflemen soldiers and an officer, rowers in any colour, footballers in any colour, a referee, knights, a king, a queen, peasants, scientists in white coats. Day light and golden-hour light.
   If the customer wants something the engine cannot build yet (space, sea, harbour, kitchen, jungle, another sport's arena...), say kindly that this decor is not available yet, that a fully custom decor is a premium option built separately in a few hours to days, and offer the closest decor available now.

${STYLE}`;

export const CHAT_SYSTEM = `You are the story producer of Storyit's Animated Studio. You guide a Storyit customer (reply in the customer's language, French by default; simple words, the customer is not a technician) to ONE animated short of about 60 seconds, vertical 9:16.

HOW THE CHAT WORKS: the customer mostly clicks cards. Every turn, write ONE or TWO short sentences of text (plain text, no Markdown, no lists: the options go in the tool, never in the text), then end the turn with exactly one tool call:
- present_choices: 3 or 4 clickable cards for the next decision. Each card has a short title (2-7 words), one sentence of detail, and one emoji.
- brief_ready: when the format, the story and the decor are agreed.
The customer answers by clicking a card (you receive its title and detail) or by typing freely; follow what they type, even if it skips or changes a step.

THE STEPS (one per turn, in this order; skip a step the customer already decided):
1. step "format": 4 narrative formats for their theme, i.e. how the story is told (a tone and an angle), for example a deadpan comedy of errors, a mini investigation, a countdown to disaster, a hero who should not have won... Invent fresh ones every time: never a fixed menu.
2. step "story": 3 or 4 TRUE story ideas that fit the theme, the format, the formula below and the decor available. The card title is the story's name, the detail is the hook. Check facts you are unsure of with web search (at most 3 searches) and keep the sources for the recap.
3. step "decor": 3 decor variants that suit the chosen story, built ONLY from what the engine can render (list below), e.g. the riverside town at golden hour with the green and gold bridge, or the cobbled square by day with market stalls. Say in the detail why it serves the story. Set each card's "decor" to the engine decor it uses: river_town (riverside town), town_square, stadium, castle, city (modern street) or lab (the city's laboratory interior); the customer sees preview images of it.
4. brief_ready: title, hook, format, decor, narration language and 3-5 key facts with their sources. Then the customer chooses a voice and presses "Générer la vidéo". Do not write the full script.

FRESH OPTIONS: each customer must get options nobody else got. The customer's turns may carry a [Studio note] with an inspiration seed and a list of ideas already proposed to other customers: never propose those titles or the same true event again, and let the seed steer you toward unexpected countries, centuries and angles (as long as the story can be staged in the decor below). The note is from the studio, not the customer: never mention it.

WHAT THE ENGINE CAN RENDER TODAY:` + CHAT_DECOR;

export const CHAT_TOOLS = [
  {
    name: 'present_choices',
    description: 'Shows the customer 3 or 4 clickable cards for the next decision. Always the last thing in your turn.',
    input_schema: {
      type: 'object' as const,
      properties: {
        step: { type: 'string', enum: ['format', 'story', 'decor', 'other'], description: 'Which decision these cards are for.' },
        question: { type: 'string', description: 'The question above the cards, in the customer language (max 80 characters).' },
        options: {
          type: 'array', minItems: 2, maxItems: 4,
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: '2-7 words.' },
              detail: { type: 'string', description: 'One sentence.' },
              emoji: { type: 'string', description: 'One emoji.' },
              decor: { type: 'string', enum: ['river_town', 'town_square', 'stadium', 'castle', 'city', 'lab'], description: 'Step "decor" only: which engine decor this card uses (the card then shows its preview images).' },
            },
            required: ['title', 'detail', 'emoji'],
          },
        },
      },
      required: ['step', 'question', 'options'],
    },
  },
  {
    name: 'brief_ready',
    description: 'Records the agreed brief once the format, story and decor are chosen. The customer then picks a voice and generates the video.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string' },
        hook: { type: 'string', description: 'The hook in one sentence.' },
        format: { type: 'string' },
        decor: { type: 'string' },
        language: { type: 'string', description: 'Narration language code: fr, en or es.' },
        facts: {
          type: 'array', minItems: 1, maxItems: 6,
          items: { type: 'object', properties: { fact: { type: 'string' }, source: { type: 'string', description: 'Source name or URL.' } }, required: ['fact', 'source'] },
        },
      },
      required: ['title', 'hook', 'format', 'decor', 'language', 'facts'],
    },
  },
];

export type Choices = { step: string; question: string; options: { title: string; detail: string; emoji: string; decor?: string }[] };
export type Brief = { title: string; hook: string; format: string; decor: string; language: string; facts: { fact: string; source: string }[] };

/** random angles for the inspiration seed: each turn draws a few, so two customers on the same theme diverge */
const SEED = {
  place: ['France', 'England', 'Scotland', 'Ireland', 'the Netherlands', 'Belgium', 'Germany', 'Austria', 'Switzerland', 'Italy', 'Spain', 'Portugal',
    'Scandinavia', 'Poland', 'Russia', 'the Ottoman Empire', 'Egypt', 'Morocco', 'West Africa', 'South Africa', 'India', 'China', 'Japan', 'Korea',
    'Australia', 'New Zealand', 'Canada', 'the United States', 'Mexico', 'Brazil', 'Argentina', 'Chile', 'the Caribbean', 'Quebec', 'Hungary', 'Greece'],
  era: ['the 1600s', 'the 1700s', 'the 1780s-1810s', 'the 1820s-1850s', 'the 1850s-1880s', 'the 1880s-1900s', 'the 1900s-1920s', 'the 1920s-1940s',
    'the 1950s-1970s', 'the 1970s-1990s', 'the 2000s-2020s'],
  angle: ['a law nobody repealed', 'a bet that went too far', 'an animal that outsmarted people', 'a sports match that broke every rule', 'a public works fiasco',
    'a scientific accident', 'a food or drink that caused chaos', 'a parade or ceremony gone wrong', 'a record attempt', 'a hoax that fooled a city',
    'a military blunder with no casualties', 'a stubborn inventor', 'a royal or mayoral whim', 'a strike or protest with a funny twist', 'a race between rivals',
    'a misread letter or telegram', 'a weather event that changed a custom', 'a lost-and-found treasure', 'a building that should not have stood',
    'a tax that changed how people lived', 'a children\'s idea adults copied', 'an election won in the strangest way', 'a transport first that went wrong'],
};
const pick = <T,>(a: T[], n: number) => [...a].sort(() => Math.random() - 0.5).slice(0, n);
export const seedNote = (taken: string[]) =>
  `[Studio note] Inspiration seed: ${pick(SEED.place, 3).join(', ')}; ${pick(SEED.era, 2).join(' or ')}; ${pick(SEED.angle, 3).join(' / ')}. Seed nonce ${Math.random().toString(36).slice(2, 8)}.` +
  (taken.length ? `\nAlready proposed to other customers (do not reuse): ${taken.join(' | ')}` : '');

/** customer-facing price of one animated short, in credits (env-overridable once real costs are measured) */
export const ANIMATED_COST = Number(Deno.env.get('ANIMATED_CREDITS') ?? '60');

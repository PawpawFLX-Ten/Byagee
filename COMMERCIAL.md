# Commercial dining skin

The default build is a short, brand-safe table demo: walk up to hungry guests and serve dishes before the round ends. The original survival game is still in the repo and starts with `?mode=classic`.

## Run

```bash
npm install
npm run dev
```

Production check:

```bash
npm test
npm run build
npm run preview
```

Open the dev server. The start screen is Chinese. Use the EN button for English. Landscape on a phone, same as before.

## Preview the two skins

- Hearth cafeteria: `http://localhost:5173/?skin=hearth`
- Brand pop-up: `http://localhost:5173/?skin=popup`

Or use the two buttons on the start screen. They swap palette, tablecloth, wall color, and the wall plaque.

## Query parameters

| Param | Example | Effect |
| --- | --- | --- |
| `mode` | `classic` | Original game. Omit it, or pass `commercial`, for the dining demo. |
| `skin` | `hearth` or `popup` | Preset palette and default title. |
| `color` | `1A73E8` or `#1a73e8` | Primary color (buttons, plaque, host shirt). |
| `logoText` | `Acme` | Text on the wall plaque. |
| `logo` | `https://example.com/logo.png` | Image beside the plaque text. |
| `title` | `Acme Table` | Start-screen title and browser tab. |
| `dish` | `brand-special` | Serves that catalog dish on key 4 and rings it on the table. |
| `goal` | `6` | Fullness points needed to win (1–40). |
| `seconds` | `30` | Round length (15–180). |
| `lang` | `en` | `zh` (default when nothing is saved), `en`, or `nl`. |
| `webhook` | `https://example.com/lead` | POST lead JSON here. |
| `mailto` | `hello@brand.com` | Open a mail draft if no webhook answers. |

Example:

```
/?skin=popup&color=1A73E8&logoText=Acme&title=Acme%20Table&dish=brand-special&seconds=30&goal=6
```

A lead form is on the start screen (询价) and again when the round ends, win or lose. The sponsor link stays, under the main action. With no webhook, submit writes `[commercial-lead]` to the console and shows a success message. Nothing is stored on a server.

## Round

The default round is 60 seconds and 8 fullness points. Both are query params (`seconds`, `goal`).

- Win: fill the fullness meter before time runs out. The end card title is **满分厨师 / Full-Marks Chef**.
- Partway: **桌长 / Table Host**. A short round: **热心饭搭子 / Table Buddy**.
- Lose: time runs out, or the host’s energy hits zero. Guests leave hungry. No violent copy.
- Keys 1–4, Q, and E are all available. They map to spoon, bowl, soup, signature, salad, and dessert.

## Add a dish

Edit `src/game/commercial/dishes.ts`. Append one object. You do not need a new texture.

```ts
{
  id: 'milktea',
  name: { zh: '奶茶', en: 'Milk Tea' },
  emoji: '🧋',
  color: '#e7c49a',
  accent: '#6b3e26',
  feedPower: 1,
  rarity: 'uncommon',
  shape: 'cup', // bowl | plate | cup | dumpling | box
}
```

`shape` picks the low-poly mesh. `color` and `accent` tint it. `feedPower` is fullness added per guest the dish reaches.

To serve it from a key, set that key in `SKILL_DISH` in the same file:

```ts
export const SKILL_DISH = {
  slap: 'rice-bowl',
  tape: 'dumpling',
  megaphone: 'soup',
  gag: 'milktea', // key 4, also the ?dish= slot
  poop: 'salad',
  civility: 'dessert',
}
```

The internal key names (`slap`, `gag`, …) are the original skill ids. The dining skin only changes what they serve and what the player reads. Dessert (key E) also places the `drink` dish and adds that dish’s feed power.

Highlight a dish without editing code: `?dish=milktea`.

## Change brand colors

Presets live in `src/game/commercial/runtime.ts` as `BRAND_PRESETS`. Each one has `primary`, `accent`, `tablecloth`, `floor`, `wall`, and `wallAccent`.

For a one-off pitch, skip the file and pass `color`, `title`, `logoText`, and `logo` on the URL. `color` replaces `primary` only; tablecloth and walls stay with the selected preset until you edit the preset or switch skins.

Copy for the dining skin is `src/game/commercial/copy.ts`. The original strings stay in `src/game/i18n.ts` and are what `?mode=classic` shows.

## Files

| File | Role |
| --- | --- |
| `src/game/commercial/dishes.ts` | Dish catalog and which action serves which dish |
| `src/game/commercial/runtime.ts` | Skins, query params, on/off switch |
| `src/game/commercial/copy.ts` | Clean Chinese and English |
| `src/game/commercial/session.ts` | Fullness, win/lose, end-card titles |
| `src/game/commercial/lead.ts` | Lead submit (console, webhook, or mailto) |
| `src/scene/DishMesh.tsx` | Low-poly dish |
| `src/ui/LeadForm.tsx` | Form and end card |

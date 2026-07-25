# Design Tokens

Locked values from Realtime Colors. Paste in below — do not improvise substitutes.

## Palette

Two themes. Same five roles, same hues in both — only lightness flips.

### Dark

| Role | Hex | RGB | HSL |
|---|---|---|---|
| Background | `#030f11` | `rgb(3, 15, 17)` | `hsl(189, 70%, 4%)` |
| Text | `#e9f7fb` | `rgb(233, 247, 251)` | `hsl(193, 69%, 95%)` |
| Primary | `#24b6e4` | `rgb(36, 182, 228)` | `hsl(194, 78%, 52%)` |
| Secondary | `#dfe2eb` | `rgb(223, 226, 235)` | `hsl(225, 23%, 90%)` |
| Accent | `#c08cd7` | `rgb(192, 140, 215)` | `hsl(282, 48%, 70%)` |

### Light

| Role | Hex | RGB | HSL |
|---|---|---|---|
| Background | `#eefafc` | `rgb(238, 250, 252)` | `hsl(189, 70%, 96%)` |
| Text | `#041216` | `rgb(4, 18, 22)` | `hsl(193, 69%, 5%)` |
| Primary | `#2eb4dd` | `rgb(46, 180, 221)` | `hsl(194, 72%, 52%)` |
| Secondary | `#89a1ec` | `rgb(137, 161, 236)` | `hsl(225, 72%, 73%)` |
| Accent | `#dbb3ee` | `rgb(219, 179, 238)` | `hsl(281, 63%, 82%)` |

Source (light): <https://www.realtimecolors.com/?colors=041216-eefafc-2eb4dd-89a1ec-dbb3ee&fonts=Inter-Inter>

Note: the dark secondary (`#dfe2eb`) is a near-white neutral, not a blue like the light
one. It reads as a muted surface/text tone in dark, so do not use it as a coloured
accent — that job belongs to Primary and Accent.

## Fonts

| Role | Font |
|---|---|
| Heading | TODO |
| Body | TODO |
| Mono | TODO |

## Severity Ramp

| Severity | Hex |
|---|---|
| Critical | TODO |
| High | TODO |
| Medium | TODO |
| Low | TODO |

## Tailwind Config Snippet

`frontend/tailwind.config.ts` already reads these as `hsl(var(--token))`, so the
tokens go into `frontend/app/globals.css` as **bare HSL channels** — no `hsl(...)`
wrapper, no hex. Dark is the default theme; `.dark` is the class Tailwind switches on.

```css
@layer base {
  :root {
    --background: 189 70% 96%;
    --foreground: 193 69% 5%;
    --primary: 194 72% 52%;
    --primary-foreground: 189 70% 96%;
    --secondary: 225 72% 73%;
    --secondary-foreground: 193 69% 5%;
    --accent: 281 63% 82%;
    --accent-foreground: 193 69% 5%;
  }

  .dark {
    --background: 189 70% 4%;
    --foreground: 193 69% 95%;
    --primary: 194 78% 52%;
    --primary-foreground: 189 70% 4%;
    --secondary: 225 23% 90%;
    --secondary-foreground: 189 70% 4%;
    --accent: 282 48% 70%;
    --accent-foreground: 189 70% 4%;
  }
}
```

The `*-foreground` values are not from Realtime Colors — they are the Text/Background
tokens reused as contrast pairs. Primary, Secondary and Accent are all light enough in
both themes that dark text sits on them.

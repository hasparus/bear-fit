# bear-fit 🧸🏋️‍♂️

<!-- TODO: re-record demo gif (old one removed in the retro-theme PR) -->

Finding a time that works for more than 2 adult humans is **unbearable**. I hope
this helps.

## motivation and alternatives

Doodle was bad, now it's bad and corporate, and my friends didn't like using
[crab.fit] on phones, so I made this instead. Ben is a cool guy tho, so please
use app if you prefer crabs or want to select hours.

[crab.fit]: https://crab.fit/

You probably wanna use [cal.com](https://cal.com) if you need something like
this at work. See https://cal.com/scheduling/feature/collective.

## tech stack

[@sakofchit/system.css 💾](https://github.com/sakofchit/system.css),
[Cloudflare Workers ☁️](https://workers.cloudflare.com/) (Durable Objects) with
[partyserver 🎈](https://github.com/cloudflare/partyserver),
[Yjs 🤝](https://github.com/yjs/yjs),
[Vite ⚡️](https://github.com/vitejs/vite),
[React ⚛️](https://github.com/facebook/react),
[TypeScript 🛂](https://github.com/microsoft/typescript)

bear-fit uses
[genmon's Cursor Party](https://github.com/genmon/interconnected-cursor-party),
so you can argue with your friends about live as you fill the calendar.

## running locally

```sh
pnpm install
pnpm dev
```

The Worker needs a `PUBLIC_KEY_B64` var: running `pnpm test` once seeds
`.dev.vars` automatically, or copy it yourself with
`cp .dev.vars.example .dev.vars`. `pnpm test` runs the Playwright e2e suite.

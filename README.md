# BoredGames

Play games with friends or against bots, in an app you install on your phone (PWA). 16 games are playable; Catan is planned.

**Live:** https://boredgames-il.vercel.app

## Features

- **Sign in** with just a nickname (anonymous auth) or with Google; a nickname account can later be linked to Google so it works on any phone.
- **Unique nicknames**, claimed with a database transaction so two players can't take the same one.
- **Friends:** requests, a friends list, and live online status (presence that clears itself on disconnect).
- **Game invites and lobbies**, with real-time sync of every move between all players.
- **16 games:** Taki, The Imposter, Checkers, Backgammon, Perudo, Cheat, Shithead, Durak, 8½ (Haim Shafir's card game), Blackjack, Chess,
  Rummikub, Texas Hold'em Poker, Codenames, a Cards Against Humanity–style game (original Hebrew and English decks)
  and Hitster.
- **Bots** in most games — from simple heuristics up to alpha-beta search (Chess, Checkers) and Monte Carlo equity estimates (Poker).
- **Around-the-table modes** where the app supports a real-life game: The Imposter, Perudo (dice only),
  Cards Against Humanity (the czar reads aloud) and Hitster (one shared phone or a phone each, playing songs through
  Spotify, Apple Music or YouTube Music).
- **Per-game lobby settings** chosen by the host: rule variants, chess clocks, Rummikub turn timers, poker chips and blind levels, languages.
- **Installable PWA** with a service worker, Hebrew RTL interface and dark mode.

## Stack

| Part | Choice |
|---|---|
| Front end | Vanilla JavaScript (ES modules), HTML, CSS — no framework or build step |
| Real-time backend | Firebase Realtime Database |
| Auth | Firebase Authentication (anonymous + Google) |
| Hosting | Vercel |

## How it's built

- `app.js` — the app shell: auth, nicknames, friends, presence, invites, lobbies and the game screen.
- `games/*.js` — one rules engine per game, written as **pure functions with no UI or database code**: setting up,
  validating a move, applying it to the game state, and choosing a bot move. The shell stores the state in Firebase,
  applies moves inside transactions, and every client re-renders from it, so a new game only needs its own rules module.
  Each engine was checked with thousands of simulated bot-vs-bot games (and, for chess, standard perft move counts).
- `sw.js` + `manifest.json` — make the site installable; the service worker is network-first with a cache fallback for offline use.
- `database.rules.json` — Firebase security rules.

## Running locally

```bash
python3 -m http.server
# then open http://localhost:8000
```

## Roadmap

Catan, stricter per-path database rules so players can only change their own data, and server-side move validation
(hidden information such as poker hands is currently hidden only in the interface).

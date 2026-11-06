# BoredGames

Play games with friends or against bots, in an app you install on your phone (PWA). **Work in progress:** Taki is playable; more games are planned.

**Live:** https://boredgames-il.vercel.app

## Features

- **Sign in** with just a nickname (anonymous auth) or with Google; a nickname account can later be linked to Google so it works on any phone.
- **Unique nicknames**, claimed with a database transaction so two players can't take the same one.
- **Friends:** requests, a friends list, and live online status (presence that clears itself on disconnect).
- **Game invites and lobbies**, with real-time sync of every move between all players.
- **Taki**, the Israeli card game, for 2–8 players, against friends or 1–5 bots.
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
- `games/taki.js` — the Taki rules engine as **pure functions with no UI or database code**: building the deck,
  dealing, validating a move, applying it to the game state, and choosing a bot move. The shell stores the state in
  Firebase and every client re-renders from it, so a new game only needs its own rules module.
- `sw.js` + `manifest.json` — make the site installable; the service worker is network-first with a cache fallback for offline use.
- `database.rules.json` — Firebase security rules.

## Running locally

```bash
python3 -m http.server
# then open http://localhost:8000
```

## Roadmap

More games are listed in the app (checkers, backgammon, chess, Codenames and others), stricter per-path database
rules so players can only change their own data, and server-side move validation.

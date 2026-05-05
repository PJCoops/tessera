# Changelog

A running record of what's shipped to tesserapuzzle.com. Newest at the top.

## 📅 4–5 May 2026

### 📲 Daily reminders, on your phone

You can now install Tessera as a home-screen app and get a push notification when the day's puzzle is ready at 09:00 UTC. Tap the notification, you're in the grid. Works on iOS (Safari), Android, and desktop. Email reminders still work too, both as separate opt-ins under Settings.

To install: open tesserapuzzle.com in your phone's browser, then Add to Home Screen. Open Tessera from the new icon, then flip the Daily reminders toggle in Settings.

### 🎨 A new look

The palette is anchored on two colours now:

- 🟩 **Sage** when a row is right
- 🟧 **Rust** when the whole grid lands

Solved tiles flip rust on completion (was gold). The home-screen icon is a paper-white T on rust, matching the win moment. Share emoji grids carry an orange bonus tile.

### 🔁 Replay past puzzles

Open History and tap any day you've played. Work through it again from a fresh start. Replays don't count toward your streak.

### 📊 Tier chart in History

History now shows a distribution of your solves across the five tiers (Tenacious through Legendary) from your very first visit, so you can see how your record actually shapes up.

### ✂️ Fewer Scrabble words

Pruned the solution wordlist of obscure fillers, plus a blocklist for words that have no place in a daily game. More words you'll actually know.

### ✨ Smaller things

- ™ on the wordmark; "Tessera Puzzle" set as the registered name
- Open Graph previews (Facebook, X, iMessage) now lead with your moves count and tier
- The homepage demo cursor varies the tile pair each loop and holds the swap longer, easier to follow
- Hint outline retuned to 2px ink for iPhone visibility
- Settings layout tightened on mobile, with the description stacked above each control
- Puzzle generator no longer hands you a board with a fully-solved row or column at the start
- Internal: Vitest harness covering the deterministic engine (puzzle, rng, share, tier), so future changes don't silently drift between web and the upcoming mobile build
- Credits: added Stanley Cooper

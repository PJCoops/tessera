// Day 1 of Tessera. Drives the puzzle-number arithmetic shared between
// the client (`TesseraGame.tsx`, `HistoryModal.tsx`) and server
// (daily-reminder cron). Don't change this once the game is live —
// every player's streak/result keys reference puzzle numbers computed
// off this epoch.
export const EPOCH = "2026-04-27";

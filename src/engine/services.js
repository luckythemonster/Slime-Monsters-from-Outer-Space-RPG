// Shared service registry. BootScene fills every slot before starting Title.
// Everything else imports `services` instead of reaching through scene lookups.
export const services = {
  game: null,   // Phaser.Game
  state: null,  // GameState instance
  audio: null,  // AudioEngine instance (may be a no-op shim if audio failed to init)
  ui: null,     // UIScene instance (see docs/ARCHITECTURE.md §12.2)
  input: null,  // Input helper (see docs/ARCHITECTURE.md §12.3)
};

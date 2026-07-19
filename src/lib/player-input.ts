// Shared input state — read by Gallery3D each frame,
// written by keyboard listeners and VirtualJoystick.

export type PlayerInput = {
  forward: number; // -1 (back) .. +1 (forward)
  turn: number;    // -1 (left) .. +1 (right)
};

export const playerInput: PlayerInput = { forward: 0, turn: 0 };

// Keyboard state — arrows + WASD
const keyState = { w: false, s: false, a: false, d: false };

function refreshFromKeys() {
  playerInput.forward = (keyState.w ? 1 : 0) - (keyState.s ? 1 : 0);
  playerInput.turn = (keyState.d ? 1 : 0) - (keyState.a ? 1 : 0);
}

let installed = false;
export function installKeyboardControls() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const map: Record<string, keyof typeof keyState> = {
    KeyW: "w", ArrowUp: "w",
    KeyS: "s", ArrowDown: "s",
    KeyA: "a", ArrowLeft: "a",
    KeyD: "d", ArrowRight: "d",
  };
  window.addEventListener("keydown", (e) => {
    const k = map[e.code];
    if (!k) return;
    keyState[k] = true;
    refreshFromKeys();
    if (["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => {
    const k = map[e.code];
    if (!k) return;
    keyState[k] = false;
    refreshFromKeys();
  });
  window.addEventListener("blur", () => {
    keyState.w = keyState.s = keyState.a = keyState.d = false;
    refreshFromKeys();
  });
}

// Joystick writes here directly.
export function setJoystick(forward: number, turn: number) {
  playerInput.forward = Math.max(-1, Math.min(1, forward));
  playerInput.turn = Math.max(-1, Math.min(1, turn));
}
export function clearJoystick() {
  refreshFromKeys();
}

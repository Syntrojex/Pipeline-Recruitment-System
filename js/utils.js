/* ================================================================
   Small display helpers used by app.js. Kept plain and simple —
   no chained array methods, just straightforward loops.
   ================================================================ */

function fmt(n) {
  if (!Number.isFinite(n)) return "\u2014";
  return n.toFixed(2);
}

function initials(name) {
  const words = name.trim().split(/\s+/);
  let result = "";
  for (let i = 0; i < words.length && i < 2; i++) {
    if (words[i].length > 0) {
      result += words[i][0].toUpperCase();
    }
  }
  return result;
}

// Deterministic gradient per name so the same candidate always
// gets the same avatar color.
const PALETTE = [
  ["#2DD4BF", "#0f766e"],
  ["#60A5FA", "#1d4ed8"],
  ["#F0B429", "#b45309"],
  ["#F472B6", "#a21caf"],
  ["#A78BFA", "#5b21b6"],
  ["#34D399", "#047857"],
  ["#FB923C", "#c2410c"],
];

function avatarGradient(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const pair = PALETTE[hash % PALETTE.length];
  return "linear-gradient(135deg, " + pair[0] + ", " + pair[1] + ")";
}

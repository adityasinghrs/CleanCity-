// Photo fingerprint: the browser computes a 64-bit "difference hash" (dHash) of the photo and sends it as
// 16 hex characters. Similar-looking photos have a small Hamming distance, so we can spot the same garbage
// photographed twice, or a fake "after" photo that is really the "before" photo.
const HASH_RE = /^[0-9a-f]{16}$/;

const cleanHash = (h) => (typeof h === "string" && HASH_RE.test(h.trim().toLowerCase()) ? h.trim().toLowerCase() : undefined);

function hamming(a, b) {
  if (!HASH_RE.test(a || "") || !HASH_RE.test(b || "")) return 64;
  let x = BigInt("0x" + a) ^ BigInt("0x" + b), n = 0;
  while (x) { n += Number(x & 1n); x >>= 1n; }
  return n;
}

const SIMILAR = 10; // <= 10 differing bits out of 64 -> "looks like the same photo"
const NEARLY_IDENTICAL = 5;

module.exports = { cleanHash, hamming, SIMILAR, NEARLY_IDENTICAL };

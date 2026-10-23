// Photo fingerprint (dHash): shrink the photo to 9x8 grey pixels and record, for each row, whether each pixel
// is brighter than its right neighbour -> 64 bits -> 16 hex characters. Similar photos give similar hashes
// even after resizing / compression. Runs fully in the browser, the photo itself is not sent for this.
export async function photoHash(file) {
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    const c = document.createElement("canvas");
    c.width = 9; c.height = 8;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, 9, 8);
    URL.revokeObjectURL(url);
    const d = ctx.getImageData(0, 0, 9, 8).data;
    const grey = (x, y) => { const i = (y * 9 + x) * 4; return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; };
    let bits = "";
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += grey(x, y) > grey(x + 1, y) ? "1" : "0";
    let hex = "";
    for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    return hex;
  } catch {
    return ""; // fingerprint is optional: the report still works without it
  }
}

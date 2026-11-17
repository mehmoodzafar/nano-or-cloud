// Draws a simple receipt as a PNG so image tasks need no asset files.
export async function receiptImage(shop, lines, total) {
  const w = 420, h = 120 + lines.length * 40 + 70;
  const c = new OffscreenCanvas(w, h);
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#111111';
  g.font = 'bold 30px sans-serif';
  g.fillText(shop, 24, 52);
  g.font = '24px monospace';
  let y = 110;
  for (const [item, price] of lines) {
    g.fillText(item, 24, y);
    g.fillText(price, w - 24 - g.measureText(price).width, y);
    y += 40;
  }
  g.fillRect(24, y - 16, w - 48, 2);
  g.font = 'bold 26px monospace';
  g.fillText('TOTAL', 24, y + 26);
  g.fillText(total, w - 24 - g.measureText(total).width, y + 26);
  const blob = await c.convertToBlob({ type: 'image/png' });
  return new File([blob], `${shop.toLowerCase().replace(/\s+/g, '-')}.png`, { type: 'image/png' });
}

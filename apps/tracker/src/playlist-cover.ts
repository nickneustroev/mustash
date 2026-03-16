import sharp from "sharp";

export async function generateRecentPlaylistCoverJpeg(windowSize: number): Promise<Buffer> {
  const width = 640;
  const height = 640;
  const textTop = `${windowSize}`;
  const textBottom = "recent";

  const svg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#000000" />
  <text
    x="50%"
    y="46%"
    text-anchor="middle"
    fill="#ffffff"
    font-family="Helvetica, Arial, sans-serif"
    font-size="300"
    font-weight="700"
    dominant-baseline="middle"
  >${escapeXml(textTop)}</text>
  <text
    x="50%"
    y="75%"
    text-anchor="middle"
    fill="#ffffff"
    font-family="Helvetica, Arial, sans-serif"
    font-size="130"
    font-weight="500"
    dominant-baseline="middle"
  >${escapeXml(textBottom)}</text>
</svg>`;

  return sharp(Buffer.from(svg))
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

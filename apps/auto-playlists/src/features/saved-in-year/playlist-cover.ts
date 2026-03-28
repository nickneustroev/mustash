import sharp from "sharp";

export async function generateSavedInYearPlaylistCoverJpeg(year: number, backgroundColor: string): Promise<Buffer> {
  const width = 640;
  const height = 640;
  const textTop = `${year}`;
  const textBottom = "year";
  const textColor = pickTextColor(backgroundColor);

  const svg = `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${escapeXml(backgroundColor)}" />
  <text
    x="50%"
    y="46%"
    text-anchor="middle"
    fill="${textColor}"
    font-family="Helvetica, Arial, sans-serif"
    font-size="210"
    font-weight="700"
    dominant-baseline="middle"
  >${escapeXml(textTop)}</text>
  <text
    x="50%"
    y="75%"
    text-anchor="middle"
    fill="${textColor}"
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

function pickTextColor(backgroundColor: string): string {
  const hex = backgroundColor.slice(1);
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance >= 160 ? "#000000" : "#FFFFFF";
}

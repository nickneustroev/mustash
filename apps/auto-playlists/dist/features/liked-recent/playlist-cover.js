import sharp from "sharp";
export async function generateRecentPlaylistCoverJpeg(windowSize) {
    const size = 640;
    const background = {
        create: {
            width: size,
            height: size,
            channels: 4,
            background: { r: 13, g: 21, b: 36, alpha: 1 },
        },
    };
    const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#bg)" rx="48" />
      <circle cx="320" cy="220" r="150" fill="rgba(255,255,255,0.08)" />
      <text x="320" y="270" text-anchor="middle" font-family="Arial, sans-serif" font-size="168" font-weight="700" fill="#f8fafc">${windowSize}</text>
      <text x="320" y="360" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="600" fill="#bfdbfe">recent</text>
    </svg>
  `;
    return sharp(background)
        .composite([{ input: Buffer.from(svg), blend: "over" }])
        .jpeg({ quality: 90 })
        .toBuffer();
}
//# sourceMappingURL=playlist-cover.js.map
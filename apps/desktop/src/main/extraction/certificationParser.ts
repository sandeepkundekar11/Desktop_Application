export const parseCertificates = (text: string | null): string[] => {
  if (!text) return [];

  const rawLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const certs: string[] = [];

  for (const line of rawLines) {
    const cleanLine = line.replace(/^[•*\-–—\d.]+\s*/, '').trim();
    if (!cleanLine) continue;

    // Remove metadata like credential ID or dates from title
    let certName = cleanLine
      .replace(/\b(?:issued|credential\s+id|verify)[:\s]+[^\s,]+/gi, '')
      .replace(/\b(20\d\d|19\d\d)\b/g, '')
      .replace(/[,|–-]\s*$/, '')
      .trim();

    if (certName.length > 2 && !certs.includes(certName)) {
      certs.push(certName);
    }
  }

  return certs;
};

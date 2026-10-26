import { ExtractionResult } from './types.js';

/**
 * Normalizes extracted resume text to clean, readable plain text.
 * Preserves paragraphs, bullet points, and headings while removing
 * non-printable control characters and normalizing inconsistent line breaks.
 */
export const normalizeResumeText = (rawText: string): ExtractionResult => {
  if (!rawText) {
    return { text: '', characterCount: 0, wordCount: 0 };
  }

  const normalized = rawText
    // 1. Standardize line breaks to Unix LF
    .replace(/\r\n|\r/g, '\n')
    // 2. Replace non-breaking spaces with standard space
    .replace(/[\u00A0\u1680\u180e\u2000-\u200b\u202f\u205f\u3000\ufeff]/g, ' ')
    // 3. Remove non-printable control characters, preserving \n and \t
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // 4. Clean trailing whitespace per line and strip page artifacts
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      // Remove page footer artifacts like '-- 1 of 2 --', 'Page 1 of 2', '1 / 2'
      if (/^[-–—\s]*(?:page\s+)?\d+(?:\s*(?:of|\/)\s*\d+)?[-–—\s]*$/i.test(trimmed)) {
        return false;
      }
      return true;
    })
    .map((line) => line.trimEnd())
    .join('\n')
    // 5. Standardize bullet symbols to uniform '• '
    .replace(/^[\s]*[\u2022\u25cf\u25cb\u25aa\u25ab*]\s+/gm, '• ')
    // 6. Collapse 3+ consecutive line breaks to 2 (paragraph spacing)
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const characterCount = normalized.length;
  const wordCount = normalized ? normalized.split(/\s+/).filter(Boolean).length : 0;

  return {
    text: normalized,
    characterCount,
    wordCount,
  };
};

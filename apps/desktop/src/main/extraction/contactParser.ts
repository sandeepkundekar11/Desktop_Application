export interface ParsedName {
  readonly firstName: string;
  readonly middleName: string;
  readonly lastName: string;
}

export interface ParsedPhone {
  readonly countryCode: string;
  readonly phoneNumber: string;
}

export interface ParsedLocation {
  readonly city: string;
  readonly state: string;
  readonly country: string;
  readonly streetAddress: string;
  readonly zipCode: string;
}

export interface ExtractedContact {
  readonly name: ParsedName;
  readonly email: string;
  readonly phone: ParsedPhone;
  readonly location: ParsedLocation;
  readonly linkedinUrl: string;
  readonly githubUrl: string;
  readonly portfolioUrl: string;
  readonly languages: string[];
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_REGEX = /(?:\+(\d{1,3})[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})|\+(\d{1,3})[-.\s]?(\d{10,12})/;
const LINKEDIN_REGEX = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i;
const GITHUB_REGEX = /(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)/i;
const PORTFOLIO_REGEX = /(?:https?:\/\/)(?!.*(?:linkedin|github|google|facebook|twitter|instagram)\.com)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/i;

const NON_NAME_KEYWORDS = [
  'resume', 'curriculum', 'vitae', 'cv', 'page', 'profile', 'summary',
  'experience', 'education', 'skills', 'contact', 'phone', 'email', 'address',
];

const KNOWN_LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Mandarin', 'Chinese', 'Hindi',
  'Arabic', 'Portuguese', 'Bengali', 'Russian', 'Japanese', 'Punjabi', 'Telugu',
  'Marathi', 'Tamil', 'Urdu', 'Gujarati', 'Kannada', 'Malayalam', 'Italian',
];

export const parseName = (fullName: string | null): ParsedName => {
  if (!fullName) return { firstName: '', middleName: '', lastName: '' };
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', middleName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0] || '', middleName: '', lastName: '' };
  if (parts.length === 2) return { firstName: parts[0] || '', middleName: '', lastName: parts[1] || '' };
  if (parts.length === 3) return { firstName: parts[0] || '', middleName: parts[1] || '', lastName: parts[2] || '' };
  return {
    firstName: parts[0] || '',
    middleName: parts.slice(1, -1).join(' '),
    lastName: parts[parts.length - 1] || '',
  };
};

export const parsePhone = (rawText: string): ParsedPhone => {
  const match = rawText.match(PHONE_REGEX);
  if (!match) return { countryCode: '', phoneNumber: '' };

  const fullMatch = match[0].trim();
  if (fullMatch.startsWith('+')) {
    const spaceIndex = fullMatch.indexOf(' ');
    if (spaceIndex > 0) {
      return {
        countryCode: fullMatch.slice(0, spaceIndex),
        phoneNumber: fullMatch.slice(spaceIndex + 1).trim(),
      };
    }
    const ccMatch = fullMatch.match(/^\+(\d{1,3})(.*)$/);
    if (ccMatch && ccMatch[1] && ccMatch[2]) {
      return {
        countryCode: `+${ccMatch[1]}`,
        phoneNumber: ccMatch[2].trim(),
      };
    }
  }

  return { countryCode: '', phoneNumber: fullMatch };
};

export const parseLocation = (rawText: string): ParsedLocation => {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const locationPattern = /\b([A-Z][a-zA-Z\s.-]+),\s*([A-Z]{2}|[A-Z][a-zA-Z\s]+)(?:,\s*([A-Z][a-zA-Z\s]+))?\b/;

  for (let i = 0; i < Math.min(lines.length, 12); i++) {
    const line = lines[i];
    if (!line) continue;
    const lower = line.toLowerCase();
    if (lower.includes('engineer') || lower.includes('developer') || lower.includes('experience')) {
      continue;
    }
    const match = line.match(locationPattern);
    if (match) {
      const city = match[1]?.trim() || '';
      const stateOrCountry = match[2]?.trim() || '';
      const country = match[3]?.trim() || '';

      const zipMatch = line.match(/\b\d{5,6}(?:-\d{4})?\b/);
      const zipCode = zipMatch ? zipMatch[0] : '';

      if (country) {
        return { city, state: stateOrCountry, country, streetAddress: '', zipCode };
      }
      return { city, state: stateOrCountry, country: '', streetAddress: '', zipCode };
    }
  }

  return { city: '', state: '', country: '', streetAddress: '', zipCode: '' };
};

export const extractEmail = (text: string): string => {
  const match = text.match(EMAIL_REGEX);
  return match ? match[0].toLowerCase() : '';
};

export const extractLinkedIn = (text: string): string => {
  const match = text.match(LINKEDIN_REGEX);
  if (!match) return '';
  const username = match[1];
  return username ? `https://linkedin.com/in/${username}` : match[0];
};

export const extractGitHub = (text: string): string => {
  const match = text.match(GITHUB_REGEX);
  if (!match) return '';
  const username = match[1];
  return username ? `https://github.com/${username}` : match[0];
};

export const extractPortfolio = (text: string): string => {
  const match = text.match(PORTFOLIO_REGEX);
  return match ? match[0].trim() : '';
};

export const extractFullName = (text: string): string => {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i];
    if (!line || EMAIL_REGEX.test(line) || PHONE_REGEX.test(line) || line.includes('http')) {
      continue;
    }
    const words = line.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length <= 4) {
      const isNameLike = words.every((w) => /^[A-Z][a-zA-Z.'-]*$/.test(w) || /^[A-Z]+$/.test(w));
      const hasKeywords = words.some((w) => NON_NAME_KEYWORDS.includes(w.toLowerCase()));
      if (isNameLike && !hasKeywords) {
        return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }
    }
  }
  return '';
};

export const extractLanguages = (text: string): string[] => {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const lang of KNOWN_LANGUAGES) {
    const regex = new RegExp(`\\b${lang.toLowerCase()}\\b`, 'i');
    if (regex.test(lower) && !found.includes(lang)) {
      found.push(lang);
    }
  }
  return found;
};

export const extractContactInfo = (rawText: string): ExtractedContact => {
  const rawFullName = extractFullName(rawText);
  return {
    name: parseName(rawFullName),
    email: extractEmail(rawText),
    phone: parsePhone(rawText),
    location: parseLocation(rawText),
    linkedinUrl: extractLinkedIn(rawText),
    githubUrl: extractGitHub(rawText),
    portfolioUrl: extractPortfolio(rawText),
    languages: extractLanguages(rawText),
  };
};

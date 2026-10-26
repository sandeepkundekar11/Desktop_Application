import { ProjectRecord } from '../storage/minimalProfileSchema.js';

const URL_REGEX = /(?:https?:\/\/[^\s]+|github\.com\/[a-zA-Z0-9_\-\/]+)/i;
const TECH_HEADER_REGEX = /(?:technologies|tech\s+stack|tools|built\s+with)[:\s]+(.+)/i;

export const parseProjects = (text: string | null): ProjectRecord[] => {
  if (!text) return [];

  const rawLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const projects: Array<{
    name: string;
    description: string[];
    url: string;
  }> = [];

  let currentProject: (typeof projects)[0] | null = null;

  for (const line of rawLines) {
    const isBullet = /^[•*\-–—]\s*/.test(line) || /^\d+\.\s+/.test(line);

    // Check for tech stack line
    const techMatch = line.match(TECH_HEADER_REGEX);
    if (techMatch && techMatch[1] && currentProject) {
      currentProject.description.push(`Technologies: ${techMatch[1].trim()}`);
      continue;
    }

    if (isBullet && currentProject) {
      const cleanBullet = line.replace(/^[•*\-–—\d.]+\s*/, '').trim();
      if (cleanBullet) {
        currentProject.description.push(cleanBullet);
      }
      continue;
    }

    // Check for project title or standalone URL line
    const urlMatch = line.match(URL_REGEX);
    const url = urlMatch ? (urlMatch[0].startsWith('http') ? urlMatch[0] : `https://${urlMatch[0]}`) : '';
    const cleanLine = line.replace(URL_REGEX, '').trim().replace(/[,|–-]$/, '').trim();

    if (url && cleanLine.length === 0 && currentProject) {
      currentProject.url = url;
      continue;
    }

    // Check if line looks like "Project Name | React, Node.js"
    const segments = cleanLine.split(/\s*(?:\||–|-|—)\s*/).map((s) => s.trim()).filter(Boolean);
    const projectName = segments[0] || 'Project';

    currentProject = {
      name: projectName,
      description: segments.length > 1 ? [`Technologies: ${segments.slice(1).join(', ')}`] : [],
      url,
    };
    projects.push(currentProject);
  }

  return projects.map((p) => ({
    name: p.name,
    description: p.description.join('. '),
    url: p.url || '',
  }));
};

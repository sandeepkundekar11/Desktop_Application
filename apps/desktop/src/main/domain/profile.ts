export interface CandidateProfile {
  readonly id: string;
  readonly fullName: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly location: string | null;
  readonly countryCode: string | null;
  readonly linkedinUrl: string | null;
  readonly portfolioUrl: string | null;
  readonly githubUrl: string | null;
  readonly professionalSummary: string | null;
  readonly currentTitle: string | null;
  readonly totalExperienceMonths: number | null;
  readonly profileDataJson: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CandidateSkill {
  readonly id: string;
  readonly profileId: string;
  readonly name: string;
  readonly normalizedName: string;
  readonly category: string | null;
  readonly proficiencyLevel: string | null;
  readonly yearsUsed: number | null;
  readonly sourceType: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WorkExperience {
  readonly id: string;
  readonly profileId: string;
  readonly companyName: string;
  readonly jobTitle: string;
  readonly employmentType: string | null;
  readonly location: string | null;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly isCurrent: boolean;
  readonly description: string | null;
  readonly achievementsJson: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EducationRecord {
  readonly id: string;
  readonly profileId: string;
  readonly institution: string;
  readonly degree: string | null;
  readonly fieldOfStudy: string | null;
  readonly location: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly grade: string | null;
  readonly description: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Project {
  readonly id: string;
  readonly profileId: string;
  readonly name: string;
  readonly description: string | null;
  readonly projectUrl: string | null;
  readonly repositoryUrl: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly technologiesJson: string;
  readonly achievementsJson: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Certification {
  readonly id: string;
  readonly profileId: string;
  readonly name: string;
  readonly issuer: string | null;
  readonly credentialId: string | null;
  readonly credentialUrl: string | null;
  readonly issueDate: string | null;
  readonly expiryDate: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectSkill {
  readonly projectId: string;
  readonly skillId: string;
  readonly createdAt: string;
}

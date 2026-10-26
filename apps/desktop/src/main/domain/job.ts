export interface JobSource {
  readonly id: string;
  readonly name: string;
  readonly sourceType: string;
  readonly baseUrl: string | null;
  readonly isEnabled: boolean;
  readonly configurationJson: string;
  readonly lastSyncAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface JobPreference {
  readonly id: string;
  readonly profileId: string;
  readonly name: string;
  readonly minimumExperienceMonths: number | null;
  readonly maximumExperienceMonths: number | null;
  readonly minimumSalaryMinor: number | null;
  readonly maximumSalaryMinor: number | null;
  readonly salaryCurrency: string | null;
  readonly workMode: string | null;
  readonly employmentType: string | null;
  readonly matchThreshold: number;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface JobPreferenceTitle {
  readonly id: string;
  readonly preferenceId: string;
  readonly title: string;
  readonly normalizedTitle: string;
  readonly createdAt: string;
}

export interface JobPreferenceLocation {
  readonly id: string;
  readonly preferenceId: string;
  readonly location: string;
  readonly normalizedLocation: string;
  readonly createdAt: string;
}

export interface Job {
  readonly id: string;
  readonly sourceId: string;
  readonly externalJobId: string | null;
  readonly title: string;
  readonly normalizedTitle: string;
  readonly companyName: string | null;
  readonly location: string | null;
  readonly workMode: string | null;
  readonly employmentType: string | null;
  readonly jobUrl: string;
  readonly description: string | null;
  readonly descriptionHash: string | null;
  readonly minimumSalaryMinor: number | null;
  readonly maximumSalaryMinor: number | null;
  readonly salaryCurrency: string | null;
  readonly experienceMinMonths: number | null;
  readonly experienceMaxMonths: number | null;
  readonly postedAt: string | null;
  readonly discoveredAt: string;
  readonly lastSeenAt: string | null;
  readonly jobStatus: string;
  readonly sourceMetadataJson: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface JobRequirement {
  readonly id: string;
  readonly jobId: string;
  readonly requirementType: string;
  readonly requirementText: string;
  readonly isMandatory: boolean;
  readonly sourceType: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface JobRequiredSkill {
  readonly jobId: string;
  readonly skillId: string;
  readonly importance: number;
  readonly createdAt: string;
}

export interface JobMatchResult {
  readonly id: string;
  readonly jobId: string;
  readonly preferenceId: string;
  readonly candidateProfileId: string;
  readonly score: number;
  readonly matchedSkillsJson: string;
  readonly missingSkillsJson: string;
  readonly reasonsJson: string;
  readonly scoringVersion: string;
  readonly isQualified: boolean;
  readonly matchedAt: string;
  readonly createdAt: string;
}

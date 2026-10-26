import { ConnectorId } from '../../types';

export interface ConnectorSourceMetadata {
  readonly id: ConnectorId;
  readonly displayName: string;
  readonly badge: string;
  readonly homeUrl: string;
  readonly category: string;
  readonly coverage: string;
  readonly roadmapStatus: string;
}

export const CONNECTOR_METADATA_REGISTRY: Record<ConnectorId, ConnectorSourceMetadata> = {
  hiringcafe: {
    id: 'hiringcafe',
    displayName: 'HiringCafe',
    badge: 'Direct Employer Feed',
    homeUrl: 'https://hiring.cafe',
    category: 'Aggregator / Career Pages',
    coverage: 'US & Global Remote Tech',
    roadmapStatus: 'Planned • Search Client in Chunk 2',
  },
  naukri: {
    id: 'naukri',
    displayName: 'Naukri',
    badge: 'Enterprise & IT Portal',
    homeUrl: 'https://www.naukri.com',
    category: 'Regional Job Board',
    coverage: 'India & APAC Tech & Enterprise',
    roadmapStatus: 'Planned • Portal Search Client',
  },
  indeed: {
    id: 'indeed',
    displayName: 'Indeed',
    badge: 'Global Job Index',
    homeUrl: 'https://www.indeed.com',
    category: 'Global Marketplace',
    coverage: 'Worldwide Multi-Industry',
    roadmapStatus: 'Planned • Feed Indexing Client',
  },
  linkedin: {
    id: 'linkedin',
    displayName: 'LinkedIn',
    badge: 'Professional Network',
    homeUrl: 'https://www.linkedin.com/jobs',
    category: 'Professional Network',
    coverage: 'Global Enterprise & Tech',
    roadmapStatus: 'Requires Setup • Authenticated Session Client',
  },
  wellfound: {
    id: 'wellfound',
    displayName: 'Wellfound',
    badge: 'Startup Ecosystem',
    homeUrl: 'https://wellfound.com/jobs',
    category: 'Venture & Startup Board',
    coverage: 'Global Startup & Remote Tech',
    roadmapStatus: 'Requires Setup • Startup Board Client',
  },
  instahyre: {
    id: 'instahyre',
    displayName: 'Instahyre',
    badge: 'AI Matching Portal',
    homeUrl: 'https://www.instahyre.com',
    category: 'Curated Tech Matching',
    coverage: 'India Tech & High-Growth Startups',
    roadmapStatus: 'Requires Setup • Candidate Portal Client',
  },
  hirist: {
    id: 'hirist',
    displayName: 'Hirist',
    badge: 'Specialized Tech Hub',
    homeUrl: 'https://www.hirist.tech',
    category: 'Tech & Engineering Portal',
    coverage: 'India & Remote Engineering',
    roadmapStatus: 'Planned • Tech Job Feed Client',
  },
};

export const getConnectorMetadata = (id: ConnectorId): ConnectorSourceMetadata => {
  return (
    CONNECTOR_METADATA_REGISTRY[id] || {
      id,
      displayName: id,
      badge: 'Job Board',
      homeUrl: '#',
      category: 'General',
      coverage: 'Global',
      roadmapStatus: 'Pending',
    }
  );
};

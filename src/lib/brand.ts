export type WorkspaceView =
  | 'command-center'
  | 'fleet'
  | 'people'
  | 'rule-studio'
  | 'workspace';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface BrandNavigationItem {
  key: WorkspaceView;
  label: string;
  shortLabel: string;
  description: string;
  icon:
    | 'LayoutDashboard'
    | 'Smartphone'
    | 'Users'
    | 'ShieldCheck'
    | 'Settings2';
  permission: string | string[];
  enabled: boolean;
}

export interface BrandConfig {
  identity: {
    appName: string;
    shortName: string;
    tagline: string;
    domainLabel: string;
    supportEmail: string;
    supportUrl: string;
    logoUrl?: string;
    faviconUrl?: string;
    logoMark: string;
  };
  palette: {
    primary: string;
    secondary: string;
    accent: string;
  };
  navigation: BrandNavigationItem[];
}

export const BRAND_STORAGE_KEY = 'orbitops.branding';
export const THEME_STORAGE_KEY = 'orbitops.theme-mode';

export const DEFAULT_BRAND_CONFIG: BrandConfig = {
  identity: {
    appName: 'OrbitOps',
    shortName: 'Orbit',
    tagline: 'Mobile operations control for teams that need clarity, speed, and trust.',
    domainLabel: 'control.yourfleet.io',
    supportEmail: 'support@orbitops.app',
    supportUrl: 'https://support.orbitops.app',
    logoMark: 'OO',
  },
  palette: {
    primary: '#0f766e',
    secondary: '#155eef',
    accent: '#ff7a59',
  },
  navigation: [
    {
      key: 'command-center',
      label: 'Command Center',
      shortLabel: 'Home',
      description: 'Live fleet pulse, search spotlight, and rollout health.',
      icon: 'LayoutDashboard',
      permission: 'user:analytics',
      enabled: true,
    },
    {
      key: 'fleet',
      label: 'Fleet',
      shortLabel: 'Fleet',
      description: 'Enrollment, device cards, live status, and detail actions.',
      icon: 'Smartphone',
      permission: 'devices:read',
      enabled: true,
    },
    {
      key: 'people',
      label: 'People',
      shortLabel: 'People',
      description: 'Invites, access resets, and collaborator lifecycle management.',
      icon: 'Users',
      permission: 'user:read',
      enabled: true,
    },
    {
      key: 'rule-studio',
      label: 'Rule Studio',
      shortLabel: 'Rules',
      description: 'Blueprints, access rings, and protection defaults.',
      icon: 'ShieldCheck',
      permission: ['configuration:read', 'security-group:read'],
      enabled: true,
    },
    {
      key: 'workspace',
      label: 'Workspace',
      shortLabel: 'Setup',
      description: 'White-label branding, theme controls, and product language.',
      icon: 'Settings2',
      permission: 'configuration:read',
      enabled: true,
    },
  ],
};

export const WORKSPACE_VIEW_META: Record<
  WorkspaceView,
  {
    eyebrow: string;
    title: string;
    description: string;
    searchPlaceholder: string;
  }
> = {
  'command-center': {
    eyebrow: 'Live overview',
    title: 'Command Center',
    description: 'A mobile-first pulse view for fleet health, recent change, and next actions.',
    searchPlaceholder: 'Search devices, people, or alerts',
  },
  fleet: {
    eyebrow: 'Device operations',
    title: 'Fleet',
    description: 'Replace spreadsheets and tables with touch-friendly cards, filters, and detail panels.',
    searchPlaceholder: 'Search by device, owner, model, or UUID',
  },
  people: {
    eyebrow: 'Team operations',
    title: 'People',
    description: 'Invite, update, pause, and recover access for every operator in one place.',
    searchPlaceholder: 'Search people by name, email, or phone',
  },
  'rule-studio': {
    eyebrow: 'Policy design',
    title: 'Rule Studio',
    description: 'Shape the default blueprint for devices and the access rings for people.',
    searchPlaceholder: 'Search settings, access rings, or capabilities',
  },
  workspace: {
    eyebrow: 'White-label',
    title: 'Workspace',
    description: 'Control branding, color tokens, menu labels, and the product voice.',
    searchPlaceholder: 'Search theme controls or language map',
  },
};

export const LEGACY_TAB_TO_VIEW: Record<string, WorkspaceView> = {
  overview: 'command-center',
  devices: 'fleet',
  team: 'people',
  profiles: 'rule-studio',
  'access-control': 'rule-studio',
  plans: 'workspace',
  'app-deploy': 'workspace',
  'app-store': 'workspace',
  'file-transfer': 'workspace',
};

export const TERMINOLOGY_MAP = [
  { oldLabel: 'Overview', newLabel: 'Command Center' },
  { oldLabel: 'Device Hub', newLabel: 'Fleet' },
  { oldLabel: 'Team', newLabel: 'People' },
  { oldLabel: 'Device Profiles', newLabel: 'Rule Studio' },
  { oldLabel: 'Security Groups', newLabel: 'Access Rings' },
  { oldLabel: 'Policies', newLabel: 'Blueprint Rules' },
  { oldLabel: 'Plans', newLabel: 'Capacity' },
  { oldLabel: 'App Deploy', newLabel: 'Rollouts' },
  { oldLabel: 'App Store', newLabel: 'App Library' },
  { oldLabel: 'File Transfer', newLabel: 'Vault' },
  { oldLabel: 'Settings', newLabel: 'Workspace' },
];

export function mergeBrandConfig(
  base: BrandConfig = DEFAULT_BRAND_CONFIG,
  patch?: Partial<BrandConfig>
): BrandConfig {
  if (!patch) {
    return {
      ...base,
      identity: { ...base.identity },
      palette: { ...base.palette },
      navigation: base.navigation.map((item) => ({ ...item })),
    };
  }

  const baseNavigation = new Map(base.navigation.map((item) => [item.key, item]));
  const nextNavigation = (patch.navigation ?? base.navigation).map((item) => ({
    ...(baseNavigation.get(item.key) ?? item),
    ...item,
  }));

  return {
    ...base,
    ...patch,
    identity: {
      ...base.identity,
      ...patch.identity,
    },
    palette: {
      ...base.palette,
      ...patch.palette,
    },
    navigation: nextNavigation,
  };
}

export function isViewEnabled(navigation: BrandNavigationItem[], view: WorkspaceView) {
  return navigation.some((item) => item.key === view && item.enabled);
}

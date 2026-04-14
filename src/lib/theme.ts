/**
 * Nexus MDM — White-Label Theme Configuration
 *
 * All brand-specific values live here. Override via environment variables
 * or a runtime config API to enable full white-labeling.
 */

export interface NexusTheme {
  brand: {
    /** Short product name displayed in nav, tab titles */
    name: string;
    /** Full product name used on marketing/login screens */
    fullName: string;
    /** One-line tagline shown on the login screen */
    tagline: string;
    /** Path to logo image (sidebar, login) */
    logo: string;
    /** Alt text for logo */
    logoAlt: string;
    /** Favicon path */
    favicon?: string;
  };
  colors: {
    /** Primary brand color (CSS hex) */
    primary: string;
    /** Slightly darker shade of primary for hover/active states */
    primaryDark: string;
    /** Secondary / violet accent */
    secondary: string;
    /** Cyan accent used for charts and info states */
    accent: string;
  };
  /** Sidebar navigation items (order matters). Toggle items via permission checks. */
  navigation: NavItem[];
  /** Contact / support link shown in sidebar footer */
  supportUrl?: string;
}

export interface NavItem {
  key: TabKey;
  label: string;
  /** lucide-react icon name (resolved at render time) */
  icon: string;
  /** Permission string required to see this item */
  permission: string | string[];
}

export type TabKey =
  | 'overview'
  | 'devices'
  | 'team'
  | 'plans'
  | 'profiles'
  | 'access-control'
  | 'app-deploy'
  | 'app-store'
  | 'file-transfer';

/** Default Nexus MDM theme — override this at runtime for white-labeling */
export const nexusTheme: NexusTheme = {
  brand: {
    name: 'Nexus',
    fullName: 'Nexus MDM',
    tagline: 'Enterprise Device Management, Reimagined',
    logo: '/tw_logo.png',
    logoAlt: 'Nexus MDM',
  },
  colors: {
    primary: '#6366f1',
    primaryDark: '#4f46e5',
    secondary: '#8b5cf6',
    accent: '#06b6d4',
  },
  navigation: [
    {
      key: 'overview',
      label: 'Overview',
      icon: 'LayoutDashboard',
      permission: 'user:analytics',
    },
    {
      key: 'devices',
      label: 'Device Hub',
      icon: 'Smartphone',
      permission: 'devices:read',
    },
    {
      key: 'team',
      label: 'Team',
      icon: 'Users',
      permission: 'user:read',
    },
    {
      key: 'plans',
      label: 'Plans',
      icon: 'CreditCard',
      permission: 'subscriptions:read',
    },
    {
      key: 'profiles',
      label: 'Device Profiles',
      icon: 'SlidersHorizontal',
      permission: 'configuration:read',
    },
    {
      key: 'access-control',
      label: 'Access Control',
      icon: 'ShieldCheck',
      permission: 'security-group:read',
    },
    {
      key: 'app-deploy',
      label: 'App Deploy',
      icon: 'Upload',
      permission: 'app-updates:upload',
    },
    {
      key: 'app-store',
      label: 'App Store',
      icon: 'Store',
      permission: ['app-management:read', 'app-management:upload', 'app-management:deploy'],
    },
    {
      key: 'file-transfer',
      label: 'File Transfer',
      icon: 'FolderSync',
      permission: ['file-manager:read', 'file-manager:command'],
    },
  ],
  supportUrl: 'https://support.nexusmdm.io',
};

/** Bottom navigation tabs shown on mobile (max 5 items; "More" is always last) */
export const BOTTOM_NAV_TABS: TabKey[] = ['overview', 'devices', 'team', 'access-control'];

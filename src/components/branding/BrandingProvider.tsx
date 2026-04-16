import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  BRAND_STORAGE_KEY,
  DEFAULT_BRAND_CONFIG,
  THEME_STORAGE_KEY,
  mergeBrandConfig,
  type BrandConfig,
  type ThemeMode,
  type WorkspaceView,
} from '@/lib/brand';

interface BrandingContextValue {
  branding: BrandConfig;
  themeMode: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  updateBranding: (patch: Partial<BrandConfig>) => void;
  updateNavigationItem: (
    key: WorkspaceView,
    patch: Partial<BrandConfig['navigation'][number]>
  ) => void;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  resetBranding: () => void;
}

const BrandingContext = createContext<BrandingContextValue | null>(null);

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeHex(input: string) {
  const value = input.trim();
  if (!value) return '#0f766e';
  const hex = value.startsWith('#') ? value : `#${value}`;
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex.length === 7 ? hex : '#0f766e';
}

function hexToRgb(hex: string) {
  const value = normalizeHex(hex).replace('#', '');
  const number = Number.parseInt(value, 16);
  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255,
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

function mixHex(colorA: string, colorB: string, ratio: number) {
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  return rgbToHex(
    a.r * (1 - ratio) + b.r * ratio,
    a.g * (1 - ratio) + b.g * ratio,
    a.b * (1 - ratio) + b.b * ratio
  );
}

function hexToHslChannels(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  let hue = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta !== 0) {
    saturation =
      lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    switch (max) {
      case nr:
        hue = (ng - nb) / delta + (ng < nb ? 6 : 0);
        break;
      case ng:
        hue = (nb - nr) / delta + 2;
        break;
      default:
        hue = (nr - ng) / delta + 4;
        break;
    }

    hue /= 6;
  }

  return `${Math.round(hue * 360)} ${Math.round(saturation * 100)}% ${Math.round(
    lightness * 100
  )}%`;
}

function getStoredBranding() {
  try {
    const value = window.localStorage.getItem(BRAND_STORAGE_KEY);
    if (!value) return DEFAULT_BRAND_CONFIG;
    return mergeBrandConfig(DEFAULT_BRAND_CONFIG, JSON.parse(value));
  } catch {
    return DEFAULT_BRAND_CONFIG;
  }
}

function getStoredThemeMode(): ThemeMode {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    if (value === 'light' || value === 'dark' || value === 'system') return value;
  } catch {
    return 'system';
  }
  return 'system';
}

function resolveTheme(mode: ThemeMode) {
  if (mode === 'light' || mode === 'dark') return mode;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyBranding(branding: BrandConfig, themeMode: ThemeMode) {
  const root = document.documentElement;
  const resolvedTheme = resolveTheme(themeMode);

  const primary = normalizeHex(branding.palette.primary);
  const secondary = normalizeHex(branding.palette.secondary);
  const accent = normalizeHex(branding.palette.accent);

  root.classList.toggle('dark', resolvedTheme === 'dark');
  root.style.setProperty('--primary', hexToHslChannels(primary));
  root.style.setProperty('--secondary-brand', hexToHslChannels(secondary));
  root.style.setProperty('--accent-brand', hexToHslChannels(accent));
  root.style.setProperty('--ring', hexToHslChannels(primary));
  root.style.setProperty('--primary-solid', primary);
  root.style.setProperty('--secondary-solid', secondary);
  root.style.setProperty('--accent-solid', accent);
  root.style.setProperty('--primary-soft', mixHex(primary, '#ffffff', 0.84));
  root.style.setProperty('--secondary-soft', mixHex(secondary, '#ffffff', 0.88));
  root.style.setProperty('--accent-soft', mixHex(accent, '#ffffff', 0.86));
  root.style.setProperty('--ambient-primary', mixHex(primary, '#0b1220', 0.28));
  root.style.setProperty('--ambient-secondary', mixHex(secondary, '#0b1220', 0.2));
  root.style.setProperty('--ambient-accent', mixHex(accent, '#0b1220', 0.28));

  document.title = `${branding.identity.appName} | Mobile operations control`;

  if (branding.identity.faviconUrl) {
    let favicon = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.appendChild(favicon);
    }
    favicon.href = branding.identity.faviconUrl;
  }

  return resolvedTheme;
}

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandConfig>(() => getStoredBranding());
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => getStoredThemeMode());
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    resolveTheme(getStoredThemeMode())
  );

  useEffect(() => {
    window.localStorage.setItem(BRAND_STORAGE_KEY, JSON.stringify(branding));
  }, [branding]);

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    const apply = () => {
      setResolvedTheme(applyBranding(branding, themeMode));
    };

    apply();

    if (themeMode !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply();

    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, [branding, themeMode]);

  const value = useMemo<BrandingContextValue>(
    () => ({
      branding,
      themeMode,
      resolvedTheme,
      updateBranding: (patch) => {
        setBranding((current) => mergeBrandConfig(current, patch));
      },
      updateNavigationItem: (key, patch) => {
        setBranding((current) => ({
          ...current,
          navigation: current.navigation.map((item) =>
            item.key === key ? { ...item, ...patch } : item
          ),
        }));
      },
      setThemeMode,
      toggleTheme: () => {
        setThemeMode((currentMode) => {
          const current = currentMode === 'system' ? resolvedTheme : currentMode;
          return current === 'dark' ? 'light' : 'dark';
        });
      },
      resetBranding: () => {
        setBranding(DEFAULT_BRAND_CONFIG);
        setThemeMode('system');
      },
    }),
    [branding, themeMode, resolvedTheme]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error('useBranding must be used within BrandingProvider');
  }
  return context;
}

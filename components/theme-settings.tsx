"use client";

import { useSyncExternalStore, type CSSProperties } from "react";

type ThemeId =
  | "sunset"
  | "twilight"
  | "autumn"
  | "peach-horizon"
  | "amaranth-noir"
  | "crimson-black"
  | "signal-orange"
  | "branding-orange"
  | "web-slinger";

type ThemeChoice = {
  id: ThemeId;
  name: string;
  description: string;
  colors: readonly string[];
  preview: {
    page: string;
    surface: string;
    text: string;
    accent: string;
    sidebar: string;
    deep: string;
  };
};

const storageKey = "daily-english-theme";
const themeChangeEvent = "daily-english-theme-change";
const defaultTheme: ThemeId = "twilight";

const themes: readonly ThemeChoice[] = [
  {
    id: "sunset",
    name: "Crimson Dusk",
    description: "Deep navy, warm peach, and a confident crimson accent.",
    colors: ["#171E2F", "#242F49", "#384358", "#FFA586", "#B51A29", "#561A22"],
    preview: {
      page: "#171E2F",
      surface: "#242F49",
      text: "#FFA586",
      accent: "#FFA586",
      sidebar: "#561A22",
      deep: "#B51A29",
    },
  },
  {
    id: "twilight",
    name: "Lavender Night",
    description: "A calm blend of midnight blue, lavender, and powder blue.",
    colors: ["#0B1E49", "#C38EB4", "#E1CBD7", "#86ABCF", "#26425A", "#0E1F2F"],
    preview: {
      page: "#0E1F2F",
      surface: "#26425A",
      text: "#E1CBD7",
      accent: "#86ABCF",
      sidebar: "#0B1E49",
      deep: "#C38EB4",
    },
  },
  {
    id: "autumn",
    name: "Autumn Ember",
    description: "Deep teal with stone, clay, and burnt-orange highlights.",
    colors: ["#0D1D25", "#104C64", "#C6C6D0", "#D59D80", "#C0754D", "#B6410F"],
    preview: {
      page: "#0D1D25",
      surface: "#104C64",
      text: "#C6C6D0",
      accent: "#C0754D",
      sidebar: "#104C64",
      deep: "#B6410F",
    },
  },
  {
    id: "peach-horizon",
    name: "Peach Horizon",
    description: "Midnight navy softened with lavender, blush, and warm peach.",
    colors: ["#03122F", "#19305C", "#413B61", "#AE7DAC", "#E1DADF", "#F1916D"],
    preview: {
      page: "#03122F",
      surface: "#19305C",
      text: "#E1DADF",
      accent: "#F1916D",
      sidebar: "#03122F",
      deep: "#AE7DAC",
    },
  },
  {
    id: "amaranth-noir",
    name: "Amaranth Noir",
    description: "Near-black neutrals with silver text and a sharp amaranth accent.",
    colors: ["#020306", "#071018", "#1D2025", "#373A3F", "#BEC5C2", "#E0335A"],
    preview: {
      page: "#020306",
      surface: "#1D2025",
      text: "#EFEFED",
      accent: "#E0335A",
      sidebar: "#071018",
      deep: "#373A3F",
    },
  },
  {
    id: "crimson-black",
    name: "Crimson Black",
    description: "A high-contrast monochrome theme led by vivid crimson red.",
    colors: ["#000000", "#181818", "#3A090D", "#8F1720", "#DF2531", "#FFFFFF"],
    preview: {
      page: "#000000",
      surface: "#181818",
      text: "#FFFFFF",
      accent: "#DF2531",
      sidebar: "#000000",
      deep: "#8F1720",
    },
  },
  {
    id: "signal-orange",
    name: "Signal Orange",
    description: "Graphic black and cool gray surfaces with a bright orange signal.",
    colors: ["#171717", "#F25623", "#4D4D4D", "#DEDEDE", "#A7A7A7", "#F7F7F7"],
    preview: {
      page: "#DEDEDE",
      surface: "#F7F7F7",
      text: "#171717",
      accent: "#F25623",
      sidebar: "#171717",
      deep: "#4D4D4D",
    },
  },
  {
    id: "branding-orange",
    name: "Branding Orange",
    description: "Dark charcoal foundations with intense orange and warm sand.",
    colors: ["#000000", "#333333", "#646464", "#A7A7A7", "#D9C3AB", "#E85002"],
    preview: {
      page: "#000000",
      surface: "#333333",
      text: "#F9F9F9",
      accent: "#F16001",
      sidebar: "#000000",
      deep: "#E85002",
    },
  },
  {
    id: "web-slinger",
    name: "Web Slinger",
    description: "Clean off-white with heroic red, responsibility blue, and dark ink.",
    colors: ["#F5F4F0", "#E8453C", "#3473BA", "#7A3F3B", "#2C2D32", "#141416"],
    preview: {
      page: "#F5F4F0",
      surface: "#FFFFFF",
      text: "#141416",
      accent: "#3473BA",
      sidebar: "#141416",
      deep: "#E8453C",
    },
  },
] as const;

function isThemeId(value: string | null): value is ThemeId {
  return themes.some((theme) => theme.id === value);
}

function getThemeSnapshot(): ThemeId {
  const storedTheme = window.localStorage.getItem(storageKey);
  return isThemeId(storedTheme) ? storedTheme : defaultTheme;
}

function getServerThemeSnapshot(): ThemeId {
  return defaultTheme;
}

function subscribeToThemeChange(callback: () => void) {
  window.addEventListener(themeChangeEvent, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(themeChangeEvent, callback);
    window.removeEventListener("storage", callback);
  };
}

function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem(storageKey, theme);
  window.dispatchEvent(new Event(themeChangeEvent));
}

function previewStyle(preview: ThemeChoice["preview"]) {
  return {
    "--preview-page": preview.page,
    "--preview-primary": preview.surface,
    "--preview-text": preview.text,
    "--preview-accent": preview.accent,
    "--preview-sidebar": preview.sidebar,
    "--preview-deep": preview.deep,
  } as CSSProperties;
}

export function ThemeSettings() {
  const selectedTheme = useSyncExternalStore(
    subscribeToThemeChange,
    getThemeSnapshot,
    getServerThemeSnapshot,
  );

  function chooseTheme(theme: ThemeId) {
    applyTheme(theme);
  }

  return (
    <div className="page-container settings-page">
      <header className="page-heading settings-heading">
        <div>
          <p className="eyebrow">Appearance</p>
          <h1>Choose your color theme</h1>
          <p>Pick the palette that makes your daily practice feel most comfortable.</p>
        </div>
        <div className="settings-save-note" aria-live="polite">
          <span aria-hidden="true">✓</span>
          Saved on this device
        </div>
      </header>

      <section className="theme-grid" aria-label="Available color themes">
        {themes.map((theme) => {
          const isSelected = selectedTheme === theme.id;
          return (
            <button
              className={isSelected ? "theme-option selected" : "theme-option"}
              type="button"
              key={theme.id}
              aria-pressed={isSelected}
              onClick={() => chooseTheme(theme.id)}
            >
              <span className="theme-preview" style={previewStyle(theme.preview)} aria-hidden="true">
                <span className="theme-preview-sidebar">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="theme-preview-workspace">
                  <span className="theme-preview-topbar" />
                  <span className="theme-preview-card">
                    <span />
                    <span />
                    <span />
                  </span>
                  <span className="theme-preview-accent" />
                </span>
              </span>

              <span className="theme-option-copy">
                <span>
                  <strong>{theme.name}</strong>
                  <small>{theme.description}</small>
                </span>
                <span className="theme-option-state" aria-hidden="true">
                  {isSelected ? "Selected" : "Choose"}
                </span>
              </span>

              <span className="theme-swatches" aria-hidden="true">
                {theme.colors.map((color) => (
                  <span key={color} style={{ backgroundColor: color }} title={color} />
                ))}
              </span>
            </button>
          );
        })}
      </section>

      <p className="settings-footnote">
        Your choice applies immediately across Today, Vocabulary, Review, Writing, and Settings.
      </p>
    </div>
  );
}

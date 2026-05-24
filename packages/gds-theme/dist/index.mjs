// src/theme.ts
import { createTheme } from "@mantine/core";
var gdsTheme = createTheme({
  primaryColor: "violet",
  fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
  fontSmoothing: true,
  headings: {
    fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
    sizes: {
      h1: { fontSize: "2.5rem", fontWeight: "800" },
      h2: { fontSize: "1.75rem", fontWeight: "700" },
      h3: { fontSize: "1.25rem", fontWeight: "600" }
    }
  },
  defaultRadius: "md",
  shadows: {
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
  },
  components: {
    Button: {
      defaultProps: {
        radius: "md",
        size: "sm",
        fw: 600
      },
      styles: {
        root: {
          transition: "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), filter 0.2s ease",
          "&:hover": {
            transform: "scale(1.02)",
            filter: "brightness(1.05)"
          },
          "&:active": {
            transform: "scale(0.97)",
            filter: "brightness(0.95)"
          },
          "&[data-disabled]": {
            transform: "none",
            filter: "grayscale(1)",
            opacity: 0.6,
            cursor: "not-allowed"
          }
        }
      }
    },
    Card: {
      defaultProps: {
        radius: "lg",
        shadow: "sm",
        withBorder: true
      },
      styles: {
        root: {
          transition: "transform 200ms ease, box-shadow 200ms ease",
          "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
          }
        }
      }
    },
    TextInput: {
      defaultProps: {
        radius: "md"
      }
    },
    Paper: {
      defaultProps: {
        radius: "lg"
      }
    }
  }
});

// src/GdsProvider.tsx
import { MantineProvider, DirectionProvider, Box } from "@mantine/core";

// src/i18n.ts
import { createContext, useContext } from "react";
var GdsI18nContext = createContext({
  locale: "en",
  messages: {}
});
function useGdsTranslation() {
  const { messages, locale } = useContext(GdsI18nContext);
  return {
    t: (id, defaultMessage) => messages[id] || defaultMessage,
    locale
  };
}

// src/GdsProvider.tsx
import { jsx } from "react/jsx-runtime";
function GdsProvider({ children, locale = "en", messages = {} }) {
  const isRtl = ["ar", "he"].includes(locale);
  const dir = isRtl ? "rtl" : "ltr";
  return /* @__PURE__ */ jsx(DirectionProvider, { initialDirection: dir, children: /* @__PURE__ */ jsx(GdsI18nContext.Provider, { value: { locale, messages }, children: /* @__PURE__ */ jsx(MantineProvider, { theme: gdsTheme, withCssVariables: true, withGlobalClasses: true, defaultColorScheme: "light", children: /* @__PURE__ */ jsx(Box, { dir, h: "100%", children }) }) }) });
}
export {
  GdsProvider,
  gdsTheme,
  useGdsTranslation
};

"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  GdsProvider: () => GdsProvider,
  gdsTheme: () => gdsTheme,
  useGdsTranslation: () => useGdsTranslation
});
module.exports = __toCommonJS(index_exports);

// src/theme.ts
var import_core = require("@mantine/core");
var gdsTheme = (0, import_core.createTheme)({
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
var import_core2 = require("@mantine/core");

// src/i18n.ts
var import_react = require("react");
var GdsI18nContext = (0, import_react.createContext)({
  locale: "en",
  messages: {}
});
function useGdsTranslation() {
  const { messages, locale } = (0, import_react.useContext)(GdsI18nContext);
  return {
    t: (id, defaultMessage) => messages[id] || defaultMessage,
    locale
  };
}

// src/GdsProvider.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function GdsProvider({ children, locale = "en", messages = {} }) {
  const isRtl = ["ar", "he"].includes(locale);
  const dir = isRtl ? "rtl" : "ltr";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_core2.DirectionProvider, { initialDirection: dir, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GdsI18nContext.Provider, { value: { locale, messages }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_core2.MantineProvider, { theme: gdsTheme, withCssVariables: true, withGlobalClasses: true, defaultColorScheme: "light", children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_core2.Box, { dir, h: "100%", children }) }) }) });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  GdsProvider,
  gdsTheme,
  useGdsTranslation
});

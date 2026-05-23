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
  gdsTheme: () => gdsTheme
});
module.exports = __toCommonJS(index_exports);

// src/theme.ts
var import_core = require("@mantine/core");
var brand = [
  "#f0fdf4",
  "#dcfce7",
  "#bbf7d0",
  "#86efac",
  "#4ade80",
  "#22c55e",
  "#16a34a",
  "#15803d",
  "#166534",
  "#14532d"
];
var gdsTheme = (0, import_core.createTheme)({
  primaryColor: "brand",
  colors: {
    brand
  },
  fontFamily: "Inter, system-ui, sans-serif",
  headings: {
    fontFamily: "Inter, system-ui, sans-serif",
    sizes: {
      h1: { fontSize: "2rem", fontWeight: "700" },
      h2: { fontSize: "1.5rem", fontWeight: "600" },
      h3: { fontSize: "1.25rem", fontWeight: "600" }
    }
  },
  defaultRadius: "md",
  components: {
    Button: {
      defaultProps: {
        radius: "md",
        size: "sm"
      }
    },
    TextInput: {
      defaultProps: {
        radius: "md"
      }
    }
    // We strictly enforce no arbitrary colors for buttons in apps by default
  }
});

// src/GdsProvider.tsx
var import_core2 = require("@mantine/core");
var import_jsx_runtime = require("react/jsx-runtime");
function GdsProvider({ children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_core2.MantineProvider, { theme: gdsTheme, withCssVariables: true, withGlobalClasses: true, defaultColorScheme: "light", children });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  GdsProvider,
  gdsTheme
});

// src/theme.ts
import { createTheme } from "@mantine/core";
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
var gdsTheme = createTheme({
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
import { MantineProvider } from "@mantine/core";
import { jsx } from "react/jsx-runtime";
function GdsProvider({ children }) {
  return /* @__PURE__ */ jsx(MantineProvider, { theme: gdsTheme, withCssVariables: true, withGlobalClasses: true, defaultColorScheme: "light", children });
}
export {
  GdsProvider,
  gdsTheme
};

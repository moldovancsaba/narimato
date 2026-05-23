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
  ConfirmDialog: () => ConfirmDialog,
  EmptyState: () => EmptyState,
  StatusBadge: () => StatusBadge
});
module.exports = __toCommonJS(index_exports);

// src/StatusBadge.tsx
var import_core = require("@mantine/core");
var import_jsx_runtime = require("react/jsx-runtime");
var statusColorMap = {
  success: "green",
  warning: "yellow",
  danger: "red",
  info: "blue",
  neutral: "gray"
};
function StatusBadge({ status, children, ...props }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_core.Badge, { color: statusColorMap[status], variant: "light", ...props, children });
}

// src/EmptyState.tsx
var import_core2 = require("@mantine/core");
var import_jsx_runtime2 = require("react/jsx-runtime");
function EmptyState({ icon, title, description, action }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_core2.Stack, { align: "center", justify: "center", gap: "md", py: "xl", style: { textAlign: "center" }, children: [
    icon && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_core2.Box, { c: "dimmed", children: icon }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_core2.Title, { order: 3, children: title }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_core2.Text, { c: "dimmed", maw: 400, children: description }),
    action && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_core2.Box, { mt: "md", children: action })
  ] });
}

// src/ConfirmDialog.tsx
var import_core3 = require("@mantine/core");
var import_jsx_runtime3 = require("react/jsx-runtime");
function ConfirmDialog({
  opened,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDanger = true,
  loading = false
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_core3.Modal, { opened, onClose, title, centered: true, trapFocus: true, children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_core3.Text, { size: "sm", mb: "xl", children }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_core3.Group, { justify: "flex-end", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_core3.Button, { variant: "default", onClick: onClose, disabled: loading, children: cancelLabel }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(import_core3.Button, { color: isDanger ? "red" : "brand", onClick: onConfirm, loading, children: confirmLabel })
    ] })
  ] });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ConfirmDialog,
  EmptyState,
  StatusBadge
});

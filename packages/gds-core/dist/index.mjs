// src/StatusBadge.tsx
import { Badge } from "@mantine/core";
import { jsx } from "react/jsx-runtime";
var statusColorMap = {
  success: "green",
  warning: "yellow",
  danger: "red",
  info: "blue",
  neutral: "gray"
};
function StatusBadge({ status, children, ...props }) {
  return /* @__PURE__ */ jsx(Badge, { color: statusColorMap[status], variant: "light", ...props, children });
}

// src/EmptyState.tsx
import { Stack, Text, Title, Box } from "@mantine/core";
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
function EmptyState({ icon, title, description, action }) {
  return /* @__PURE__ */ jsxs(Stack, { align: "center", justify: "center", gap: "md", py: "xl", style: { textAlign: "center" }, children: [
    icon && /* @__PURE__ */ jsx2(Box, { c: "dimmed", children: icon }),
    /* @__PURE__ */ jsx2(Title, { order: 3, children: title }),
    /* @__PURE__ */ jsx2(Text, { c: "dimmed", maw: 400, children: description }),
    action && /* @__PURE__ */ jsx2(Box, { mt: "md", children: action })
  ] });
}

// src/ConfirmDialog.tsx
import { Modal, Group, Button, Text as Text2 } from "@mantine/core";
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
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
  return /* @__PURE__ */ jsxs2(Modal, { opened, onClose, title, centered: true, trapFocus: true, children: [
    /* @__PURE__ */ jsx3(Text2, { size: "sm", mb: "xl", children }),
    /* @__PURE__ */ jsxs2(Group, { justify: "flex-end", children: [
      /* @__PURE__ */ jsx3(Button, { variant: "default", onClick: onClose, disabled: loading, children: cancelLabel }),
      /* @__PURE__ */ jsx3(Button, { color: isDanger ? "red" : "brand", onClick: onConfirm, loading, children: confirmLabel })
    ] })
  ] });
}
export {
  ConfirmDialog,
  EmptyState,
  StatusBadge
};

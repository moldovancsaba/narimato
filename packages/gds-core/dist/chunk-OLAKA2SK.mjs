import {
  GdsIcons,
  GdsVocabulary,
  StateBlock
} from "./chunk-2YWZT6VM.mjs";

// src/SemanticButton.tsx
import { useState, useEffect } from "react";
import { Button } from "@mantine/core";
import { useGdsTranslation } from "@gds/theme";
import { IconCheck, IconX } from "@tabler/icons-react";
import { jsx } from "react/jsx-runtime";
function SemanticButton({ action, loading, feedbackState, feedbackText, ...props }) {
  const { t } = useGdsTranslation();
  const config = GdsVocabulary[action];
  const [internalFeedback, setInternalFeedback] = useState(null);
  useEffect(() => {
    if (feedbackState) {
      setInternalFeedback(feedbackState);
      const timer = setTimeout(() => setInternalFeedback(null), 2e3);
      return () => clearTimeout(timer);
    }
  }, [feedbackState]);
  let Icon = config.icon;
  let label = t(config.id, config.defaultMessage);
  let color = props.color;
  if (internalFeedback === "success") {
    const defaultFeedback = "feedback" in config && config.feedback ? config.feedback : { icon: IconCheck, color: "teal", messageId: "gds.feedback.saved" };
    Icon = defaultFeedback.icon;
    label = feedbackText || t(defaultFeedback.messageId, "Success");
    color = defaultFeedback.color;
  } else if (internalFeedback === "error") {
    Icon = IconX;
    label = feedbackText || t("gds.feedback.error", "Something went wrong");
    color = "red";
  }
  return /* @__PURE__ */ jsx(
    Button,
    {
      leftSection: /* @__PURE__ */ jsx(Icon, { size: "1rem" }),
      loading,
      color,
      ...props,
      children: label
    }
  );
}

// src/ConfirmDialog.tsx
import { Modal, Group, Text } from "@mantine/core";
import { jsx as jsx2, jsxs } from "react/jsx-runtime";
function ConfirmDialog({
  opened,
  onClose,
  onConfirm,
  title,
  children,
  confirmAction = "confirm",
  cancelAction = "cancel",
  isDanger = true,
  loading = false
}) {
  return /* @__PURE__ */ jsxs(Modal, { opened, onClose, title, centered: true, trapFocus: true, children: [
    /* @__PURE__ */ jsx2(Text, { size: "sm", mb: "xl", children }),
    /* @__PURE__ */ jsxs(Group, { justify: "flex-end", children: [
      /* @__PURE__ */ jsx2(SemanticButton, { action: cancelAction, variant: "default", onClick: onClose, disabled: loading }),
      /* @__PURE__ */ jsx2(SemanticButton, { action: confirmAction, color: isDanger ? "red" : "violet", onClick: onConfirm, loading })
    ] })
  ] });
}

// src/ThemeToggle.tsx
import { ActionIcon, useMantineColorScheme, useComputedColorScheme } from "@mantine/core";
import { useGdsTranslation as useGdsTranslation2 } from "@gds/theme";
import { jsx as jsx3 } from "react/jsx-runtime";
function ThemeToggle({ size = "md" }) {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme("light", { getInitialValueInEffect: true });
  const { t } = useGdsTranslation2();
  const toggleColorScheme = () => {
    setColorScheme(computedColorScheme === "dark" ? "light" : "dark");
  };
  const isDark = computedColorScheme === "dark";
  return /* @__PURE__ */ jsx3(
    ActionIcon,
    {
      onClick: toggleColorScheme,
      variant: "default",
      size,
      "aria-label": t("gds.aria.themeToggle", "Toggle color scheme"),
      children: isDark ? /* @__PURE__ */ jsx3(GdsIcons.Sun, { size: "1.2rem" }) : /* @__PURE__ */ jsx3(GdsIcons.Moon, { size: "1.2rem" })
    }
  );
}

// src/GameBoardTile.tsx
import { Center, Paper, Text as Text2, UnstyledButton, useMantineTheme } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { jsx as jsx4 } from "react/jsx-runtime";
function GameBoardTile({
  face,
  revealed,
  matched,
  disabled,
  onPress,
  highlightColor
}) {
  const theme = useMantineTheme();
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const highlighted = revealed && !matched;
  const revealBg = highlightColor ?? (typeof theme.primaryColor === "string" ? `${theme.primaryColor}.5` : "violet.5");
  return /* @__PURE__ */ jsx4(UnstyledButton, { w: "100%", disabled, onClick: onPress, "aria-pressed": revealed, children: /* @__PURE__ */ jsx4(
    Paper,
    {
      withBorder: true,
      radius: "md",
      p: "md",
      bg: revealed ? revealBg : "dark.6",
      styles: {
        root: {
          aspectRatio: "1",
          opacity: matched ? 0.55 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
          transition: reduceMotion ? "opacity 0.2s ease" : "transform 0.25s ease, background-color 0.25s ease, opacity 0.25s ease",
          transform: reduceMotion || !highlighted ? "scale(1)" : "scale(1.02)"
        }
      },
      children: /* @__PURE__ */ jsx4(Center, { h: "100%", children: /* @__PURE__ */ jsx4(Text2, { size: "xl", fw: 700, children: face }) })
    }
  ) });
}

// src/DocsCodeBlock.tsx
import { useState as useState2 } from "react";
import { ActionIcon as ActionIcon2, Code, Group as Group2, Paper as Paper2, Stack, Text as Text3 } from "@mantine/core";
import { jsx as jsx5, jsxs as jsxs2 } from "react/jsx-runtime";
function DocsCodeBlock({ code, language, title, withCopy = true }) {
  const [copied, setCopied] = useState2(false);
  const handleCopy = async () => {
    if (!navigator?.clipboard) {
      return;
    }
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  return /* @__PURE__ */ jsx5(Paper2, { withBorder: true, radius: "lg", p: "md", children: /* @__PURE__ */ jsxs2(Stack, { gap: "sm", children: [
    title || withCopy ? /* @__PURE__ */ jsxs2(Group2, { justify: "space-between", align: "center", children: [
      /* @__PURE__ */ jsxs2(Stack, { gap: 0, children: [
        title ? /* @__PURE__ */ jsx5(Text3, { fw: 600, children: title }) : null,
        language ? /* @__PURE__ */ jsx5(Text3, { size: "xs", c: "dimmed", children: language }) : null
      ] }),
      withCopy ? /* @__PURE__ */ jsx5(
        ActionIcon2,
        {
          variant: "subtle",
          "aria-label": copied ? "Copied code block" : "Copy code block",
          onClick: () => {
            void handleCopy();
          },
          children: /* @__PURE__ */ jsx5(GdsIcons.Copy, { size: "1rem" })
        }
      ) : null
    ] }) : null,
    /* @__PURE__ */ jsx5(Code, { block: true, children: code })
  ] }) });
}

// src/UploadDropzone.tsx
import { useRef, useState as useState3 } from "react";
import { Box, Button as Button2, Group as Group3, Stack as Stack2, Text as Text4 } from "@mantine/core";
import { jsx as jsx6, jsxs as jsxs3 } from "react/jsx-runtime";
function UploadDropzone({
  title,
  description,
  onFilesSelected,
  accept,
  multiple = true,
  actionLabel = "Choose files",
  mode = "panel"
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState3(false);
  const UploadIcon = GdsIcons.Upload;
  const forwardFiles = (files) => {
    if (!files?.length || !onFilesSelected) {
      return;
    }
    onFilesSelected(Array.from(files));
  };
  return /* @__PURE__ */ jsxs3(
    Box,
    {
      onDragOver: (event) => {
        event.preventDefault();
        setDragging(true);
      },
      onDragLeave: () => setDragging(false),
      onDrop: (event) => {
        event.preventDefault();
        setDragging(false);
        forwardFiles(event.dataTransfer.files);
      },
      p: mode === "inline" ? "md" : "xl",
      style: {
        border: `1px dashed var(${dragging ? "--mantine-color-violet-6" : "--mantine-color-default-border"})`,
        borderRadius: "var(--mantine-radius-lg)",
        background: dragging ? "var(--mantine-color-violet-light)" : "transparent"
      },
      children: [
        /* @__PURE__ */ jsx6(
          "input",
          {
            ref: inputRef,
            type: "file",
            hidden: true,
            accept,
            multiple,
            onChange: (event) => forwardFiles(event.currentTarget.files)
          }
        ),
        /* @__PURE__ */ jsxs3(Stack2, { align: mode === "inline" ? "flex-start" : "center", ta: mode === "inline" ? "left" : "center", gap: "sm", children: [
          /* @__PURE__ */ jsx6(UploadIcon, { size: "1.5rem" }),
          /* @__PURE__ */ jsx6(Text4, { fw: 600, children: title }),
          description ? /* @__PURE__ */ jsx6(Text4, { size: "sm", c: "dimmed", children: description }) : null,
          /* @__PURE__ */ jsx6(Group3, { children: /* @__PURE__ */ jsx6(Button2, { variant: "light", onClick: () => inputRef.current?.click(), children: actionLabel }) })
        ] })
      ]
    }
  );
}

// src/AccessRecoveryPanel.tsx
import { Group as Group4 } from "@mantine/core";
import { useGdsTranslation as useGdsTranslation3 } from "@gds/theme";
import { jsx as jsx7 } from "react/jsx-runtime";
var stateBlockVariantByState = {
  unauthenticated: "permission",
  "expired-session": "info",
  forbidden: "permission",
  missing: "error",
  unavailable: "error"
};
var defaultCopyByState = {
  unauthenticated: {
    title: "Sign in required",
    description: "Please sign in to continue to this content."
  },
  "expired-session": {
    title: "Session expired",
    description: "Sign in again or retry to continue where you left off."
  },
  forbidden: {
    title: "You do not have access",
    description: "This content is outside your current permissions or scope."
  },
  missing: {
    title: "Content not found",
    description: "The resource may have moved, been deleted, or never existed in this scope."
  },
  unavailable: {
    title: "Content is temporarily unavailable",
    description: "Try again in a moment or return to a safe destination."
  }
};
function defaultActionsForState(state, {
  onRetry,
  onSignIn,
  onBack,
  supportAction
}) {
  const signInAction = onSignIn ? { action: "login", onClick: onSignIn } : null;
  const retryAction = onRetry ? { action: "refresh", onClick: onRetry, variant: "light" } : null;
  const backAction = onBack ? { action: "back", onClick: onBack, variant: "default" } : null;
  switch (state) {
    case "unauthenticated":
      return { primary: signInAction, secondary: backAction, tertiary: supportAction ?? null };
    case "expired-session":
      return {
        primary: signInAction ?? retryAction,
        secondary: retryAction && signInAction ? retryAction : backAction,
        tertiary: supportAction ?? null
      };
    case "forbidden":
      return { primary: backAction, secondary: supportAction ?? null, tertiary: null };
    case "missing":
      return { primary: backAction, secondary: supportAction ?? null, tertiary: null };
    case "unavailable":
      return {
        primary: retryAction ?? backAction,
        secondary: retryAction && backAction ? backAction : supportAction ?? null,
        tertiary: retryAction && backAction ? supportAction ?? null : null
      };
  }
}
function ActionGroup({
  primaryAction,
  secondaryAction,
  tertiaryAction
}) {
  const actions = [primaryAction, secondaryAction, tertiaryAction].filter(Boolean);
  if (actions.length === 0) {
    return null;
  }
  return /* @__PURE__ */ jsx7(Group4, { gap: "sm", justify: "center", wrap: "wrap", children: actions.map((actionConfig, index) => /* @__PURE__ */ jsx7(
    SemanticButton,
    {
      action: actionConfig.action,
      onClick: actionConfig.onClick,
      loading: actionConfig.loading,
      disabled: actionConfig.disabled,
      color: actionConfig.color,
      variant: actionConfig.variant ?? (index === 0 ? "filled" : "default")
    },
    `${actionConfig.action}-${index}`
  )) });
}
function AccessRecoveryPanel({
  state,
  title,
  description,
  primaryAction,
  secondaryAction,
  tertiaryAction,
  onRetry,
  onSignIn,
  onBack,
  supportAction,
  compact = false
}) {
  const { t } = useGdsTranslation3();
  const defaultCopy = defaultCopyByState[state];
  const defaults = defaultActionsForState(state, {
    onRetry,
    onSignIn,
    onBack,
    supportAction
  });
  return /* @__PURE__ */ jsx7(
    StateBlock,
    {
      variant: stateBlockVariantByState[state],
      compact,
      title: title ?? t(`gds.accessRecovery.${state}.title`, defaultCopy.title),
      description: description ?? t(`gds.accessRecovery.${state}.description`, defaultCopy.description),
      action: /* @__PURE__ */ jsx7(
        ActionGroup,
        {
          primaryAction: primaryAction ?? defaults.primary,
          secondaryAction: secondaryAction ?? defaults.secondary,
          tertiaryAction: tertiaryAction ?? defaults.tertiary
        }
      )
    }
  );
}

export {
  SemanticButton,
  ConfirmDialog,
  ThemeToggle,
  GameBoardTile,
  DocsCodeBlock,
  UploadDropzone,
  AccessRecoveryPanel
};

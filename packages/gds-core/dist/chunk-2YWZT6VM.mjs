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
  return /* @__PURE__ */ jsxs(Stack, { align: "center", justify: "center", gap: "md", py: "xl", ta: "center", children: [
    icon && /* @__PURE__ */ jsx2(Box, { c: "dimmed", children: icon }),
    /* @__PURE__ */ jsx2(Title, { order: 3, children: title }),
    /* @__PURE__ */ jsx2(Text, { c: "dimmed", maw: 400, children: description }),
    action && /* @__PURE__ */ jsx2(Box, { mt: "md", children: action })
  ] });
}

// src/icons.ts
import {
  IconDashboard,
  IconSettings,
  IconUsers,
  IconPlus,
  IconEdit,
  IconTrash,
  IconSearch,
  IconDeviceFloppy,
  IconCheck,
  IconAlertTriangle,
  IconAlertCircle,
  IconInfoCircle,
  IconChevronDown,
  IconChevronUp,
  IconX,
  IconSquareCheck,
  IconSquareX,
  IconMenu2,
  IconMoon,
  IconSun,
  IconChartBar,
  IconPlayerPlay,
  IconRocket,
  IconBan,
  IconThumbUp,
  IconHome,
  IconInbox,
  IconCalendar,
  IconPhoto,
  IconHistory,
  IconUser,
  IconSend,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconPaperclip,
  IconUpload,
  IconDownload,
  IconPrinter,
  IconCopy,
  IconCopyPlus,
  IconChecks,
  IconClearAll,
  IconCamera,
  IconVideo,
  IconCameraRotate,
  IconBolt,
  IconBook,
  IconNotebook,
  IconCertificate,
  IconSchool,
  IconBooks,
  IconAward,
  IconMoodKid,
  IconUsersGroup,
  IconTarget,
  IconFlag,
  IconFlame,
  IconGift,
  IconLanguage,
  IconPalette,
  IconTrophy,
  IconCrown,
  IconPlayerPause,
  IconMessage,
  IconMail,
  IconRefresh,
  IconTrendingUp,
  IconTrendingDown,
  IconCurrencyDollar,
  IconLayoutGrid,
  IconList,
  IconDoorExit,
  IconBell,
  IconArrowLeft,
  IconEye,
  IconEyeOff,
  IconHelpCircle,
  IconFilter,
  IconArrowsSort,
  IconFileExport,
  IconFileImport,
  IconTrashOff,
  IconToggleLeft,
  IconLogin,
  IconUserPlus,
  IconShieldCheck,
  IconFileText,
  IconShare
} from "@tabler/icons-react";
var GdsIcons = {
  // Navigation
  Dashboard: IconDashboard,
  Settings: IconSettings,
  Users: IconUsers,
  Analytics: IconChartBar,
  Home: IconHome,
  Inbox: IconInbox,
  Calendar: IconCalendar,
  Gallery: IconPhoto,
  History: IconHistory,
  Profile: IconUser,
  // Actions
  Add: IconPlus,
  Edit: IconEdit,
  Delete: IconTrash,
  Search: IconSearch,
  Save: IconDeviceFloppy,
  Play: IconPlayerPlay,
  Start: IconRocket,
  Send: IconSend,
  Reply: IconArrowBackUp,
  Forward: IconArrowForwardUp,
  Attach: IconPaperclip,
  Upload: IconUpload,
  Download: IconDownload,
  Print: IconPrinter,
  Copy: IconCopy,
  Duplicate: IconCopyPlus,
  Check: IconSquareCheck,
  Uncheck: IconSquareX,
  Complete: IconChecks,
  Clear: IconClearAll,
  Cancel: IconBan,
  Confirm: IconThumbUp,
  Close: IconX,
  // Preferences & System
  Language: IconLanguage,
  Theme: IconPalette,
  // Media
  Capture: IconCamera,
  Record: IconVideo,
  Flip: IconCameraRotate,
  Flash: IconBolt,
  // Domain specific
  Course: IconBook,
  Lesson: IconNotebook,
  Certificate: IconCertificate,
  Student: IconSchool,
  Class: IconBooks,
  Grade: IconAward,
  Child: IconMoodKid,
  Family: IconUsersGroup,
  Habit: IconTarget,
  Goal: IconFlag,
  Streak: IconFlame,
  Reward: IconGift,
  // Feedback
  Success: IconCheck,
  Warning: IconAlertTriangle,
  Danger: IconAlertCircle,
  Info: IconInfoCircle,
  // Analysis additions
  Trophy: IconTrophy,
  Crown: IconCrown,
  Pause: IconPlayerPause,
  Message: IconMessage,
  Mail: IconMail,
  Refresh: IconRefresh,
  TrendingUp: IconTrendingUp,
  TrendingDown: IconTrendingDown,
  Currency: IconCurrencyDollar,
  Grid: IconLayoutGrid,
  List: IconList,
  Logout: IconDoorExit,
  Notifications: IconBell,
  Back: IconArrowLeft,
  Eye: IconEye,
  EyeOff: IconEyeOff,
  Help: IconHelpCircle,
  Filter: IconFilter,
  Sort: IconArrowsSort,
  // New Audit-driven additions
  Export: IconFileExport,
  Import: IconFileImport,
  Preview: IconEye,
  Clone: IconCopy,
  Restore: IconTrashOff,
  Toggle: IconToggleLeft,
  Submit: IconCheck,
  Reset: IconRefresh,
  Login: IconLogin,
  Register: IconUserPlus,
  Verify: IconShieldCheck,
  Launch: IconRocket,
  Draft: IconFileText,
  Refer: IconShare,
  Evidence: IconPaperclip,
  // System
  ChevronDown: IconChevronDown,
  ChevronUp: IconChevronUp,
  Menu: IconMenu2,
  Moon: IconMoon,
  Sun: IconSun
};

// src/vocabulary.ts
var GdsVocabulary = {
  // Base
  settings: { id: "gds.action.settings", defaultMessage: "Settings", icon: GdsIcons.Settings, feedback: { icon: GdsIcons.Settings, color: "teal", messageId: "gds.feedback.saved" } },
  analytics: { id: "gds.action.analytics", defaultMessage: "Analytics", icon: GdsIcons.Analytics, feedback: { icon: GdsIcons.Analytics, color: "teal", messageId: "gds.feedback.loaded" } },
  dashboard: { id: "gds.action.dashboard", defaultMessage: "Dashboard", icon: GdsIcons.Dashboard, feedback: { icon: GdsIcons.Dashboard, color: "teal", messageId: "gds.feedback.loaded" } },
  play: { id: "gds.action.play", defaultMessage: "Play", icon: GdsIcons.Play, feedback: { icon: GdsIcons.Play, color: "teal", messageId: "gds.feedback.started" } },
  start: { id: "gds.action.start", defaultMessage: "Start", icon: GdsIcons.Start, feedback: { icon: GdsIcons.Start, color: "teal", messageId: "gds.feedback.started" } },
  users: { id: "gds.action.users", defaultMessage: "Users", icon: GdsIcons.Users, feedback: { icon: GdsIcons.Users, color: "teal", messageId: "gds.feedback.loaded" } },
  add: { id: "gds.action.add", defaultMessage: "Add", icon: GdsIcons.Add, feedback: { icon: GdsIcons.Add, color: "teal", messageId: "gds.feedback.added" } },
  edit: { id: "gds.action.edit", defaultMessage: "Edit", icon: GdsIcons.Edit, feedback: { icon: GdsIcons.Edit, color: "teal", messageId: "gds.feedback.edited" } },
  delete: { id: "gds.action.delete", defaultMessage: "Delete", icon: GdsIcons.Delete, feedback: { icon: GdsIcons.Delete, color: "red", messageId: "gds.feedback.deleted" } },
  save: { id: "gds.action.save", defaultMessage: "Save", icon: GdsIcons.Save, feedback: { icon: GdsIcons.Save, color: "teal", messageId: "gds.feedback.saved" } },
  cancel: { id: "gds.action.cancel", defaultMessage: "Cancel", icon: GdsIcons.Cancel, feedback: { icon: GdsIcons.Cancel, color: "red", messageId: "gds.feedback.canceled" } },
  confirm: { id: "gds.action.confirm", defaultMessage: "Confirm", icon: GdsIcons.Confirm, feedback: { icon: GdsIcons.Confirm, color: "teal", messageId: "gds.feedback.confirmed" } },
  close: { id: "gds.action.close", defaultMessage: "Close", icon: GdsIcons.Close, feedback: { icon: GdsIcons.Close, color: "gray", messageId: "gds.feedback.closed" } },
  language: { id: "gds.action.language", defaultMessage: "Language", icon: GdsIcons.Language, feedback: { icon: GdsIcons.Language, color: "teal", messageId: "gds.feedback.changed" } },
  theme: { id: "gds.action.theme", defaultMessage: "Theme", icon: GdsIcons.Theme, feedback: { icon: GdsIcons.Theme, color: "teal", messageId: "gds.feedback.changed" } },
  // Navigation
  home: { id: "gds.action.home", defaultMessage: "Home", icon: GdsIcons.Home, feedback: { icon: GdsIcons.Home, color: "teal", messageId: "gds.feedback.opened" } },
  inbox: { id: "gds.action.inbox", defaultMessage: "Inbox", icon: GdsIcons.Inbox, feedback: { icon: GdsIcons.Inbox, color: "teal", messageId: "gds.feedback.opened" } },
  calendar: { id: "gds.action.calendar", defaultMessage: "Calendar", icon: GdsIcons.Calendar, feedback: { icon: GdsIcons.Calendar, color: "teal", messageId: "gds.feedback.opened" } },
  gallery: { id: "gds.action.gallery", defaultMessage: "Gallery", icon: GdsIcons.Gallery, feedback: { icon: GdsIcons.Gallery, color: "teal", messageId: "gds.feedback.opened" } },
  history: { id: "gds.action.history", defaultMessage: "History", icon: GdsIcons.History, feedback: { icon: GdsIcons.History, color: "teal", messageId: "gds.feedback.opened" } },
  profile: { id: "gds.action.profile", defaultMessage: "Profile", icon: GdsIcons.Profile, feedback: { icon: GdsIcons.Profile, color: "teal", messageId: "gds.feedback.opened" } },
  // Actions
  send: { id: "gds.action.send", defaultMessage: "Send", icon: GdsIcons.Send, feedback: { icon: GdsIcons.Send, color: "blue", messageId: "gds.feedback.sent" } },
  reply: { id: "gds.action.reply", defaultMessage: "Reply", icon: GdsIcons.Reply, feedback: { icon: GdsIcons.Reply, color: "blue", messageId: "gds.feedback.replied" } },
  forward: { id: "gds.action.forward", defaultMessage: "Forward", icon: GdsIcons.Forward, feedback: { icon: GdsIcons.Forward, color: "blue", messageId: "gds.feedback.forwarded" } },
  attach: { id: "gds.action.attach", defaultMessage: "Attach", icon: GdsIcons.Attach, feedback: { icon: GdsIcons.Attach, color: "teal", messageId: "gds.feedback.attached" } },
  upload: { id: "gds.action.upload", defaultMessage: "Upload", icon: GdsIcons.Upload, feedback: { icon: GdsIcons.Upload, color: "teal", messageId: "gds.feedback.uploaded" } },
  download: { id: "gds.action.download", defaultMessage: "Download", icon: GdsIcons.Download, feedback: { icon: GdsIcons.Download, color: "teal", messageId: "gds.feedback.downloaded" } },
  print: { id: "gds.action.print", defaultMessage: "Print", icon: GdsIcons.Print, feedback: { icon: GdsIcons.Print, color: "teal", messageId: "gds.feedback.printed" } },
  copy: { id: "gds.action.copy", defaultMessage: "Copy", icon: GdsIcons.Copy, feedback: { icon: GdsIcons.Copy, color: "teal", messageId: "gds.feedback.copied" } },
  duplicate: { id: "gds.action.duplicate", defaultMessage: "Duplicate", icon: GdsIcons.Duplicate, feedback: { icon: GdsIcons.Duplicate, color: "teal", messageId: "gds.feedback.duplicated" } },
  check: { id: "gds.action.check", defaultMessage: "Check", icon: GdsIcons.Check, feedback: { icon: GdsIcons.Check, color: "teal", messageId: "gds.feedback.checked" } },
  uncheck: { id: "gds.action.uncheck", defaultMessage: "Uncheck", icon: GdsIcons.Uncheck, feedback: { icon: GdsIcons.Uncheck, color: "red", messageId: "gds.feedback.unchecked" } },
  complete: { id: "gds.action.complete", defaultMessage: "Complete", icon: GdsIcons.Complete, feedback: { icon: GdsIcons.Complete, color: "teal", messageId: "gds.feedback.completed" } },
  clear: { id: "gds.action.clear", defaultMessage: "Clear", icon: GdsIcons.Clear, feedback: { icon: GdsIcons.Clear, color: "red", messageId: "gds.feedback.cleared" } },
  // Media (camera project)
  capture: { id: "gds.action.capture", defaultMessage: "Capture", icon: GdsIcons.Capture, feedback: { icon: GdsIcons.Capture, color: "teal", messageId: "gds.feedback.captured" } },
  record: { id: "gds.action.record", defaultMessage: "Record", icon: GdsIcons.Record, feedback: { icon: GdsIcons.Record, color: "teal", messageId: "gds.feedback.recorded" } },
  flip: { id: "gds.action.flip", defaultMessage: "Flip", icon: GdsIcons.Flip, feedback: { icon: GdsIcons.Flip, color: "teal", messageId: "gds.feedback.flipped" } },
  flash: { id: "gds.action.flash", defaultMessage: "Flash", icon: GdsIcons.Flash, feedback: { icon: GdsIcons.Flash, color: "teal", messageId: "gds.feedback.flashed" } },
  // Domain specific (amanoba, classscout, kidex, habigoal)
  course: { id: "gds.action.course", defaultMessage: "Course", icon: GdsIcons.Course, feedback: { icon: GdsIcons.Course, color: "teal", messageId: "gds.feedback.done" } },
  lesson: { id: "gds.action.lesson", defaultMessage: "Lesson", icon: GdsIcons.Lesson, feedback: { icon: GdsIcons.Lesson, color: "teal", messageId: "gds.feedback.done" } },
  certificate: { id: "gds.action.certificate", defaultMessage: "Certificate", icon: GdsIcons.Certificate, feedback: { icon: GdsIcons.Certificate, color: "teal", messageId: "gds.feedback.done" } },
  student: { id: "gds.action.student", defaultMessage: "Student", icon: GdsIcons.Student, feedback: { icon: GdsIcons.Student, color: "teal", messageId: "gds.feedback.done" } },
  class: { id: "gds.action.class", defaultMessage: "Class", icon: GdsIcons.Class, feedback: { icon: GdsIcons.Class, color: "teal", messageId: "gds.feedback.done" } },
  grade: { id: "gds.action.grade", defaultMessage: "Grade", icon: GdsIcons.Grade, feedback: { icon: GdsIcons.Grade, color: "teal", messageId: "gds.feedback.done" } },
  child: { id: "gds.action.child", defaultMessage: "Child", icon: GdsIcons.Child, feedback: { icon: GdsIcons.Child, color: "teal", messageId: "gds.feedback.done" } },
  family: { id: "gds.action.family", defaultMessage: "Family", icon: GdsIcons.Family, feedback: { icon: GdsIcons.Family, color: "teal", messageId: "gds.feedback.done" } },
  habit: { id: "gds.action.habit", defaultMessage: "Habit", icon: GdsIcons.Habit, feedback: { icon: GdsIcons.Habit, color: "teal", messageId: "gds.feedback.done" } },
  goal: { id: "gds.action.goal", defaultMessage: "Goal", icon: GdsIcons.Goal, feedback: { icon: GdsIcons.Goal, color: "teal", messageId: "gds.feedback.done" } },
  streak: { id: "gds.action.streak", defaultMessage: "Streak", icon: GdsIcons.Streak, feedback: { icon: GdsIcons.Streak, color: "teal", messageId: "gds.feedback.done" } },
  reward: { id: "gds.action.reward", defaultMessage: "Reward", icon: GdsIcons.Reward, feedback: { icon: GdsIcons.Reward, color: "yellow", messageId: "gds.feedback.rewarded" } },
  // Codebase analysis additions
  trophy: { id: "gds.action.trophy", defaultMessage: "Trophy", icon: GdsIcons.Trophy, feedback: { icon: GdsIcons.Trophy, color: "yellow", messageId: "gds.feedback.rewarded" } },
  crown: { id: "gds.action.crown", defaultMessage: "Crown", icon: GdsIcons.Crown, feedback: { icon: GdsIcons.Crown, color: "yellow", messageId: "gds.feedback.rewarded" } },
  pause: { id: "gds.action.pause", defaultMessage: "Pause", icon: GdsIcons.Pause, feedback: { icon: GdsIcons.Pause, color: "teal", messageId: "gds.feedback.paused" } },
  message: { id: "gds.action.message", defaultMessage: "Message", icon: GdsIcons.Message, feedback: { icon: GdsIcons.Message, color: "blue", messageId: "gds.feedback.sent" } },
  mail: { id: "gds.action.mail", defaultMessage: "Mail", icon: GdsIcons.Mail, feedback: { icon: GdsIcons.Mail, color: "blue", messageId: "gds.feedback.mailed" } },
  refresh: { id: "gds.action.refresh", defaultMessage: "Refresh", icon: GdsIcons.Refresh, feedback: { icon: GdsIcons.Refresh, color: "teal", messageId: "gds.feedback.refreshed" } },
  trendingUp: { id: "gds.action.trendingUp", defaultMessage: "Trending Up", icon: GdsIcons.TrendingUp, feedback: { icon: GdsIcons.TrendingUp, color: "teal", messageId: "gds.feedback.done" } },
  trendingDown: { id: "gds.action.trendingDown", defaultMessage: "Trending Down", icon: GdsIcons.TrendingDown, feedback: { icon: GdsIcons.TrendingDown, color: "teal", messageId: "gds.feedback.done" } },
  currency: { id: "gds.action.currency", defaultMessage: "Currency", icon: GdsIcons.Currency, feedback: { icon: GdsIcons.Currency, color: "teal", messageId: "gds.feedback.done" } },
  grid: { id: "gds.action.grid", defaultMessage: "Grid", icon: GdsIcons.Grid, feedback: { icon: GdsIcons.Grid, color: "teal", messageId: "gds.feedback.done" } },
  list: { id: "gds.action.list", defaultMessage: "List", icon: GdsIcons.List, feedback: { icon: GdsIcons.List, color: "teal", messageId: "gds.feedback.done" } },
  logout: { id: "gds.action.logout", defaultMessage: "Logout", icon: GdsIcons.Logout, feedback: { icon: GdsIcons.Logout, color: "teal", messageId: "gds.feedback.loggedOut" } },
  notifications: { id: "gds.action.notifications", defaultMessage: "Notifications", icon: GdsIcons.Notifications, feedback: { icon: GdsIcons.Notifications, color: "teal", messageId: "gds.feedback.done" } },
  back: { id: "gds.action.back", defaultMessage: "Back", icon: GdsIcons.Back, feedback: { icon: GdsIcons.Back, color: "teal", messageId: "gds.feedback.done" } },
  eye: { id: "gds.action.eye", defaultMessage: "View", icon: GdsIcons.Eye, feedback: { icon: GdsIcons.Eye, color: "teal", messageId: "gds.feedback.done" } },
  eyeOff: { id: "gds.action.eyeOff", defaultMessage: "Hide", icon: GdsIcons.EyeOff, feedback: { icon: GdsIcons.EyeOff, color: "teal", messageId: "gds.feedback.done" } },
  help: { id: "gds.action.help", defaultMessage: "Help", icon: GdsIcons.Help, feedback: { icon: GdsIcons.Help, color: "teal", messageId: "gds.feedback.done" } },
  filter: { id: "gds.action.filter", defaultMessage: "Filter", icon: GdsIcons.Filter, feedback: { icon: GdsIcons.Filter, color: "teal", messageId: "gds.feedback.filtered" } },
  sort: { id: "gds.action.sort", defaultMessage: "Sort", icon: GdsIcons.Sort, feedback: { icon: GdsIcons.Sort, color: "teal", messageId: "gds.feedback.sorted" } },
  // Audit-driven additions
  export: { id: "gds.action.export", defaultMessage: "Export", icon: GdsIcons.Export, feedback: { icon: GdsIcons.Export, color: "teal", messageId: "gds.feedback.exported" } },
  import: { id: "gds.action.import", defaultMessage: "Import", icon: GdsIcons.Import, feedback: { icon: GdsIcons.Import, color: "teal", messageId: "gds.feedback.imported" } },
  preview: { id: "gds.action.preview", defaultMessage: "Preview", icon: GdsIcons.Preview, feedback: { icon: GdsIcons.Preview, color: "teal", messageId: "gds.feedback.previewed" } },
  clone: { id: "gds.action.clone", defaultMessage: "Clone", icon: GdsIcons.Clone, feedback: { icon: GdsIcons.Clone, color: "teal", messageId: "gds.feedback.cloned" } },
  restore: { id: "gds.action.restore", defaultMessage: "Restore", icon: GdsIcons.Restore, feedback: { icon: GdsIcons.Restore, color: "teal", messageId: "gds.feedback.restored" } },
  toggle: { id: "gds.action.toggle", defaultMessage: "Toggle", icon: GdsIcons.Toggle, feedback: { icon: GdsIcons.Toggle, color: "teal", messageId: "gds.feedback.toggled" } },
  search: { id: "gds.action.search", defaultMessage: "Search", icon: GdsIcons.Search, feedback: { icon: GdsIcons.Search, color: "teal", messageId: "gds.feedback.searched" } },
  submit: { id: "gds.action.submit", defaultMessage: "Submit", icon: GdsIcons.Submit, feedback: { icon: GdsIcons.Submit, color: "teal", messageId: "gds.feedback.submitted" } },
  reset: { id: "gds.action.reset", defaultMessage: "Reset", icon: GdsIcons.Reset, feedback: { icon: GdsIcons.Reset, color: "red", messageId: "gds.feedback.reset" } },
  login: { id: "gds.action.login", defaultMessage: "Login", icon: GdsIcons.Login, feedback: { icon: GdsIcons.Login, color: "teal", messageId: "gds.feedback.loggedIn" } },
  register: { id: "gds.action.register", defaultMessage: "Register", icon: GdsIcons.Register, feedback: { icon: GdsIcons.Register, color: "teal", messageId: "gds.feedback.registered" } },
  verify: { id: "gds.action.verify", defaultMessage: "Verify", icon: GdsIcons.Verify, feedback: { icon: GdsIcons.Verify, color: "teal", messageId: "gds.feedback.verified" } },
  launch: { id: "gds.action.launch", defaultMessage: "Launch", icon: GdsIcons.Launch, feedback: { icon: GdsIcons.Launch, color: "purple", messageId: "gds.feedback.launched" } },
  draft: { id: "gds.action.draft", defaultMessage: "Draft", icon: GdsIcons.Draft, feedback: { icon: GdsIcons.Draft, color: "teal", messageId: "gds.feedback.drafted" } },
  refer: { id: "gds.action.refer", defaultMessage: "Refer", icon: GdsIcons.Refer, feedback: { icon: GdsIcons.Refer, color: "teal", messageId: "gds.feedback.referred" } },
  evidence: { id: "gds.action.evidence", defaultMessage: "Evidence", icon: GdsIcons.Evidence, feedback: { icon: GdsIcons.Evidence, color: "teal", messageId: "gds.feedback.added" } }
};

// src/MetricCard.tsx
import { Badge as Badge2, Card, Group, Stack as Stack2, Text as Text2, ThemeIcon, Title as Title2 } from "@mantine/core";
import { jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
var trendColors = {
  positive: "teal",
  negative: "red",
  neutral: "gray"
};
function MetricCard({ label, value, description, trend, icon, footer }) {
  return /* @__PURE__ */ jsx3(Card, { withBorder: true, radius: "lg", padding: "lg", children: /* @__PURE__ */ jsxs2(Stack2, { gap: "md", children: [
    /* @__PURE__ */ jsxs2(Group, { justify: "space-between", align: "flex-start", wrap: "nowrap", children: [
      /* @__PURE__ */ jsxs2(Stack2, { gap: 4, children: [
        /* @__PURE__ */ jsx3(Text2, { size: "sm", c: "dimmed", fw: 600, children: label }),
        /* @__PURE__ */ jsx3(Title2, { order: 3, children: value })
      ] }),
      icon ? /* @__PURE__ */ jsx3(ThemeIcon, { variant: "light", size: "xl", radius: "xl", "aria-hidden": true, children: icon }) : null
    ] }),
    description || trend ? /* @__PURE__ */ jsxs2(Group, { justify: "space-between", align: "center", gap: "sm", children: [
      description ? /* @__PURE__ */ jsx3(Text2, { size: "sm", c: "dimmed", flex: 1, children: description }) : /* @__PURE__ */ jsx3("span", {}),
      trend ? /* @__PURE__ */ jsx3(Badge2, { color: trendColors[trend.tone ?? "neutral"], variant: "light", children: trend.label }) : null
    ] }) : null,
    footer
  ] }) });
}

// src/ProgressCard.tsx
import { Card as Card2, Group as Group2, Progress, Stack as Stack3, Text as Text3, Title as Title3 } from "@mantine/core";
import { jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
function ProgressCard({
  label,
  value,
  progress,
  progressLabel,
  description,
  action
}) {
  return /* @__PURE__ */ jsx4(Card2, { withBorder: true, radius: "lg", padding: "lg", children: /* @__PURE__ */ jsxs3(Stack3, { gap: "md", children: [
    /* @__PURE__ */ jsxs3(Group2, { justify: "space-between", align: "flex-start", children: [
      /* @__PURE__ */ jsxs3(Stack3, { gap: 4, children: [
        /* @__PURE__ */ jsx4(Text3, { size: "sm", c: "dimmed", fw: 600, children: label }),
        /* @__PURE__ */ jsx4(Title3, { order: 3, children: value })
      ] }),
      action
    ] }),
    description ? /* @__PURE__ */ jsx4(Text3, { size: "sm", c: "dimmed", children: description }) : null,
    /* @__PURE__ */ jsxs3(Stack3, { gap: 6, children: [
      /* @__PURE__ */ jsxs3(Group2, { justify: "space-between", gap: "sm", children: [
        /* @__PURE__ */ jsx4(Text3, { size: "sm", fw: 500, children: progressLabel ?? "Progress" }),
        /* @__PURE__ */ jsxs3(Text3, { size: "sm", c: "dimmed", children: [
          Math.round(progress),
          "%"
        ] })
      ] }),
      /* @__PURE__ */ jsx4(Progress, { value: progress, radius: "xl", size: "md" })
    ] })
  ] }) });
}

// src/ProductCard.tsx
import { Badge as Badge3, Card as Card3, Group as Group3, Menu, Stack as Stack4, Text as Text4, ThemeIcon as ThemeIcon2, Title as Title4, ActionIcon } from "@mantine/core";
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
function ProductCard({
  title,
  description,
  media,
  icon,
  status,
  metadata = [],
  primaryAction,
  secondaryActions = [],
  footer
}) {
  const MoreIcon = GdsIcons.Menu;
  return /* @__PURE__ */ jsx5(Card3, { withBorder: true, radius: "lg", padding: "lg", children: /* @__PURE__ */ jsxs4(Stack4, { gap: "md", children: [
    media,
    /* @__PURE__ */ jsxs4(Group3, { justify: "space-between", align: "flex-start", wrap: "nowrap", children: [
      /* @__PURE__ */ jsxs4(Group3, { align: "flex-start", gap: "sm", wrap: "nowrap", children: [
        icon ? /* @__PURE__ */ jsx5(ThemeIcon2, { variant: "light", size: "xl", radius: "xl", "aria-hidden": true, children: icon }) : null,
        /* @__PURE__ */ jsxs4(Stack4, { gap: 4, children: [
          /* @__PURE__ */ jsx5(Title4, { order: 4, children: title }),
          description ? /* @__PURE__ */ jsx5(Text4, { size: "sm", c: "dimmed", lineClamp: 3, children: description }) : null
        ] })
      ] }),
      /* @__PURE__ */ jsxs4(Group3, { gap: "xs", align: "center", wrap: "nowrap", children: [
        typeof status === "string" ? /* @__PURE__ */ jsx5(Badge3, { variant: "light", children: status }) : status,
        secondaryActions.length ? /* @__PURE__ */ jsxs4(Menu, { position: "bottom-end", withinPortal: true, children: [
          /* @__PURE__ */ jsx5(Menu.Target, { children: /* @__PURE__ */ jsx5(ActionIcon, { variant: "subtle", "aria-label": "More actions", children: /* @__PURE__ */ jsx5(MoreIcon, { size: "1rem" }) }) }),
          /* @__PURE__ */ jsx5(Menu.Dropdown, { children: secondaryActions.map(
            (action) => action.href ? /* @__PURE__ */ jsx5(Menu.Item, { component: "a", href: action.href, color: action.color, children: action.label }, action.label) : /* @__PURE__ */ jsx5(Menu.Item, { onClick: action.onClick, color: action.color, children: action.label }, action.label)
          ) })
        ] }) : null
      ] })
    ] }),
    metadata.length ? /* @__PURE__ */ jsx5(Stack4, { gap: 6, children: metadata.map((item) => /* @__PURE__ */ jsxs4(Group3, { justify: "space-between", gap: "sm", children: [
      /* @__PURE__ */ jsx5(Text4, { size: "sm", c: "dimmed", children: item.label }),
      /* @__PURE__ */ jsx5(Text4, { size: "sm", fw: 500, ta: "right", children: item.value })
    ] }, item.label)) }) : null,
    primaryAction ? /* @__PURE__ */ jsx5(Group3, { justify: "space-between", children: primaryAction }) : null,
    footer
  ] }) });
}

// src/PublicProductCard.tsx
import { cloneElement, isValidElement } from "react";
import { AspectRatio, Badge as Badge4, Card as Card4, Group as Group4, Skeleton, Stack as Stack5, Text as Text5, ThemeIcon as ThemeIcon3, Title as Title5 } from "@mantine/core";
import { jsx as jsx6, jsxs as jsxs5 } from "react/jsx-runtime";
var stateConfig = {
  available: { label: "Available", color: "teal" },
  limited: { label: "Limited", color: "yellow" },
  "sold-out": { label: "Sold out", color: "red" },
  preorder: { label: "Preorder", color: "violet" }
};
function enhanceAction(action, disabled) {
  if (!isValidElement(action)) {
    return action;
  }
  return cloneElement(action, {
    disabled: disabled || Boolean(action.props.disabled),
    "aria-disabled": disabled || void 0
  });
}
function ImageFallback({ compact }) {
  return /* @__PURE__ */ jsx6(AspectRatio, { ratio: compact ? 16 / 9 : 4 / 3, children: /* @__PURE__ */ jsx6(
    ThemeIcon3,
    {
      size: "100%",
      radius: "md",
      variant: "light",
      color: "gray",
      "aria-label": "No product image available",
      children: /* @__PURE__ */ jsx6(GdsIcons.Gallery, { size: compact ? "1.5rem" : "2rem" })
    }
  ) });
}
function LoadingCard({ compact }) {
  return /* @__PURE__ */ jsx6(Card4, { withBorder: true, radius: "lg", padding: compact ? "md" : "lg", children: /* @__PURE__ */ jsxs5(Stack5, { gap: "md", children: [
    /* @__PURE__ */ jsx6(AspectRatio, { ratio: compact ? 16 / 9 : 4 / 3, children: /* @__PURE__ */ jsx6(Skeleton, { radius: "md" }) }),
    /* @__PURE__ */ jsxs5(Stack5, { gap: "xs", children: [
      /* @__PURE__ */ jsx6(Skeleton, { height: 20, radius: "sm", width: "70%" }),
      /* @__PURE__ */ jsx6(Skeleton, { height: 14, radius: "sm", width: "100%" }),
      /* @__PURE__ */ jsx6(Skeleton, { height: 14, radius: "sm", width: "85%" })
    ] }),
    /* @__PURE__ */ jsxs5(Group4, { justify: "space-between", align: "center", children: [
      /* @__PURE__ */ jsx6(Skeleton, { height: 18, radius: "sm", width: 72 }),
      /* @__PURE__ */ jsx6(Skeleton, { height: 36, radius: "md", width: 120 })
    ] })
  ] }) });
}
function PublicProductCard({
  title,
  description,
  image,
  price,
  helperText,
  state = "available",
  primaryAction,
  secondaryAction,
  metadata = [],
  compact = false,
  loading = false,
  disabled = false
}) {
  if (loading) {
    return /* @__PURE__ */ jsx6(LoadingCard, { compact });
  }
  const isActionDisabled = disabled || state === "sold-out";
  const resolvedPrimaryAction = enhanceAction(primaryAction, isActionDisabled);
  const resolvedSecondaryAction = enhanceAction(secondaryAction, disabled);
  const stateBadge = stateConfig[state];
  return /* @__PURE__ */ jsx6(Card4, { withBorder: true, radius: "lg", padding: compact ? "md" : "lg", children: /* @__PURE__ */ jsxs5(Stack5, { gap: compact ? "sm" : "md", children: [
    image ?? /* @__PURE__ */ jsx6(ImageFallback, { compact }),
    /* @__PURE__ */ jsxs5(Group4, { justify: "space-between", align: "flex-start", wrap: "nowrap", gap: "sm", children: [
      /* @__PURE__ */ jsxs5(Stack5, { gap: 4, style: { minWidth: 0, flex: 1 }, children: [
        /* @__PURE__ */ jsx6(Title5, { order: compact ? 5 : 4, lineClamp: 2, children: title }),
        description ? /* @__PURE__ */ jsx6(Text5, { size: "sm", c: "dimmed", lineClamp: compact ? 2 : 3, children: description }) : null
      ] }),
      /* @__PURE__ */ jsx6(Badge4, { variant: "light", color: stateBadge.color, children: stateBadge.label })
    ] }),
    price || helperText ? /* @__PURE__ */ jsxs5(Group4, { justify: "space-between", align: "flex-end", gap: "sm", wrap: "nowrap", children: [
      /* @__PURE__ */ jsxs5(Stack5, { gap: 2, style: { minWidth: 0, flex: 1 }, children: [
        price ? /* @__PURE__ */ jsx6(Text5, { fw: 700, size: compact ? "md" : "lg", children: price }) : null,
        helperText ? /* @__PURE__ */ jsx6(Text5, { size: "xs", c: "dimmed", children: helperText }) : null
      ] }),
      resolvedPrimaryAction
    ] }) : resolvedPrimaryAction ? /* @__PURE__ */ jsx6(Group4, { justify: "flex-end", children: resolvedPrimaryAction }) : null,
    metadata.length ? /* @__PURE__ */ jsx6(Stack5, { gap: 6, children: metadata.map((item) => /* @__PURE__ */ jsxs5(Group4, { justify: "space-between", gap: "sm", children: [
      /* @__PURE__ */ jsx6(Text5, { size: "sm", c: "dimmed", children: item.label }),
      /* @__PURE__ */ jsx6(Text5, { size: "sm", fw: 500, ta: "right", children: item.value })
    ] }, item.label)) }) : null,
    resolvedSecondaryAction ? /* @__PURE__ */ jsx6(Group4, { justify: "flex-end", children: resolvedSecondaryAction }) : null
  ] }) });
}

// src/AccentPanel.tsx
import { Badge as Badge5, Box as Box2, Group as Group5, Paper, Stack as Stack6, Text as Text6, Title as Title6 } from "@mantine/core";
import { jsx as jsx7, jsxs as jsxs6 } from "react/jsx-runtime";
var toneStyles = {
  gray: {
    bg: "light-dark(var(--mantine-color-gray-0), color-mix(in srgb, var(--mantine-color-gray-7) 88%, black))",
    border: "light-dark(var(--mantine-color-gray-2), color-mix(in srgb, var(--mantine-color-gray-4) 70%, transparent))",
    color: "light-dark(var(--mantine-color-gray-9), var(--mantine-color-gray-0))"
  },
  violet: {
    bg: "light-dark(var(--mantine-color-violet-0), color-mix(in srgb, var(--mantine-color-violet-9) 70%, black))",
    border: "light-dark(var(--mantine-color-violet-2), color-mix(in srgb, var(--mantine-color-violet-4) 75%, transparent))",
    color: "light-dark(var(--mantine-color-violet-9), var(--mantine-color-violet-0))"
  },
  green: {
    bg: "light-dark(var(--mantine-color-green-0), color-mix(in srgb, var(--mantine-color-green-9) 72%, black))",
    border: "light-dark(var(--mantine-color-green-2), color-mix(in srgb, var(--mantine-color-green-4) 78%, transparent))",
    color: "light-dark(var(--mantine-color-green-9), var(--mantine-color-green-0))"
  },
  red: {
    bg: "light-dark(var(--mantine-color-red-0), color-mix(in srgb, var(--mantine-color-red-9) 72%, black))",
    border: "light-dark(var(--mantine-color-red-2), color-mix(in srgb, var(--mantine-color-red-4) 78%, transparent))",
    color: "light-dark(var(--mantine-color-red-9), var(--mantine-color-red-0))"
  },
  amber: {
    bg: "light-dark(var(--mantine-color-yellow-0), color-mix(in srgb, var(--mantine-color-yellow-8) 78%, black))",
    border: "light-dark(var(--mantine-color-yellow-3), color-mix(in srgb, var(--mantine-color-yellow-5) 70%, transparent))",
    color: "light-dark(var(--mantine-color-yellow-9), var(--mantine-color-yellow-0))"
  },
  blue: {
    bg: "light-dark(var(--mantine-color-blue-0), color-mix(in srgb, var(--mantine-color-blue-9) 74%, black))",
    border: "light-dark(var(--mantine-color-blue-2), color-mix(in srgb, var(--mantine-color-blue-4) 75%, transparent))",
    color: "light-dark(var(--mantine-color-blue-9), var(--mantine-color-blue-0))"
  }
};
function resolveAccentPanelStyles(tone = "violet", variant = "subtle") {
  const token = toneStyles[tone];
  if (variant === "soft-outline") {
    return {
      backgroundColor: "light-dark(var(--mantine-color-body), color-mix(in srgb, var(--mantine-color-dark-7) 92%, black))",
      border: `1px solid ${token.border}`,
      color: token.color
    };
  }
  return {
    backgroundColor: token.bg,
    border: `1px solid ${token.border}`,
    color: token.color
  };
}
function AccentPanel({
  tone = "violet",
  variant = "subtle",
  title,
  badge,
  children
}) {
  const styles = resolveAccentPanelStyles(tone, variant);
  return /* @__PURE__ */ jsx7(Paper, { withBorder: true, radius: "lg", p: "lg", style: styles, children: /* @__PURE__ */ jsxs6(Stack6, { gap: "sm", children: [
    title || badge ? /* @__PURE__ */ jsxs6(Group5, { justify: "space-between", align: "flex-start", gap: "sm", wrap: "wrap", children: [
      title ? /* @__PURE__ */ jsx7(Title6, { order: 4, c: "inherit", children: title }) : /* @__PURE__ */ jsx7(Box2, {}),
      badge ? typeof badge === "string" ? /* @__PURE__ */ jsx7(Badge5, { color: tone === "amber" ? "yellow" : tone, variant: "filled", children: badge }) : badge : null
    ] }) : null,
    typeof children === "string" ? /* @__PURE__ */ jsx7(Text6, { c: "inherit", children }) : /* @__PURE__ */ jsx7(Box2, { c: "inherit", children })
  ] }) });
}

// src/StateBlock.tsx
import { Loader, Stack as Stack7, Text as Text7, ThemeIcon as ThemeIcon4, Title as Title7 } from "@mantine/core";
import { jsx as jsx8, jsxs as jsxs7 } from "react/jsx-runtime";
var variantConfig = {
  loading: { color: "violet", icon: /* @__PURE__ */ jsx8(Loader, { size: "sm" }) },
  empty: { color: "gray", icon: /* @__PURE__ */ jsx8(GdsIcons.Inbox, { size: "1.1rem" }) },
  error: { color: "red", icon: /* @__PURE__ */ jsx8(GdsIcons.Danger, { size: "1.1rem" }) },
  permission: { color: "orange", icon: /* @__PURE__ */ jsx8(GdsIcons.Verify, { size: "1.1rem" }) },
  disabled: { color: "gray", icon: /* @__PURE__ */ jsx8(GdsIcons.Toggle, { size: "1.1rem" }) },
  success: { color: "teal", icon: /* @__PURE__ */ jsx8(GdsIcons.Success, { size: "1.1rem" }) },
  info: { color: "blue", icon: /* @__PURE__ */ jsx8(GdsIcons.Info, { size: "1.1rem" }) },
  "not-enough-data": { color: "yellow", icon: /* @__PURE__ */ jsx8(GdsIcons.Analytics, { size: "1.1rem" }) }
};
function StateBlock({
  variant,
  title,
  description,
  action,
  icon,
  compact = false
}) {
  const config = variantConfig[variant];
  return /* @__PURE__ */ jsxs7(
    Stack7,
    {
      align: compact ? "flex-start" : "center",
      justify: "center",
      gap: "md",
      py: compact ? "md" : "xl",
      ta: compact ? "left" : "center",
      children: [
        /* @__PURE__ */ jsx8(ThemeIcon4, { variant: "light", color: config.color, size: compact ? "lg" : "xl", radius: "xl", children: icon ?? config.icon }),
        /* @__PURE__ */ jsxs7(Stack7, { gap: 6, align: compact ? "flex-start" : "center", children: [
          /* @__PURE__ */ jsx8(Title7, { order: compact ? 4 : 3, children: title }),
          description ? /* @__PURE__ */ jsx8(Text7, { c: "dimmed", maw: compact ? void 0 : 480, children: description }) : null
        ] }),
        action
      ]
    }
  );
}

// src/DataToolbar.tsx
import { Badge as Badge6, Group as Group6, Stack as Stack8 } from "@mantine/core";
import { jsx as jsx9, jsxs as jsxs8 } from "react/jsx-runtime";
function DataToolbar({
  searchSlot,
  filterSlot,
  sortSlot,
  resetAction,
  createAction,
  activeFilters = []
}) {
  return /* @__PURE__ */ jsxs8(Stack8, { gap: "sm", children: [
    /* @__PURE__ */ jsxs8(Group6, { justify: "space-between", align: "flex-start", gap: "sm", children: [
      /* @__PURE__ */ jsxs8(Group6, { flex: 1, align: "flex-start", gap: "sm", children: [
        searchSlot,
        filterSlot,
        sortSlot
      ] }),
      /* @__PURE__ */ jsxs8(Group6, { gap: "sm", children: [
        resetAction,
        createAction
      ] })
    ] }),
    activeFilters.length ? /* @__PURE__ */ jsx9(Group6, { gap: "xs", children: activeFilters.map((filter) => /* @__PURE__ */ jsx9(
      Badge6,
      {
        variant: "light",
        rightSection: filter.onRemove ? "\xD7" : void 0,
        style: filter.onRemove ? { cursor: "pointer" } : void 0,
        onClick: filter.onRemove,
        children: filter.label
      },
      filter.label
    )) }) : null
  ] });
}

// src/PublicNav.tsx
import { Anchor, Group as Group7 } from "@mantine/core";
import { jsx as jsx10 } from "react/jsx-runtime";
function PublicNav({ items, activeId, renderLink }) {
  return /* @__PURE__ */ jsx10(Group7, { component: "nav", "aria-label": "Primary", gap: "lg", wrap: "nowrap", children: items.map((item) => {
    const active = item.id === activeId;
    if (renderLink) {
      return /* @__PURE__ */ jsx10("span", { children: renderLink(item, active) }, item.id);
    }
    return /* @__PURE__ */ jsx10(
      Anchor,
      {
        href: item.href,
        "aria-current": active ? "page" : void 0,
        c: active ? "var(--mantine-color-text)" : "dimmed",
        fw: active ? 700 : 500,
        underline: "never",
        target: item.external ? "_blank" : void 0,
        rel: item.external ? "noreferrer" : void 0,
        children: item.label
      },
      item.id
    );
  }) });
}

// src/PublicShell.tsx
import { AppShell, Box as Box3, Burger, Container, Group as Group8, Stack as Stack9, Text as Text8 } from "@mantine/core";
import { jsx as jsx11, jsxs as jsxs9 } from "react/jsx-runtime";
function PublicShell({
  brand,
  navItems,
  activeNavId,
  navigation,
  actions,
  footer,
  mobileNavigation,
  children,
  headerBordered = true,
  compact = false,
  maxContentWidth
}) {
  const resolvedNavigation = navigation ?? (navItems ? /* @__PURE__ */ jsx11(PublicNav, { items: navItems, activeId: activeNavId }) : null);
  const containerSize = maxContentWidth ?? (compact ? "md" : "lg");
  return /* @__PURE__ */ jsxs9(AppShell, { header: { height: 72 }, footer: mobileNavigation ? { height: 68 } : void 0, padding: 0, children: [
    /* @__PURE__ */ jsx11(AppShell.Header, { withBorder: headerBordered, children: /* @__PURE__ */ jsx11(Container, { size: containerSize, h: "100%", children: /* @__PURE__ */ jsxs9(Group8, { h: "100%", justify: "space-between", wrap: "nowrap", children: [
      /* @__PURE__ */ jsxs9(Group8, { wrap: "nowrap", gap: "sm", children: [
        mobileNavigation ? /* @__PURE__ */ jsx11(Burger, { hiddenFrom: "sm", disabled: true, opened: false, "aria-hidden": true }) : null,
        /* @__PURE__ */ jsx11(Box3, { children: brand })
      ] }),
      /* @__PURE__ */ jsx11(Group8, { visibleFrom: "sm", gap: "lg", children: resolvedNavigation }),
      /* @__PURE__ */ jsx11(Group8, { gap: "sm", children: actions })
    ] }) }) }),
    mobileNavigation ? /* @__PURE__ */ jsx11(AppShell.Footer, { withBorder: true, children: /* @__PURE__ */ jsx11(Container, { size: containerSize, h: "100%", children: /* @__PURE__ */ jsx11(Group8, { h: "100%", justify: "space-around", wrap: "nowrap", children: mobileNavigation }) }) }) : null,
    /* @__PURE__ */ jsxs9(AppShell.Main, { children: [
      /* @__PURE__ */ jsx11(Container, { size: containerSize, py: "xl", children: /* @__PURE__ */ jsx11(Stack9, { gap: "xl", children }) }),
      footer ? /* @__PURE__ */ jsx11(Box3, { component: typeof footer === "string" ? "footer" : "div", py: "xl", children: /* @__PURE__ */ jsx11(Container, { size: containerSize, children: typeof footer === "string" ? /* @__PURE__ */ jsx11(Text8, { size: "sm", c: "dimmed", children: footer }) : footer }) }) : null
    ] })
  ] });
}

// src/PublicSiteFooter.tsx
import { Group as Group9, Stack as Stack10, Text as Text9 } from "@mantine/core";
import { jsx as jsx12, jsxs as jsxs10 } from "react/jsx-runtime";
function PublicSiteFooter({ children, meta }) {
  return /* @__PURE__ */ jsxs10(Stack10, { component: "footer", gap: "xs", children: [
    children ? /* @__PURE__ */ jsx12(Text9, { size: "sm", children }) : null,
    meta ? /* @__PURE__ */ jsx12(Group9, { gap: "sm", children: /* @__PURE__ */ jsx12(Text9, { size: "xs", c: "dimmed", children: meta }) }) : null
  ] });
}

// src/PublicBrandFooter.tsx
import { Box as Box4, Divider, Grid, Group as Group10, Paper as Paper2, Stack as Stack11, Text as Text10, Title as Title8 } from "@mantine/core";
import { Fragment, jsx as jsx13, jsxs as jsxs11 } from "react/jsx-runtime";
function PublicBrandFooter({
  media,
  brandTitle,
  description,
  actions,
  secondary,
  legal,
  compact = false
}) {
  return /* @__PURE__ */ jsx13(Paper2, { component: "footer", withBorder: true, radius: "xl", p: compact ? "lg" : "xl", children: /* @__PURE__ */ jsxs11(Stack11, { gap: "lg", children: [
    /* @__PURE__ */ jsxs11(Grid, { gutter: compact ? "lg" : "xl", align: "flex-start", children: [
      media ? /* @__PURE__ */ jsx13(Grid.Col, { span: { base: 12, md: 4 }, children: /* @__PURE__ */ jsx13(Box4, { children: media }) }) : null,
      /* @__PURE__ */ jsx13(Grid.Col, { span: { base: 12, md: media ? 4 : 6 }, children: /* @__PURE__ */ jsxs11(Stack11, { gap: "sm", children: [
        brandTitle ? /* @__PURE__ */ jsx13(Title8, { order: 4, children: brandTitle }) : null,
        description ? /* @__PURE__ */ jsx13(Text10, { c: "dimmed", children: description }) : null,
        actions ? /* @__PURE__ */ jsx13(Box4, { children: actions }) : null
      ] }) }),
      secondary ? /* @__PURE__ */ jsx13(Grid.Col, { span: { base: 12, md: media ? 4 : 6 }, children: /* @__PURE__ */ jsx13(Stack11, { gap: "sm", children: secondary }) }) : null
    ] }),
    legal ? /* @__PURE__ */ jsxs11(Fragment, { children: [
      /* @__PURE__ */ jsx13(Divider, {}),
      /* @__PURE__ */ jsx13(Group10, { justify: "space-between", gap: "sm", wrap: "wrap", children: typeof legal === "string" ? /* @__PURE__ */ jsx13(Text10, { size: "sm", c: "dimmed", children: legal }) : legal })
    ] }) : null
  ] }) });
}

// src/AuthShell.tsx
import { Box as Box5, Card as Card5, Container as Container2, Group as Group11, Stack as Stack12, Text as Text11, Title as Title9 } from "@mantine/core";
import { jsx as jsx14, jsxs as jsxs12 } from "react/jsx-runtime";
function AuthShell({ title, description, brand, footer, helper, children }) {
  return /* @__PURE__ */ jsx14(Box5, { py: { base: "xl", md: "4rem" }, children: /* @__PURE__ */ jsx14(Container2, { size: "xs", children: /* @__PURE__ */ jsxs12(Stack12, { gap: "xl", children: [
    brand ? /* @__PURE__ */ jsx14(Group11, { justify: "center", children: brand }) : null,
    /* @__PURE__ */ jsx14(Card5, { withBorder: true, radius: "lg", padding: "xl", children: /* @__PURE__ */ jsxs12(Stack12, { gap: "lg", children: [
      /* @__PURE__ */ jsxs12(Stack12, { gap: "xs", ta: "center", children: [
        /* @__PURE__ */ jsx14(Title9, { order: 2, children: title }),
        description ? /* @__PURE__ */ jsx14(Text11, { c: "dimmed", size: "sm", children: description }) : null
      ] }),
      children,
      helper ? /* @__PURE__ */ jsx14(Text11, { size: "sm", c: "dimmed", ta: "center", children: helper }) : null
    ] }) }),
    footer ? /* @__PURE__ */ jsx14(Text11, { size: "sm", c: "dimmed", ta: "center", children: footer }) : null
  ] }) }) });
}

// src/ArticleShell.tsx
import { Container as Container3, Group as Group12, Stack as Stack13, Text as Text12, Title as Title10 } from "@mantine/core";
import { jsx as jsx15, jsxs as jsxs13 } from "react/jsx-runtime";
function ArticleShell({ eyebrow, title, lead, meta, sideRail, children }) {
  return /* @__PURE__ */ jsx15(Container3, { size: "lg", py: "xl", children: /* @__PURE__ */ jsxs13(Group12, { align: "flex-start", gap: "xl", wrap: "nowrap", children: [
    /* @__PURE__ */ jsxs13(Stack13, { gap: "lg", maw: 760, flex: 1, children: [
      /* @__PURE__ */ jsxs13(Stack13, { gap: "sm", children: [
        eyebrow ? /* @__PURE__ */ jsx15(Text12, { size: "sm", fw: 700, c: "dimmed", tt: "uppercase", children: eyebrow }) : null,
        /* @__PURE__ */ jsx15(Title10, { order: 1, children: title }),
        lead ? /* @__PURE__ */ jsx15(Text12, { size: "lg", c: "dimmed", children: lead }) : null,
        meta ? /* @__PURE__ */ jsx15(Group12, { gap: "md", children: meta }) : null
      ] }),
      /* @__PURE__ */ jsx15(Stack13, { gap: "md", children })
    ] }),
    sideRail ? /* @__PURE__ */ jsx15(Stack13, { visibleFrom: "lg", gap: "md", w: 240, children: sideRail }) : null
  ] }) });
}

// src/CtaButtonGroup.tsx
import { Group as Group13, Stack as Stack14 } from "@mantine/core";
import { jsx as jsx16, jsxs as jsxs14 } from "react/jsx-runtime";
function CtaButtonGroup({ primary, secondary, tertiary }) {
  return /* @__PURE__ */ jsxs14(Stack14, { gap: "sm", children: [
    /* @__PURE__ */ jsxs14(Group13, { gap: "sm", align: "stretch", children: [
      /* @__PURE__ */ jsx16("div", { children: primary }),
      secondary ? /* @__PURE__ */ jsx16("div", { children: secondary }) : null
    ] }),
    tertiary ? /* @__PURE__ */ jsx16("div", { children: tertiary }) : null
  ] });
}

// src/DocsPageShell.tsx
import { Anchor as Anchor2, Breadcrumbs, Container as Container4, Group as Group14, Stack as Stack15, Text as Text13, Title as Title11 } from "@mantine/core";
import { jsx as jsx17, jsxs as jsxs15 } from "react/jsx-runtime";
function DocsPageShell({
  breadcrumbs = [],
  title,
  lead,
  eyebrow,
  meta,
  sideRail,
  footerNext,
  children
}) {
  return /* @__PURE__ */ jsx17(Container4, { size: "lg", py: "xl", children: /* @__PURE__ */ jsxs15(Group14, { align: "flex-start", gap: "xl", wrap: "nowrap", children: [
    /* @__PURE__ */ jsxs15(Stack15, { component: "article", gap: "lg", maw: 760, flex: 1, children: [
      breadcrumbs.length ? /* @__PURE__ */ jsx17(Breadcrumbs, { children: breadcrumbs.map(
        (crumb) => crumb.href ? /* @__PURE__ */ jsx17(Anchor2, { href: crumb.href, children: crumb.label }, `${crumb.label}-${crumb.href}`) : /* @__PURE__ */ jsx17(Text13, { children: crumb.label }, crumb.label)
      ) }) : null,
      /* @__PURE__ */ jsxs15(Stack15, { gap: "sm", children: [
        eyebrow ? /* @__PURE__ */ jsx17(Text13, { size: "sm", fw: 700, c: "dimmed", children: eyebrow }) : null,
        /* @__PURE__ */ jsx17(Title11, { order: 1, children: title }),
        lead ? /* @__PURE__ */ jsx17(Text13, { size: "lg", c: "dimmed", children: lead }) : null,
        meta ? /* @__PURE__ */ jsx17(Group14, { gap: "md", children: meta }) : null
      ] }),
      /* @__PURE__ */ jsx17(Stack15, { gap: "md", children }),
      footerNext ? /* @__PURE__ */ jsx17(Anchor2, { href: footerNext.href, fw: 600, children: footerNext.label }) : null
    ] }),
    sideRail ? /* @__PURE__ */ jsx17(Stack15, { visibleFrom: "lg", gap: "md", w: 240, children: sideRail }) : null
  ] }) });
}

// src/EditorialHero.tsx
import { Anchor as Anchor3, AspectRatio as AspectRatio2, Box as Box6, Grid as Grid2, Group as Group15, Paper as Paper3, Skeleton as Skeleton2, Stack as Stack16, Text as Text14, ThemeIcon as ThemeIcon5, Title as Title12 } from "@mantine/core";
import { jsx as jsx18, jsxs as jsxs16 } from "react/jsx-runtime";
function resolveActionVariant(action, index, seenPrimary) {
  const requested = action.variant ?? (index === 0 ? "primary" : "secondary");
  if (requested === "primary" && !seenPrimary) {
    return { variant: "filled", seenPrimary: true };
  }
  if (requested === "subtle") {
    return { variant: "subtle", seenPrimary };
  }
  return { variant: "default", seenPrimary };
}
function HeroAction({ action, variant }) {
  const content = /* @__PURE__ */ jsx18(
    Anchor3,
    {
      href: action.href,
      onClick: action.onClick,
      "aria-disabled": action.disabled || action.loading || void 0,
      underline: "never",
      c: variant === "filled" ? "white" : void 0,
      style: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0.625rem 1rem",
        borderRadius: "var(--mantine-radius-md)",
        fontWeight: 600,
        minHeight: "2.5rem",
        border: variant === "default" ? "1px solid var(--mantine-color-default-border)" : "1px solid transparent",
        background: variant === "filled" ? "var(--mantine-color-violet-filled)" : variant === "subtle" ? "transparent" : "var(--mantine-color-default)",
        opacity: action.disabled ? 0.6 : 1,
        pointerEvents: action.disabled ? "none" : void 0
      },
      children: action.loading ? "Loading\u2026" : action.label
    }
  );
  if (!action.href) {
    return /* @__PURE__ */ jsx18(
      Box6,
      {
        component: "button",
        type: "button",
        onClick: action.onClick,
        disabled: action.disabled || action.loading,
        style: {
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0.625rem 1rem",
          borderRadius: "var(--mantine-radius-md)",
          fontWeight: 600,
          minHeight: "2.5rem",
          border: variant === "default" ? "1px solid var(--mantine-color-default-border)" : "1px solid transparent",
          background: variant === "filled" ? "var(--mantine-color-violet-filled)" : variant === "subtle" ? "transparent" : "var(--mantine-color-default)",
          color: variant === "filled" ? "white" : "inherit",
          cursor: action.disabled ? "not-allowed" : "pointer",
          opacity: action.disabled ? 0.6 : 1
        },
        children: action.loading ? "Loading\u2026" : action.label
      }
    );
  }
  return content;
}
function LoadingHero({ compact }) {
  return /* @__PURE__ */ jsx18(Paper3, { withBorder: true, radius: "xl", p: compact ? "lg" : "xl", children: /* @__PURE__ */ jsxs16(Grid2, { gutter: compact ? "lg" : "xl", align: "center", children: [
    /* @__PURE__ */ jsx18(Grid2.Col, { span: { base: 12, md: 6 }, children: /* @__PURE__ */ jsxs16(Stack16, { gap: "md", children: [
      /* @__PURE__ */ jsx18(Skeleton2, { height: 16, width: 96, radius: "xl" }),
      /* @__PURE__ */ jsx18(Skeleton2, { height: 48, width: "90%", radius: "md" }),
      /* @__PURE__ */ jsx18(Skeleton2, { height: 18, width: "100%", radius: "md" }),
      /* @__PURE__ */ jsx18(Skeleton2, { height: 18, width: "82%", radius: "md" }),
      /* @__PURE__ */ jsxs16(Group15, { children: [
        /* @__PURE__ */ jsx18(Skeleton2, { height: 40, width: 140, radius: "md" }),
        /* @__PURE__ */ jsx18(Skeleton2, { height: 40, width: 140, radius: "md" })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx18(Grid2.Col, { span: { base: 12, md: 6 }, children: /* @__PURE__ */ jsx18(AspectRatio2, { ratio: 16 / 11, children: /* @__PURE__ */ jsx18(Skeleton2, { radius: "lg" }) }) })
  ] }) });
}
function MediaFallback() {
  return /* @__PURE__ */ jsx18(AspectRatio2, { ratio: 16 / 11, children: /* @__PURE__ */ jsx18(
    ThemeIcon5,
    {
      size: "100%",
      radius: "lg",
      color: "gray",
      variant: "light",
      "aria-label": "Hero media is unavailable",
      children: /* @__PURE__ */ jsx18(GdsIcons.Gallery, { size: "2.5rem" })
    }
  ) });
}
function MediaFrame({
  media,
  mediaAlt,
  mediaFade
}) {
  return /* @__PURE__ */ jsxs16(
    Box6,
    {
      component: "figure",
      m: 0,
      style: {
        position: "relative",
        overflow: "hidden",
        borderRadius: "var(--mantine-radius-xl)",
        minHeight: "100%"
      },
      "aria-label": mediaAlt,
      children: [
        media ?? /* @__PURE__ */ jsx18(MediaFallback, {}),
        media && mediaFade !== "none" ? /* @__PURE__ */ jsx18(
          Box6,
          {
            "aria-hidden": true,
            style: {
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: mediaFade === "background-blend" ? "linear-gradient(135deg, light-dark(rgba(255,255,255,0), rgba(17,24,39,0.08)) 0%, light-dark(rgba(255,255,255,0.42), rgba(17,24,39,0.54)) 100%)" : "linear-gradient(90deg, light-dark(rgba(255,255,255,0.9), rgba(17,24,39,0.72)) 0%, rgba(255,255,255,0) 28%)"
            }
          }
        ) : null
      ]
    }
  );
}
function EditorialHero({
  eyebrow,
  title,
  description,
  actions = [],
  meta = [],
  media,
  mediaAlt,
  mediaPosition = "right",
  mediaFade = "soft-start",
  align = "start",
  compact = false,
  loading = false,
  error
}) {
  if (loading) {
    return /* @__PURE__ */ jsx18(LoadingHero, { compact });
  }
  const stackAlign = align === "center" ? "center" : "flex-start";
  const textAlign = align === "center" ? "center" : "left";
  let seenPrimary = false;
  const renderedActions = actions.slice(0, 3).map((action, index) => {
    const resolved = resolveActionVariant(action, index, seenPrimary);
    seenPrimary = resolved.seenPrimary;
    return /* @__PURE__ */ jsx18(HeroAction, { action, variant: resolved.variant }, `${action.label}-${index}`);
  });
  const textSlot = /* @__PURE__ */ jsxs16(Stack16, { gap: compact ? "md" : "lg", justify: "center", h: "100%", children: [
    /* @__PURE__ */ jsxs16(Stack16, { gap: "sm", align: stackAlign, children: [
      eyebrow ? /* @__PURE__ */ jsx18(Text14, { size: "sm", fw: 700, c: "dimmed", ta: textAlign, children: eyebrow }) : null,
      /* @__PURE__ */ jsx18(Title12, { order: 1, maw: 760, ta: textAlign, children: title }),
      description ? /* @__PURE__ */ jsx18(Text14, { size: compact ? "md" : "lg", c: "dimmed", maw: 720, ta: textAlign, children: description }) : null
    ] }),
    renderedActions.length ? /* @__PURE__ */ jsx18(
      CtaButtonGroup,
      {
        primary: renderedActions[0],
        secondary: renderedActions[1],
        tertiary: renderedActions[2]
      }
    ) : null,
    meta.length ? /* @__PURE__ */ jsx18(Group15, { gap: "sm", wrap: "wrap", "aria-label": "Supporting details", children: meta.map((item) => /* @__PURE__ */ jsxs16(
      Group15,
      {
        gap: 6,
        px: "sm",
        py: 6,
        style: {
          borderRadius: "var(--mantine-radius-xl)",
          background: "light-dark(var(--mantine-color-gray-0), color-mix(in srgb, var(--mantine-color-dark-7) 92%, black))"
        },
        children: [
          item.icon,
          /* @__PURE__ */ jsx18(Text14, { size: "sm", c: "dimmed", children: item.label })
        ]
      },
      item.id
    )) }) : null
  ] });
  const mediaSlot = error ? /* @__PURE__ */ jsx18(AccentPanel, { tone: "red", variant: "soft-outline", title: "Media unavailable", children: error }) : /* @__PURE__ */ jsx18(MediaFrame, { media, mediaAlt, mediaFade });
  const textCol = /* @__PURE__ */ jsx18(Grid2.Col, { span: { base: 12, md: 6 }, order: { base: 1, md: mediaPosition === "left" ? 2 : 1 }, children: textSlot });
  const mediaCol = /* @__PURE__ */ jsx18(Grid2.Col, { span: { base: 12, md: 6 }, order: { base: 2, md: mediaPosition === "left" ? 1 : 2 }, children: mediaSlot });
  return /* @__PURE__ */ jsx18(Paper3, { component: "section", withBorder: true, radius: "xl", p: compact ? "lg" : "xl", children: /* @__PURE__ */ jsxs16(Grid2, { gutter: compact ? "lg" : "xl", align: "center", children: [
    textCol,
    mediaCol
  ] }) });
}

// src/FeatureBand.tsx
import { Box as Box7, Group as Group16, Paper as Paper4, SimpleGrid, Skeleton as Skeleton3, Stack as Stack17, Text as Text15, ThemeIcon as ThemeIcon6, Title as Title13 } from "@mantine/core";
import { Fragment as Fragment2, jsx as jsx19, jsxs as jsxs17 } from "react/jsx-runtime";
function FeatureBandSkeleton({ columns = 3, bordered = true }) {
  return /* @__PURE__ */ jsx19(SimpleGrid, { cols: { base: 1, sm: Math.min(columns, 2), lg: columns }, spacing: "lg", children: Array.from({ length: columns }).map((_, index) => /* @__PURE__ */ jsx19(Paper4, { withBorder: bordered, radius: "lg", p: "lg", children: /* @__PURE__ */ jsxs17(Stack17, { gap: "md", children: [
    /* @__PURE__ */ jsx19(Skeleton3, { height: 42, width: 42, radius: "xl" }),
    /* @__PURE__ */ jsxs17(Stack17, { gap: "xs", children: [
      /* @__PURE__ */ jsx19(Skeleton3, { height: 20, width: "75%", radius: "md" }),
      /* @__PURE__ */ jsx19(Skeleton3, { height: 14, width: "100%", radius: "md" }),
      /* @__PURE__ */ jsx19(Skeleton3, { height: 14, width: "82%", radius: "md" })
    ] })
  ] }) }, index)) });
}
function FeatureBand({
  items,
  columns = 3,
  bordered = true,
  loading = false,
  emptyState
}) {
  if (loading) {
    return /* @__PURE__ */ jsx19(FeatureBandSkeleton, { columns, bordered });
  }
  if (!items.length) {
    return emptyState ? /* @__PURE__ */ jsx19(Fragment2, { children: emptyState }) : /* @__PURE__ */ jsx19(
      EmptyState,
      {
        title: "No supporting details available",
        description: "Add shared feature-band items when this public surface needs trust, service, or location context."
      }
    );
  }
  return /* @__PURE__ */ jsx19(Box7, { component: "section", "aria-label": "Supporting features", children: /* @__PURE__ */ jsx19(SimpleGrid, { cols: { base: 1, sm: Math.min(columns, 2), lg: columns }, spacing: "lg", children: items.map((item) => /* @__PURE__ */ jsx19(Paper4, { withBorder: bordered, radius: "lg", p: "lg", children: /* @__PURE__ */ jsxs17(Stack17, { gap: "md", children: [
    item.media ? item.media : item.icon ? /* @__PURE__ */ jsx19(Group16, { children: /* @__PURE__ */ jsx19(ThemeIcon6, { size: "xl", radius: "xl", variant: "light", color: "violet", children: item.icon }) }) : /* @__PURE__ */ jsx19(Group16, { children: /* @__PURE__ */ jsx19(ThemeIcon6, { size: "xl", radius: "xl", variant: "light", color: "gray", "aria-hidden": true, children: /* @__PURE__ */ jsx19(GdsIcons.Info, { size: "1.25rem" }) }) }),
    /* @__PURE__ */ jsxs17(Stack17, { gap: "xs", children: [
      /* @__PURE__ */ jsx19(Title13, { order: 4, children: item.title }),
      item.description ? /* @__PURE__ */ jsx19(Text15, { c: "dimmed", children: item.description }) : null,
      item.meta ? /* @__PURE__ */ jsx19(Text15, { size: "sm", c: "dimmed", children: item.meta }) : null
    ] })
  ] }) }, item.id)) }) });
}

// src/MediaCard.tsx
import { ActionIcon as ActionIcon2, Badge as Badge7, Card as Card6, Group as Group17, Stack as Stack18, Text as Text16, Title as Title14 } from "@mantine/core";
import { jsx as jsx20, jsxs as jsxs18 } from "react/jsx-runtime";
function MediaCard({ title, image, description, status, overlay, actions = [] }) {
  const EyeIcon = GdsIcons.Eye;
  return /* @__PURE__ */ jsxs18(Card6, { withBorder: true, radius: "lg", padding: "md", children: [
    /* @__PURE__ */ jsxs18(Card6.Section, { pos: "relative", children: [
      image,
      overlay ? /* @__PURE__ */ jsx20("div", { style: { position: "absolute", inset: 12, display: "flex", justifyContent: "flex-end", alignItems: "flex-start" }, children: overlay }) : null
    ] }),
    /* @__PURE__ */ jsxs18(Stack18, { gap: "sm", mt: "md", children: [
      /* @__PURE__ */ jsxs18(Group17, { justify: "space-between", align: "flex-start", children: [
        /* @__PURE__ */ jsxs18(Stack18, { gap: 4, children: [
          /* @__PURE__ */ jsx20(Title14, { order: 4, children: title }),
          description ? /* @__PURE__ */ jsx20(Text16, { size: "sm", c: "dimmed", lineClamp: 2, children: description }) : null
        ] }),
        status ? /* @__PURE__ */ jsx20(Badge7, { variant: "light", children: status }) : null
      ] }),
      actions.length ? /* @__PURE__ */ jsx20(Group17, { justify: "flex-end", gap: "xs", children: actions.map((action) => /* @__PURE__ */ jsx20(ActionIcon2, { variant: "light", "aria-label": action.label, onClick: action.onClick, children: /* @__PURE__ */ jsx20(EyeIcon, { size: "1rem" }) }, action.label)) }) : null
    ] })
  ] });
}

// src/AccessSummary.tsx
import { Badge as Badge8, Card as Card7, Group as Group18, Stack as Stack19, Text as Text17, Title as Title15 } from "@mantine/core";
import { jsx as jsx21, jsxs as jsxs19 } from "react/jsx-runtime";
function AccessSummary({ title, roles, scope, blocked = false, description }) {
  return /* @__PURE__ */ jsx21(Card7, { withBorder: true, radius: "lg", padding: "lg", children: /* @__PURE__ */ jsxs19(Stack19, { gap: "sm", children: [
    /* @__PURE__ */ jsxs19(Group18, { justify: "space-between", align: "center", children: [
      /* @__PURE__ */ jsx21(Title15, { order: 4, children: title }),
      /* @__PURE__ */ jsx21(Badge8, { color: blocked ? "red" : "teal", variant: "light", children: blocked ? "Blocked" : "Allowed" })
    ] }),
    /* @__PURE__ */ jsx21(Group18, { gap: "xs", children: roles.map((role) => /* @__PURE__ */ jsx21(Badge8, { variant: "outline", children: role }, role)) }),
    scope ? /* @__PURE__ */ jsxs19(Text17, { size: "sm", c: "dimmed", children: [
      "Scope: ",
      scope
    ] }) : null,
    description ? /* @__PURE__ */ jsx21(Text17, { size: "sm", children: description }) : null
  ] }) });
}

// src/FormField.tsx
import { Box as Box8, Stack as Stack20, Text as Text18 } from "@mantine/core";
import { jsx as jsx22, jsxs as jsxs20 } from "react/jsx-runtime";
function FormField({ label, description, error, children }) {
  return /* @__PURE__ */ jsx22(Box8, { component: "label", children: /* @__PURE__ */ jsxs20(Stack20, { gap: 4, children: [
    /* @__PURE__ */ jsx22(Text18, { size: "xs", fw: 600, c: "dimmed", children: label }),
    description ? /* @__PURE__ */ jsx22(Text18, { size: "xs", c: "dimmed", children: description }) : null,
    children,
    error ? /* @__PURE__ */ jsx22(Text18, { size: "xs", c: "red.7", children: error }) : null
  ] }) });
}

// src/PageHeader.tsx
import { Box as Box9, Group as Group19, Stack as Stack21, Text as Text19, Title as Title16 } from "@mantine/core";
import { jsx as jsx23, jsxs as jsxs21 } from "react/jsx-runtime";
function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  eyebrowVariant = "neutral"
}) {
  const eyebrowProps = eyebrowVariant === "ornamental" ? { tt: "uppercase", style: { letterSpacing: "0.12em" } } : {};
  return /* @__PURE__ */ jsxs21(Group19, { justify: "space-between", align: "flex-start", gap: "lg", wrap: "wrap", children: [
    /* @__PURE__ */ jsxs21(Stack21, { gap: "xs", children: [
      eyebrow && /* @__PURE__ */ jsx23(Text19, { size: "xs", fw: 700, c: "dimmed", ...eyebrowProps, children: eyebrow }),
      /* @__PURE__ */ jsx23(Title16, { order: 1, children: title }),
      description && /* @__PURE__ */ jsx23(Text19, { c: "dimmed", maw: 720, children: description })
    ] }),
    actions ? /* @__PURE__ */ jsx23(Box9, { children: actions }) : null
  ] });
}

// src/FilterDrawer.tsx
import { Drawer, Group as Group20, Stack as Stack22 } from "@mantine/core";
import { jsx as jsx24, jsxs as jsxs22 } from "react/jsx-runtime";
function FilterDrawer({
  opened,
  onClose,
  title,
  children,
  primaryAction,
  secondaryAction
}) {
  return /* @__PURE__ */ jsx24(Drawer, { opened, onClose, title, position: "right", size: "md", children: /* @__PURE__ */ jsxs22(Stack22, { gap: "md", children: [
    children,
    primaryAction || secondaryAction ? /* @__PURE__ */ jsxs22(Group20, { justify: "space-between", mt: "md", children: [
      secondaryAction ?? /* @__PURE__ */ jsx24("span", {}),
      primaryAction
    ] }) : null
  ] }) });
}

// src/PlaceholderPanel.tsx
import { Badge as Badge9, Card as Card8, Stack as Stack23, Text as Text20, Title as Title17 } from "@mantine/core";
import { Fragment as Fragment3, jsx as jsx25, jsxs as jsxs23 } from "react/jsx-runtime";
function PlaceholderPanel({
  title,
  description,
  badge,
  footer,
  children,
  mode
}) {
  if (mode === "live" && children) {
    return /* @__PURE__ */ jsx25(Fragment3, { children });
  }
  return /* @__PURE__ */ jsx25(Card8, { children: /* @__PURE__ */ jsxs23(Stack23, { gap: "md", children: [
    badge ? /* @__PURE__ */ jsx25(Badge9, { variant: "light", color: "blue", w: "fit-content", children: badge }) : null,
    /* @__PURE__ */ jsxs23(Stack23, { gap: "xs", children: [
      /* @__PURE__ */ jsx25(Title17, { order: 4, children: title }),
      /* @__PURE__ */ jsx25(Text20, { c: "dimmed", children: description })
    ] }),
    footer ? /* @__PURE__ */ jsx25(Text20, { size: "sm", children: footer }) : null,
    /* @__PURE__ */ jsx25(
      StateBlock,
      {
        variant: "not-enough-data",
        title: "Content is not live yet",
        description: "This surface is intentionally showing a governed placeholder until live data is available.",
        compact: true
      }
    )
  ] }) });
}

// src/SimpleDataTable.tsx
import { ScrollArea, Table } from "@mantine/core";
import { jsx as jsx26, jsxs as jsxs24 } from "react/jsx-runtime";
function SimpleDataTable({
  columns,
  rows,
  loading = false,
  error = null,
  emptyTitle = "No data available",
  emptyDescription = "There is no live data to show yet.",
  getRowKey
}) {
  if (error) {
    return /* @__PURE__ */ jsx26(StateBlock, { variant: "error", title: "Unable to load data", description: error, compact: true });
  }
  if (loading) {
    return /* @__PURE__ */ jsx26(StateBlock, { variant: "loading", title: "Loading data", description: "Please wait while the shared dataset is prepared.", compact: true });
  }
  if (!rows.length) {
    return /* @__PURE__ */ jsx26(StateBlock, { variant: "empty", title: emptyTitle, description: emptyDescription, compact: true });
  }
  return /* @__PURE__ */ jsx26(ScrollArea, { children: /* @__PURE__ */ jsxs24(Table, { striped: true, highlightOnHover: true, withTableBorder: true, withColumnBorders: true, children: [
    /* @__PURE__ */ jsx26(Table.Thead, { children: /* @__PURE__ */ jsx26(Table.Tr, { children: columns.map((column) => /* @__PURE__ */ jsx26(Table.Th, { children: column.header }, String(column.key))) }) }),
    /* @__PURE__ */ jsx26(Table.Tbody, { children: rows.map((row, index) => /* @__PURE__ */ jsx26(Table.Tr, { children: columns.map((column) => /* @__PURE__ */ jsx26(Table.Td, { children: column.render ? column.render(row) : String(row[column.key] ?? "") }, String(column.key))) }, getRowKey ? getRowKey(row, index) : index)) })
  ] }) });
}

// src/StatsSection.tsx
import { Stack as Stack24, Title as Title18 } from "@mantine/core";
import { jsx as jsx27, jsxs as jsxs25 } from "react/jsx-runtime";
function StatsSection({
  title,
  loading = false,
  error = null,
  belowThreshold = false,
  thresholdMessage,
  children,
  placeholder
}) {
  let content = children;
  if (error) {
    content = /* @__PURE__ */ jsx27(StateBlock, { variant: "error", title: "Unable to load statistics", description: error, compact: true });
  } else if (loading) {
    content = /* @__PURE__ */ jsx27(StateBlock, { variant: "loading", title: "Loading statistics", description: "This shared data surface is still synchronizing.", compact: true });
  } else if (belowThreshold) {
    content = /* @__PURE__ */ jsx27(
      StateBlock,
      {
        variant: "not-enough-data",
        title: "Not enough data yet",
        description: thresholdMessage ?? "This view is hidden until the reporting threshold is met.",
        compact: true
      }
    );
  } else if (placeholder) {
    content = /* @__PURE__ */ jsx27(PlaceholderPanel, { ...placeholder, mode: "placeholder" });
  }
  return /* @__PURE__ */ jsxs25(Stack24, { gap: "md", children: [
    /* @__PURE__ */ jsx27(Title18, { order: 3, children: title }),
    content
  ] });
}

// src/locales/ar.ts
var ar = {
  "gds.action.settings": "\u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A",
  "gds.action.analytics": "\u062A\u062D\u0644\u064A\u0644\u0627\u062A",
  "gds.action.dashboard": "\u0644\u0648\u062D\u0629 \u0627\u0644\u0642\u064A\u0627\u062F\u0629",
  "gds.action.play": "\u062A\u0634\u063A\u064A\u0644",
  "gds.action.start": "\u0628\u062F\u0621",
  "gds.action.users": "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u064A\u0646",
  "gds.action.add": "\u0625\u0636\u0627\u0641\u0629",
  "gds.action.edit": "\u062A\u0639\u062F\u064A\u0644",
  "gds.action.delete": "\u062D\u0630\u0641",
  "gds.action.save": "\u062D\u0641\u0638",
  "gds.action.cancel": "\u0625\u0644\u063A\u0627\u0621",
  "gds.action.confirm": "\u062A\u0623\u0643\u064A\u062F",
  "gds.action.close": "\u0625\u063A\u0644\u0627\u0642",
  "gds.action.language": "\u0627\u0644\u0644\u063A\u0629",
  "gds.action.theme": "\u0627\u0644\u0633\u0645\u0629",
  "gds.action.home": "\u0627\u0644\u0631\u0626\u064A\u0633\u064A\u0629",
  "gds.action.inbox": "\u0635\u0646\u062F\u0648\u0642 \u0627\u0644\u0648\u0627\u0631\u062F",
  "gds.action.calendar": "\u0627\u0644\u062A\u0642\u0648\u064A\u0645",
  "gds.action.gallery": "\u0627\u0644\u0645\u0639\u0631\u0636",
  "gds.action.history": "\u0627\u0644\u0633\u062C\u0644",
  "gds.action.profile": "\u0627\u0644\u0645\u0644\u0641 \u0627\u0644\u0634\u062E\u0635\u064A",
  "gds.action.send": "\u0625\u0631\u0633\u0627\u0644",
  "gds.action.reply": "\u0631\u062F",
  "gds.action.forward": "\u0625\u0639\u0627\u062F\u0629 \u062A\u0648\u062C\u064A\u0647",
  "gds.action.attach": "\u0625\u0631\u0641\u0627\u0642",
  "gds.action.upload": "\u0631\u0641\u0639",
  "gds.action.download": "\u062A\u0646\u0632\u064A\u0644",
  "gds.action.print": "\u0637\u0628\u0627\u0639\u0629",
  "gds.action.copy": "\u0646\u0633\u062E",
  "gds.action.duplicate": "\u062A\u0643\u0631\u0627\u0631",
  "gds.action.check": "\u062A\u062D\u062F\u064A\u062F",
  "gds.action.uncheck": "\u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062A\u062D\u062F\u064A\u062F",
  "gds.action.complete": "\u0627\u0643\u062A\u0645\u0627\u0644",
  "gds.action.clear": "\u0645\u0633\u062D",
  "gds.action.capture": "\u0627\u0644\u062A\u0642\u0627\u0637",
  "gds.action.record": "\u062A\u0633\u062C\u064A\u0644",
  "gds.action.flip": "\u0642\u0644\u0628",
  "gds.action.flash": "\u0641\u0644\u0627\u0634",
  "gds.action.course": "\u062F\u0648\u0631\u0629",
  "gds.action.lesson": "\u062F\u0631\u0633",
  "gds.action.certificate": "\u0634\u0647\u0627\u062F\u0629",
  "gds.action.student": "\u0637\u0627\u0644\u0628",
  "gds.action.class": "\u0641\u0635\u0644",
  "gds.action.grade": "\u062F\u0631\u062C\u0629",
  "gds.action.child": "\u0637\u0641\u0644",
  "gds.action.family": "\u0639\u0627\u0626\u0644\u0629",
  "gds.action.habit": "\u0639\u0627\u062F\u0629",
  "gds.action.goal": "\u0647\u062F\u0641",
  "gds.action.streak": "\u0633\u0644\u0633\u0644\u0629",
  "gds.action.reward": "\u0645\u0643\u0627\u0641\u0623\u0629",
  "gds.action.trophy": "\u0643\u0623\u0633",
  "gds.action.crown": "\u062A\u0627\u062C",
  "gds.action.pause": "\u0625\u064A\u0642\u0627\u0641 \u0645\u0624\u0642\u062A",
  "gds.action.message": "\u0631\u0633\u0627\u0644\u0629",
  "gds.action.mail": "\u0628\u0631\u064A\u062F",
  "gds.action.refresh": "\u062A\u062D\u062F\u064A\u062B",
  "gds.action.trendingUp": "\u0627\u062A\u062C\u0627\u0647 \u0635\u0627\u0639\u062F",
  "gds.action.trendingDown": "\u0627\u062A\u062C\u0627\u0647 \u0647\u0627\u0628\u0637",
  "gds.action.currency": "\u0639\u0645\u0644\u0629",
  "gds.action.grid": "\u0634\u0628\u0643\u0629",
  "gds.action.list": "\u0642\u0627\u0626\u0645\u0629",
  "gds.action.logout": "\u062A\u0633\u062C\u064A\u0644 \u062E\u0631\u0648\u062C",
  "gds.action.notifications": "\u0625\u0634\u0639\u0627\u0631\u0627\u062A",
  "gds.action.back": "\u0631\u062C\u0648\u0639",
  "gds.action.eye": "\u0639\u0631\u0636",
  "gds.action.eyeOff": "\u0625\u062E\u0641\u0627\u0621",
  "gds.action.help": "\u0645\u0633\u0627\u0639\u062F\u0629",
  "gds.action.filter": "\u062A\u0635\u0641\u064A\u0629",
  "gds.action.sort": "\u0641\u0631\u0632",
  "gds.action.export": "\u062A\u0635\u062F\u064A\u0631",
  "gds.action.import": "\u0627\u0633\u062A\u064A\u0631\u0627\u062F",
  "gds.action.preview": "\u0645\u0639\u0627\u064A\u0646\u0629",
  "gds.action.clone": "\u0627\u0633\u062A\u0646\u0633\u0627\u062E",
  "gds.action.restore": "\u0627\u0633\u062A\u0639\u0627\u062F\u0629",
  "gds.action.toggle": "\u062A\u0628\u062F\u064A\u0644",
  "gds.action.search": "\u0628\u062D\u062B",
  "gds.action.submit": "\u0625\u0631\u0633\u0627\u0644",
  "gds.action.reset": "\u0625\u0639\u0627\u062F\u0629 \u0636\u0628\u0637",
  "gds.action.login": "\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644",
  "gds.action.register": "\u062A\u0633\u062C\u064A\u0644",
  "gds.action.verify": "\u062A\u062D\u0642\u0642",
  "gds.action.launch": "\u0625\u0637\u0644\u0627\u0642",
  "gds.action.draft": "\u0645\u0633\u0648\u062F\u0629",
  "gds.action.refer": "\u0625\u062D\u0627\u0644\u0629",
  "gds.action.evidence": "\u062F\u0644\u064A\u0644",
  "gds.feedback.saved": "\u062A\u0645 \u0627\u0644\u062D\u0641\u0638",
  "gds.feedback.error": "\u062D\u062F\u062B \u062E\u0637\u0623 \u0645\u0627",
  "gds.feedback.added": "\u062A\u0645\u062A \u0627\u0644\u0625\u0636\u0627\u0641\u0629",
  "gds.feedback.edited": "\u062A\u0645 \u0627\u0644\u062A\u0639\u062F\u064A\u0644",
  "gds.feedback.deleted": "\u062A\u0645 \u0627\u0644\u062D\u0630\u0641",
  "gds.feedback.canceled": "\u062A\u0645 \u0627\u0644\u0625\u0644\u063A\u0627\u0621",
  "gds.feedback.confirmed": "\u062A\u0645 \u0627\u0644\u062A\u0623\u0643\u064A\u062F",
  "gds.feedback.closed": "\u062A\u0645 \u0627\u0644\u0625\u063A\u0644\u0627\u0642",
  "gds.feedback.changed": "\u062A\u0645 \u0627\u0644\u062A\u063A\u064A\u064A\u0631",
  "gds.feedback.loaded": "\u062A\u0645 \u0627\u0644\u062A\u062D\u0645\u064A\u0644",
  "gds.feedback.started": "\u062A\u0645 \u0627\u0644\u0628\u062F\u0621",
  "gds.feedback.opened": "\u062A\u0645 \u0627\u0644\u0641\u062A\u062D",
  "gds.feedback.sent": "\u062A\u0645 \u0627\u0644\u0625\u0631\u0633\u0627\u0644",
  "gds.feedback.replied": "\u062A\u0645 \u0627\u0644\u0631\u062F",
  "gds.feedback.forwarded": "\u062A\u0645\u062A \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062A\u0648\u062C\u064A\u0647",
  "gds.feedback.attached": "\u062A\u0645 \u0627\u0644\u0625\u0631\u0641\u0627\u0642",
  "gds.feedback.uploaded": "\u062A\u0645 \u0627\u0644\u0631\u0641\u0639",
  "gds.feedback.downloaded": "\u062A\u0645 \u0627\u0644\u062A\u0646\u0632\u064A\u0644",
  "gds.feedback.printed": "\u062A\u0645\u062A \u0627\u0644\u0637\u0628\u0627\u0639\u0629",
  "gds.feedback.copied": "\u062A\u0645 \u0627\u0644\u0646\u0633\u062E",
  "gds.feedback.duplicated": "\u062A\u0645 \u0627\u0644\u062A\u0643\u0631\u0627\u0631",
  "gds.feedback.checked": "\u062A\u0645 \u0627\u0644\u062A\u062D\u062F\u064A\u062F",
  "gds.feedback.unchecked": "\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062A\u062D\u062F\u064A\u062F",
  "gds.feedback.completed": "\u062A\u0645 \u0627\u0644\u0627\u0643\u062A\u0645\u0627\u0644",
  "gds.feedback.cleared": "\u062A\u0645 \u0627\u0644\u0645\u0633\u062D",
  "gds.feedback.captured": "\u062A\u0645 \u0627\u0644\u0627\u0644\u062A\u0642\u0627\u0637",
  "gds.feedback.recorded": "\u062A\u0645 \u0627\u0644\u062A\u0633\u062C\u064A\u0644",
  "gds.feedback.flipped": "\u062A\u0645 \u0627\u0644\u0642\u0644\u0628",
  "gds.feedback.flashed": "\u062A\u0645 \u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u0641\u0644\u0627\u0634",
  "gds.feedback.done": "\u062A\u0645",
  "gds.feedback.rewarded": "\u062A\u0645\u062A \u0627\u0644\u0645\u0643\u0627\u0641\u0623\u0629",
  "gds.feedback.paused": "\u062A\u0645 \u0627\u0644\u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0645\u0624\u0642\u062A",
  "gds.feedback.mailed": "\u062A\u0645 \u0627\u0644\u0625\u0631\u0633\u0627\u0644 \u0628\u0627\u0644\u0628\u0631\u064A\u062F",
  "gds.feedback.refreshed": "\u062A\u0645 \u0627\u0644\u062A\u062D\u062F\u064A\u062B",
  "gds.feedback.loggedOut": "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062E\u0631\u0648\u062C",
  "gds.feedback.filtered": "\u062A\u0645\u062A \u0627\u0644\u062A\u0635\u0641\u064A\u0629",
  "gds.feedback.sorted": "\u062A\u0645 \u0627\u0644\u0641\u0631\u0632",
  "gds.feedback.exported": "\u062A\u0645 \u0627\u0644\u062A\u0635\u062F\u064A\u0631",
  "gds.feedback.imported": "\u062A\u0645 \u0627\u0644\u0627\u0633\u062A\u064A\u0631\u0627\u062F",
  "gds.feedback.previewed": "\u062A\u0645\u062A \u0627\u0644\u0645\u0639\u0627\u064A\u0646\u0629",
  "gds.feedback.cloned": "\u062A\u0645 \u0627\u0644\u0627\u0633\u062A\u0646\u0633\u0627\u062E",
  "gds.feedback.restored": "\u062A\u0645\u062A \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629",
  "gds.feedback.toggled": "\u062A\u0645 \u0627\u0644\u062A\u0628\u062F\u064A\u0644",
  "gds.feedback.searched": "\u062A\u0645 \u0627\u0644\u0628\u062D\u062B",
  "gds.feedback.submitted": "\u062A\u0645 \u0627\u0644\u0625\u0631\u0633\u0627\u0644",
  "gds.feedback.reset": "\u062A\u0645\u062A \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0636\u0628\u0637",
  "gds.feedback.loggedIn": "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644",
  "gds.feedback.registered": "\u062A\u0645 \u0627\u0644\u062A\u0633\u062C\u064A\u0644",
  "gds.feedback.verified": "\u062A\u0645 \u0627\u0644\u062A\u062D\u0642\u0642",
  "gds.feedback.launched": "\u062A\u0645 \u0627\u0644\u0625\u0637\u0644\u0627\u0642",
  "gds.feedback.drafted": "\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0645\u0633\u0648\u062F\u0629",
  "gds.feedback.referred": "\u062A\u0645\u062A \u0627\u0644\u0625\u062D\u0627\u0644\u0629",
  "gds.aria.themeToggle": "\u062A\u0628\u062F\u064A\u0644 \u0646\u0638\u0627\u0645 \u0627\u0644\u0623\u0644\u0648\u0627\u0646",
  "gds.state.emptyData": "\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u062A\u0627\u062D\u0629."
};

// src/locales/de.ts
var de = {
  "gds.action.settings": "Einstellungen",
  "gds.action.analytics": "Analyse",
  "gds.action.dashboard": "Dashboard",
  "gds.action.play": "Abspielen",
  "gds.action.start": "Start",
  "gds.action.users": "Benutzer",
  "gds.action.add": "Hinzuf\xFCgen",
  "gds.action.edit": "Bearbeiten",
  "gds.action.delete": "L\xF6schen",
  "gds.action.save": "Speichern",
  "gds.action.cancel": "Abbrechen",
  "gds.action.confirm": "Best\xE4tigen",
  "gds.action.close": "Schlie\xDFen",
  "gds.action.language": "Sprache",
  "gds.action.theme": "Thema",
  "gds.action.home": "Startseite",
  "gds.action.inbox": "Posteingang",
  "gds.action.calendar": "Kalender",
  "gds.action.gallery": "Galerie",
  "gds.action.history": "Verlauf",
  "gds.action.profile": "Profil",
  "gds.action.send": "Senden",
  "gds.action.reply": "Antworten",
  "gds.action.forward": "Weiterleiten",
  "gds.action.attach": "Anh\xE4ngen",
  "gds.action.upload": "Hochladen",
  "gds.action.download": "Herunterladen",
  "gds.action.print": "Drucken",
  "gds.action.copy": "Kopieren",
  "gds.action.duplicate": "Duplizieren",
  "gds.action.check": "\xDCberpr\xFCfen",
  "gds.action.uncheck": "H\xE4kchen entfernen",
  "gds.action.complete": "Abschlie\xDFen",
  "gds.action.clear": "Leeren",
  "gds.action.capture": "Aufnehmen",
  "gds.action.record": "Aufzeichnen",
  "gds.action.flip": "Umdrehen",
  "gds.action.flash": "Blitz",
  "gds.action.course": "Kurs",
  "gds.action.lesson": "Lektion",
  "gds.action.certificate": "Zertifikat",
  "gds.action.student": "Student",
  "gds.action.class": "Klasse",
  "gds.action.grade": "Note",
  "gds.action.child": "Kind",
  "gds.action.family": "Familie",
  "gds.action.habit": "Gewohnheit",
  "gds.action.goal": "Ziel",
  "gds.action.streak": "Serie",
  "gds.action.reward": "Belohnung",
  "gds.action.trophy": "Troph\xE4e",
  "gds.action.crown": "Krone",
  "gds.action.pause": "Pause",
  "gds.action.message": "Nachricht",
  "gds.action.mail": "E-Mail",
  "gds.action.refresh": "Aktualisieren",
  "gds.action.trendingUp": "Aufw\xE4rtstrend",
  "gds.action.trendingDown": "Abw\xE4rtstrend",
  "gds.action.currency": "W\xE4hrung",
  "gds.action.grid": "Raster",
  "gds.action.list": "Liste",
  "gds.action.logout": "Abmelden",
  "gds.action.notifications": "Benachrichtigungen",
  "gds.action.back": "Zur\xFCck",
  "gds.action.eye": "Anzeigen",
  "gds.action.eyeOff": "Ausblenden",
  "gds.action.help": "Hilfe",
  "gds.action.filter": "Filter",
  "gds.action.sort": "Sortieren",
  "gds.action.export": "Exportieren",
  "gds.action.import": "Importieren",
  "gds.action.preview": "Vorschau",
  "gds.action.clone": "Klonen",
  "gds.action.restore": "Wiederherstellen",
  "gds.action.toggle": "Umschalten",
  "gds.action.search": "Suchen",
  "gds.action.submit": "Absenden",
  "gds.action.reset": "Zur\xFCcksetzen",
  "gds.action.login": "Einloggen",
  "gds.action.register": "Registrieren",
  "gds.action.verify": "Verifizieren",
  "gds.action.launch": "Starten",
  "gds.action.draft": "Entwurf",
  "gds.action.refer": "Empfehlen",
  "gds.action.evidence": "Beweismittel",
  "gds.feedback.saved": "Gespeichert",
  "gds.feedback.error": "Etwas ist schiefgelaufen",
  "gds.feedback.added": "Hinzugef\xFCgt",
  "gds.feedback.edited": "Bearbeitet",
  "gds.feedback.deleted": "Gel\xF6scht",
  "gds.feedback.canceled": "Abgebrochen",
  "gds.feedback.confirmed": "Best\xE4tigt",
  "gds.feedback.closed": "Geschlossen",
  "gds.feedback.changed": "Ge\xE4ndert",
  "gds.feedback.loaded": "Geladen",
  "gds.feedback.started": "Gestartet",
  "gds.feedback.opened": "Ge\xF6ffnet",
  "gds.feedback.sent": "Gesendet",
  "gds.feedback.replied": "Geantwortet",
  "gds.feedback.forwarded": "Weitergeleitet",
  "gds.feedback.attached": "Angeh\xE4ngt",
  "gds.feedback.uploaded": "Hochgeladen",
  "gds.feedback.downloaded": "Heruntergeladen",
  "gds.feedback.printed": "Gedruckt",
  "gds.feedback.copied": "Kopiert",
  "gds.feedback.duplicated": "Dupliziert",
  "gds.feedback.checked": "Ausgew\xE4hlt",
  "gds.feedback.unchecked": "H\xE4kchen entfernt",
  "gds.feedback.completed": "Abgeschlossen",
  "gds.feedback.cleared": "Geleert",
  "gds.feedback.captured": "Erfasst",
  "gds.feedback.recorded": "Aufgezeichnet",
  "gds.feedback.flipped": "Umdreht",
  "gds.feedback.flashed": "Geblitzt",
  "gds.feedback.done": "Erledigt",
  "gds.feedback.rewarded": "Belohnt",
  "gds.feedback.paused": "Pausiert",
  "gds.feedback.mailed": "Gemailt",
  "gds.feedback.refreshed": "Aktualisiert",
  "gds.feedback.loggedOut": "Abgemeldet",
  "gds.feedback.filtered": "Gefiltert",
  "gds.feedback.sorted": "Sortiert",
  "gds.feedback.exported": "Exportiert",
  "gds.feedback.imported": "Importiert",
  "gds.feedback.previewed": "Angezeigt",
  "gds.feedback.cloned": "Kloniert",
  "gds.feedback.restored": "Wiederhergestellt",
  "gds.feedback.toggled": "Umgeschaltet",
  "gds.feedback.searched": "Gesucht",
  "gds.feedback.submitted": "Abgesendet",
  "gds.feedback.reset": "Zur\xFCckgesetzt",
  "gds.feedback.loggedIn": "Eingeloggt",
  "gds.feedback.registered": "Registriert",
  "gds.feedback.verified": "Verifiziert",
  "gds.feedback.launched": "Gestartet",
  "gds.feedback.drafted": "Entworfen",
  "gds.feedback.referred": "Empfohlen",
  "gds.aria.themeToggle": "Farbschema umschalten",
  "gds.state.emptyData": "Keine Daten verf\xFCgbar."
};

// src/locales/en.ts
var en = {
  "gds.action.settings": "Settings",
  "gds.action.analytics": "Analytics",
  "gds.action.dashboard": "Dashboard",
  "gds.action.play": "Play",
  "gds.action.start": "Start",
  "gds.action.users": "Users",
  "gds.action.add": "Add",
  "gds.action.edit": "Edit",
  "gds.action.delete": "Delete",
  "gds.action.save": "Save",
  "gds.action.cancel": "Cancel",
  "gds.action.confirm": "Confirm",
  "gds.action.close": "Close",
  "gds.action.language": "Language",
  "gds.action.theme": "Theme",
  "gds.action.home": "Home",
  "gds.action.inbox": "Inbox",
  "gds.action.calendar": "Calendar",
  "gds.action.gallery": "Gallery",
  "gds.action.history": "History",
  "gds.action.profile": "Profile",
  "gds.action.send": "Send",
  "gds.action.reply": "Reply",
  "gds.action.forward": "Forward",
  "gds.action.attach": "Attach",
  "gds.action.upload": "Upload",
  "gds.action.download": "Download",
  "gds.action.print": "Print",
  "gds.action.copy": "Copy",
  "gds.action.duplicate": "Duplicate",
  "gds.action.check": "Check",
  "gds.action.uncheck": "Uncheck",
  "gds.action.complete": "Complete",
  "gds.action.clear": "Clear",
  "gds.action.capture": "Capture",
  "gds.action.record": "Record",
  "gds.action.flip": "Flip",
  "gds.action.flash": "Flash",
  "gds.action.course": "Course",
  "gds.action.lesson": "Lesson",
  "gds.action.certificate": "Certificate",
  "gds.action.student": "Student",
  "gds.action.class": "Class",
  "gds.action.grade": "Grade",
  "gds.action.child": "Child",
  "gds.action.family": "Family",
  "gds.action.habit": "Habit",
  "gds.action.goal": "Goal",
  "gds.action.streak": "Streak",
  "gds.action.reward": "Reward",
  "gds.action.trophy": "Trophy",
  "gds.action.crown": "Crown",
  "gds.action.pause": "Pause",
  "gds.action.message": "Message",
  "gds.action.mail": "Mail",
  "gds.action.refresh": "Refresh",
  "gds.action.trendingUp": "Trending Up",
  "gds.action.trendingDown": "Trending Down",
  "gds.action.currency": "Currency",
  "gds.action.grid": "Grid",
  "gds.action.list": "List",
  "gds.action.logout": "Logout",
  "gds.action.notifications": "Notifications",
  "gds.action.back": "Back",
  "gds.action.eye": "View",
  "gds.action.eyeOff": "Hide",
  "gds.action.help": "Help",
  "gds.action.filter": "Filter",
  "gds.action.sort": "Sort",
  "gds.action.export": "Export",
  "gds.action.import": "Import",
  "gds.action.preview": "Preview",
  "gds.action.clone": "Clone",
  "gds.action.restore": "Restore",
  "gds.action.toggle": "Toggle",
  "gds.action.search": "Search",
  "gds.action.submit": "Submit",
  "gds.action.reset": "Reset",
  "gds.action.login": "Login",
  "gds.action.register": "Register",
  "gds.action.verify": "Verify",
  "gds.action.launch": "Launch",
  "gds.action.draft": "Draft",
  "gds.action.refer": "Refer",
  "gds.action.evidence": "Evidence",
  "gds.feedback.saved": "Saved",
  "gds.feedback.error": "Something went wrong",
  "gds.feedback.added": "Added",
  "gds.feedback.edited": "Edited",
  "gds.feedback.deleted": "Deleted",
  "gds.feedback.canceled": "Canceled",
  "gds.feedback.confirmed": "Confirmed",
  "gds.feedback.closed": "Closed",
  "gds.feedback.changed": "Changed",
  "gds.feedback.loaded": "Loaded",
  "gds.feedback.started": "Started",
  "gds.feedback.opened": "Opened",
  "gds.feedback.sent": "Sent",
  "gds.feedback.replied": "Replied",
  "gds.feedback.forwarded": "Forwarded",
  "gds.feedback.attached": "Attached",
  "gds.feedback.uploaded": "Uploaded",
  "gds.feedback.downloaded": "Downloaded",
  "gds.feedback.printed": "Printed",
  "gds.feedback.copied": "Copied",
  "gds.feedback.duplicated": "Duplicated",
  "gds.feedback.checked": "Checked",
  "gds.feedback.unchecked": "Unchecked",
  "gds.feedback.completed": "Completed",
  "gds.feedback.cleared": "Cleared",
  "gds.feedback.captured": "Captured",
  "gds.feedback.recorded": "Recorded",
  "gds.feedback.flipped": "Flipped",
  "gds.feedback.flashed": "Flashed",
  "gds.feedback.done": "Done",
  "gds.feedback.rewarded": "Rewarded",
  "gds.feedback.paused": "Paused",
  "gds.feedback.mailed": "Mailed",
  "gds.feedback.refreshed": "Refreshed",
  "gds.feedback.loggedOut": "Logged Out",
  "gds.feedback.filtered": "Filtered",
  "gds.feedback.sorted": "Sorted",
  "gds.feedback.exported": "Exported",
  "gds.feedback.imported": "Imported",
  "gds.feedback.previewed": "Previewed",
  "gds.feedback.cloned": "Cloned",
  "gds.feedback.restored": "Restored",
  "gds.feedback.toggled": "Toggled",
  "gds.feedback.searched": "Searched",
  "gds.feedback.submitted": "Submitted",
  "gds.feedback.reset": "Reset",
  "gds.feedback.loggedIn": "Logged In",
  "gds.feedback.registered": "Registered",
  "gds.feedback.verified": "Verified",
  "gds.feedback.launched": "Launched",
  "gds.feedback.drafted": "Drafted",
  "gds.feedback.referred": "Referred",
  "gds.aria.themeToggle": "Toggle color scheme",
  "gds.state.emptyData": "No data available."
};

// src/locales/es.ts
var es = {
  "gds.action.settings": "Configuraci\xF3n",
  "gds.action.analytics": "Anal\xEDtica",
  "gds.action.dashboard": "Panel",
  "gds.action.play": "Reproducir",
  "gds.action.start": "Iniciar",
  "gds.action.users": "Usuarios",
  "gds.action.add": "A\xF1adir",
  "gds.action.edit": "Editar",
  "gds.action.delete": "Eliminar",
  "gds.action.save": "Guardar",
  "gds.action.cancel": "Cancelar",
  "gds.action.confirm": "Confirmar",
  "gds.action.close": "Cerrar",
  "gds.action.language": "Idioma",
  "gds.action.theme": "Tema",
  "gds.action.home": "Inicio",
  "gds.action.inbox": "Bandeja de entrada",
  "gds.action.calendar": "Calendario",
  "gds.action.gallery": "Galer\xEDa",
  "gds.action.history": "Historial",
  "gds.action.profile": "Perfil",
  "gds.action.send": "Enviar",
  "gds.action.reply": "Responder",
  "gds.action.forward": "Reenviar",
  "gds.action.attach": "Adjuntar",
  "gds.action.upload": "Subir",
  "gds.action.download": "Descargar",
  "gds.action.print": "Imprimir",
  "gds.action.copy": "Copiar",
  "gds.action.duplicate": "Duplicar",
  "gds.action.check": "Marcar",
  "gds.action.uncheck": "Desmarcar",
  "gds.action.complete": "Completar",
  "gds.action.clear": "Limpiar",
  "gds.action.capture": "Capturar",
  "gds.action.record": "Grabar",
  "gds.action.flip": "Girar",
  "gds.action.flash": "Flash",
  "gds.action.course": "Curso",
  "gds.action.lesson": "Lecci\xF3n",
  "gds.action.certificate": "Certificado",
  "gds.action.student": "Estudiante",
  "gds.action.class": "Clase",
  "gds.action.grade": "Calificaci\xF3n",
  "gds.action.child": "Ni\xF1o",
  "gds.action.family": "Familia",
  "gds.action.habit": "H\xE1bito",
  "gds.action.goal": "Objetivo",
  "gds.action.streak": "Racha",
  "gds.action.reward": "Recompensa",
  "gds.action.trophy": "Trofeo",
  "gds.action.crown": "Corona",
  "gds.action.pause": "Pausa",
  "gds.action.message": "Mensaje",
  "gds.action.mail": "Correo",
  "gds.action.refresh": "Actualizar",
  "gds.action.trendingUp": "Tendencia al alza",
  "gds.action.trendingDown": "Tendencia a la baja",
  "gds.action.currency": "Moneda",
  "gds.action.grid": "Cuadr\xEDcula",
  "gds.action.list": "Lista",
  "gds.action.logout": "Cerrar sesi\xF3n",
  "gds.action.notifications": "Notificaciones",
  "gds.action.back": "Volver",
  "gds.action.eye": "Ver",
  "gds.action.eyeOff": "Ocultar",
  "gds.action.help": "Ayuda",
  "gds.action.filter": "Filtrar",
  "gds.action.sort": "Ordenar",
  "gds.action.export": "Exportar",
  "gds.action.import": "Importar",
  "gds.action.preview": "Vista previa",
  "gds.action.clone": "Clonar",
  "gds.action.restore": "Restaurar",
  "gds.action.toggle": "Alternar",
  "gds.action.search": "Buscar",
  "gds.action.submit": "Enviar",
  "gds.action.reset": "Restablecer",
  "gds.action.login": "Iniciar sesi\xF3n",
  "gds.action.register": "Registrarse",
  "gds.action.verify": "Verificar",
  "gds.action.launch": "Lanzar",
  "gds.action.draft": "Borrador",
  "gds.action.refer": "Referir",
  "gds.action.evidence": "Evidencia",
  "gds.feedback.saved": "Guardado",
  "gds.feedback.error": "Algo sali\xF3 mal",
  "gds.feedback.added": "A\xF1adido",
  "gds.feedback.edited": "Editado",
  "gds.feedback.deleted": "Eliminado",
  "gds.feedback.canceled": "Cancelado",
  "gds.feedback.confirmed": "Confirmado",
  "gds.feedback.closed": "Cerrado",
  "gds.feedback.changed": "Cambiado",
  "gds.feedback.loaded": "Cargado",
  "gds.feedback.started": "Iniciado",
  "gds.feedback.opened": "Abierto",
  "gds.feedback.sent": "Enviado",
  "gds.feedback.replied": "Respondido",
  "gds.feedback.forwarded": "Reenviado",
  "gds.feedback.attached": "Adjuntado",
  "gds.feedback.uploaded": "Subido",
  "gds.feedback.downloaded": "Descargado",
  "gds.feedback.printed": "Impreso",
  "gds.feedback.copied": "Copiado",
  "gds.feedback.duplicated": "Duplicado",
  "gds.feedback.checked": "Marcado",
  "gds.feedback.unchecked": "Desmarcado",
  "gds.feedback.completed": "Completado",
  "gds.feedback.cleared": "Limpiado",
  "gds.feedback.captured": "Capturado",
  "gds.feedback.recorded": "Grabado",
  "gds.feedback.flipped": "Girado",
  "gds.feedback.flashed": "Flash activado",
  "gds.feedback.done": "Hecho",
  "gds.feedback.rewarded": "Recompensado",
  "gds.feedback.paused": "Pausado",
  "gds.feedback.mailed": "Enviado por correo",
  "gds.feedback.refreshed": "Actualizado",
  "gds.feedback.loggedOut": "Sesi\xF3n cerrada",
  "gds.feedback.filtered": "Filtrado",
  "gds.feedback.sorted": "Ordenado",
  "gds.feedback.exported": "Exportado",
  "gds.feedback.imported": "Importado",
  "gds.feedback.previewed": "Previsualizado",
  "gds.feedback.cloned": "Clonado",
  "gds.feedback.restored": "Restaurado",
  "gds.feedback.toggled": "Alternado",
  "gds.feedback.searched": "Buscado",
  "gds.feedback.submitted": "Enviado",
  "gds.feedback.reset": "Restablecido",
  "gds.feedback.loggedIn": "Sesi\xF3n iniciada",
  "gds.feedback.registered": "Registrado",
  "gds.feedback.verified": "Verificado",
  "gds.feedback.launched": "Lanzado",
  "gds.feedback.drafted": "Guardado como borrador",
  "gds.feedback.referred": "Referido",
  "gds.aria.themeToggle": "Alternar esquema de color",
  "gds.state.emptyData": "No hay datos disponibles."
};

// src/locales/fr.ts
var fr = {
  "gds.action.settings": "Param\xE8tres",
  "gds.action.analytics": "Analytique",
  "gds.action.dashboard": "Tableau de bord",
  "gds.action.play": "Jouer",
  "gds.action.start": "D\xE9marrer",
  "gds.action.users": "Utilisateurs",
  "gds.action.add": "Ajouter",
  "gds.action.edit": "Modifier",
  "gds.action.delete": "Supprimer",
  "gds.action.save": "Enregistrer",
  "gds.action.cancel": "Annuler",
  "gds.action.confirm": "Confirmer",
  "gds.action.close": "Fermer",
  "gds.action.language": "Langue",
  "gds.action.theme": "Th\xE8me",
  "gds.action.home": "Accueil",
  "gds.action.inbox": "Bo\xEEte de r\xE9ception",
  "gds.action.calendar": "Calendrier",
  "gds.action.gallery": "Galerie",
  "gds.action.history": "Historique",
  "gds.action.profile": "Profil",
  "gds.action.send": "Envoyer",
  "gds.action.reply": "R\xE9pondre",
  "gds.action.forward": "Transf\xE9rer",
  "gds.action.attach": "Joindre",
  "gds.action.upload": "T\xE9l\xE9verser",
  "gds.action.download": "T\xE9l\xE9charger",
  "gds.action.print": "Imprimer",
  "gds.action.copy": "Copier",
  "gds.action.duplicate": "Dupliquer",
  "gds.action.check": "Cocher",
  "gds.action.uncheck": "D\xE9cocher",
  "gds.action.complete": "Terminer",
  "gds.action.clear": "Effacer",
  "gds.action.capture": "Capturer",
  "gds.action.record": "Enregistrer",
  "gds.action.flip": "Retourner",
  "gds.action.flash": "Flash",
  "gds.action.course": "Cours",
  "gds.action.lesson": "Le\xE7on",
  "gds.action.certificate": "Certificat",
  "gds.action.student": "\xC9tudiant",
  "gds.action.class": "Classe",
  "gds.action.grade": "Note",
  "gds.action.child": "Enfant",
  "gds.action.family": "Famille",
  "gds.action.habit": "Habitude",
  "gds.action.goal": "Objectif",
  "gds.action.streak": "S\xE9rie",
  "gds.action.reward": "R\xE9compense",
  "gds.action.trophy": "Troph\xE9e",
  "gds.action.crown": "Couronne",
  "gds.action.pause": "Pause",
  "gds.action.message": "Message",
  "gds.action.mail": "Courrier",
  "gds.action.refresh": "Actualiser",
  "gds.action.trendingUp": "Tendance \xE0 la hausse",
  "gds.action.trendingDown": "Tendance \xE0 la baisse",
  "gds.action.currency": "Devise",
  "gds.action.grid": "Grille",
  "gds.action.list": "Liste",
  "gds.action.logout": "D\xE9connexion",
  "gds.action.notifications": "Notifications",
  "gds.action.back": "Retour",
  "gds.action.eye": "Afficher",
  "gds.action.eyeOff": "Masquer",
  "gds.action.help": "Aide",
  "gds.action.filter": "Filtrer",
  "gds.action.sort": "Trier",
  "gds.action.export": "Exporter",
  "gds.action.import": "Importer",
  "gds.action.preview": "Aper\xE7u",
  "gds.action.clone": "Cloner",
  "gds.action.restore": "Restaurer",
  "gds.action.toggle": "Basculer",
  "gds.action.search": "Rechercher",
  "gds.action.submit": "Soumettre",
  "gds.action.reset": "R\xE9initialiser",
  "gds.action.login": "Connexion",
  "gds.action.register": "S'inscrire",
  "gds.action.verify": "V\xE9rifier",
  "gds.action.launch": "Lancer",
  "gds.action.draft": "Brouillon",
  "gds.action.refer": "R\xE9f\xE9rer",
  "gds.action.evidence": "Preuve",
  "gds.feedback.saved": "Enregistr\xE9",
  "gds.feedback.error": "Une erreur est survenue",
  "gds.feedback.added": "Ajout\xE9",
  "gds.feedback.edited": "Modifi\xE9",
  "gds.feedback.deleted": "Supprim\xE9",
  "gds.feedback.canceled": "Annul\xE9",
  "gds.feedback.confirmed": "Confirm\xE9",
  "gds.feedback.closed": "Ferm\xE9",
  "gds.feedback.changed": "Modifi\xE9",
  "gds.feedback.loaded": "Charg\xE9",
  "gds.feedback.started": "D\xE9marr\xE9",
  "gds.feedback.opened": "Ouvert",
  "gds.feedback.sent": "Envoy\xE9",
  "gds.feedback.replied": "R\xE9pondu",
  "gds.feedback.forwarded": "Transf\xE9r\xE9",
  "gds.feedback.attached": "Joint",
  "gds.feedback.uploaded": "T\xE9l\xE9vers\xE9",
  "gds.feedback.downloaded": "T\xE9l\xE9charg\xE9",
  "gds.feedback.printed": "Imprim\xE9",
  "gds.feedback.copied": "Copi\xE9",
  "gds.feedback.duplicated": "Dupliqu\xE9",
  "gds.feedback.checked": "Coch\xE9",
  "gds.feedback.unchecked": "D\xE9coch\xE9",
  "gds.feedback.completed": "Termin\xE9",
  "gds.feedback.cleared": "Effac\xE9",
  "gds.feedback.captured": "Captur\xE9",
  "gds.feedback.recorded": "Enregistr\xE9",
  "gds.feedback.flipped": "Retourn\xE9",
  "gds.feedback.flashed": "Flash\xE9",
  "gds.feedback.done": "Fait",
  "gds.feedback.rewarded": "R\xE9compens\xE9",
  "gds.feedback.paused": "En pause",
  "gds.feedback.mailed": "Envoy\xE9",
  "gds.feedback.refreshed": "Actualis\xE9",
  "gds.feedback.loggedOut": "D\xE9connect\xE9",
  "gds.feedback.filtered": "Filtr\xE9",
  "gds.feedback.sorted": "Tri\xE9",
  "gds.feedback.exported": "Export\xE9",
  "gds.feedback.imported": "Import\xE9",
  "gds.feedback.previewed": "Visualis\xE9",
  "gds.feedback.cloned": "Clon\xE9",
  "gds.feedback.restored": "Restaur\xE9",
  "gds.feedback.toggled": "Bascul\xE9",
  "gds.feedback.searched": "Recherch\xE9",
  "gds.feedback.submitted": "Soumis",
  "gds.feedback.reset": "R\xE9initialis\xE9",
  "gds.feedback.loggedIn": "Connect\xE9",
  "gds.feedback.registered": "Inscrit",
  "gds.feedback.verified": "V\xE9rifi\xE9",
  "gds.feedback.launched": "Lanc\xE9",
  "gds.feedback.drafted": "R\xE9dig\xE9",
  "gds.feedback.referred": "R\xE9f\xE9r\xE9",
  "gds.aria.themeToggle": "Basculer le th\xE8me",
  "gds.state.emptyData": "Aucune donn\xE9e disponible."
};

// src/locales/he.ts
var he = {
  "gds.action.settings": "\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA",
  "gds.action.analytics": "\u05E0\u05D9\u05EA\u05D5\u05D7 \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD",
  "gds.action.dashboard": "\u05DC\u05D5\u05D7 \u05D1\u05E7\u05E8\u05D4",
  "gds.action.play": "\u05D4\u05E4\u05E2\u05DC",
  "gds.action.start": "\u05D4\u05EA\u05D7\u05DC",
  "gds.action.users": "\u05DE\u05E9\u05EA\u05DE\u05E9\u05D9\u05DD",
  "gds.action.add": "\u05D4\u05D5\u05E1\u05E3",
  "gds.action.edit": "\u05E2\u05E8\u05D5\u05DA",
  "gds.action.delete": "\u05DE\u05D7\u05E7",
  "gds.action.save": "\u05E9\u05DE\u05D5\u05E8",
  "gds.action.cancel": "\u05D1\u05D9\u05D8\u0648\u0644",
  "gds.action.confirm": "\u05D0\u05D9\u05E9\u05D5\u05E8",
  "gds.action.close": "\u05E1\u05D2\u05D5\u05E8",
  "gds.action.language": "\u05E9\u05E4\u05D4",
  "gds.action.theme": "\u05E2\u05E8\u05DB\u05EA \u05E0\u05D5\u05E9\u05D0",
  "gds.action.home": "\u05D3\u05E3 \u05D4\u05D1\u05D9\u05EA",
  "gds.action.inbox": "\u05D3\u05D5\u05D0\u05E8 \u05E0\u05DB\u05E0\u05E1",
  "gds.action.calendar": "\u05DC\u05D5\u05D7 \u05E9\u05E0\u05D4",
  "gds.action.gallery": "\u05D2\u05DC\u05E8\u05D9\u05D4",
  "gds.action.history": "\u05D4\u05D9\u05E1\u05D8\u05D5\u05E8\u05D9\u05D4",
  "gds.action.profile": "\u05E4\u05E8\u05D5\u05E4\u05D9\u05DC",
  "gds.action.send": "\u05E9\u05DC\u05D7",
  "gds.action.reply": "\u05D4\u05E9\u05D1",
  "gds.action.forward": "\u05D4\u05E2\u05D1\u05E8",
  "gds.action.attach": "\u05E6\u05E8\u05E3",
  "gds.action.upload": "\u05D4\u05E2\u05DC\u05D4",
  "gds.action.download": "\u05D4\u05D5\u05E8\u05D3",
  "gds.action.print": "\u05D4\u05D3\u05E4\u05E1",
  "gds.action.copy": "\u05D4\u05E2\u05EA\u05E7",
  "gds.action.duplicate": "\u05E9\u05DB\u05E4\u05DC",
  "gds.action.check": "\u05E1\u05DE\u05DF",
  "gds.action.uncheck": "\u05D1\u05D8\u05DC \u05E1\u05D9\u05DE\u05D5\u05DF",
  "gds.action.complete": "\u05D4\u05E9\u05DC\u05DD",
  "gds.action.clear": "\u05E0\u05E7\u05D4",
  "gds.action.capture": "\u05E6\u05DC\u05DD",
  "gds.action.record": "\u05D4\u05E7\u05DC\u05D8",
  "gds.action.flip": "\u05D4\u05E4\u05D5\u05DA",
  "gds.action.flash": "\u05DE\u05D1\u05D6\u05E7",
  "gds.action.course": "\u05E7\u05D5\u05E8\u05E1",
  "gds.action.lesson": "\u05E9\u05D9\u05E2\u05D5\u05E8",
  "gds.action.certificate": "\u05EA\u05E2\u05D5\u05D3\u05D4",
  "gds.action.student": "\u05EA\u05DC\u05DE\u05D9\u05D3",
  "gds.action.class": "\u05DB\u05D9\u05EA\u05D4",
  "gds.action.grade": "\u05E6\u05D9\u05D5\u05DF",
  "gds.action.child": "\u05D9\u05DC\u05D3",
  "gds.action.family": "\u05DE\u05E9\u05E4\u05D7\u05D4",
  "gds.action.habit": "\u05D4\u05E8\u05D2\u05DC",
  "gds.action.goal": "\u05DE\u05D8\u05E8\u05D4",
  "gds.action.streak": "\u05E8\u05E6\u05E3",
  "gds.action.reward": "\u05E4\u05E8\u05E1",
  "gds.action.trophy": "\u05D2\u05D1\u05D9\u05E2",
  "gds.action.crown": "\u05DB\u05EA\u05E8",
  "gds.action.pause": "\u05D4\u05E9\u05D4\u05D4",
  "gds.action.message": "\u05D4\u05D5\u05D3\u05E2\u05D4",
  "gds.action.mail": "\u05D3\u05D5\u05D0\u05E8",
  "gds.action.refresh": "\u05E8\u05E2\u05E0\u05DF",
  "gds.action.trendingUp": "\u05DE\u05D2\u05DE\u05D4 \u05D7\u05D9\u05D5\u05D1\u05D9\u05EA",
  "gds.action.trendingDown": "\u05DE\u05D2\u05DE\u05D4 \u05E9\u05DC\u05D9\u05DC\u05D9\u05EA",
  "gds.action.currency": "\u05DE\u05D8\u05D1\u05E2",
  "gds.action.grid": "\u05E8\u05E9\u05EA",
  "gds.action.list": "\u05E8\u05E9\u05D9\u05DE\u05D4",
  "gds.action.logout": "\u05D4\u05EA\u05E0\u05EA\u05E7",
  "gds.action.notifications": "\u05D4\u05EA\u05E8\u05D0\u05D5\u05EA",
  "gds.action.back": "\u05D7\u05D6\u05D5\u05E8",
  "gds.action.eye": "\u05D4\u05E6\u05D2",
  "gds.action.eyeOff": "\u05D4\u05E1\u05EA\u05E8",
  "gds.action.help": "\u05E2\u05D6\u05E8\u05D4",
  "gds.action.filter": "\u05E1\u05E0\u05DF",
  "gds.action.sort": "\u05DE\u05D9\u05D9\u05DF",
  "gds.action.export": "\u05D9\u05D9\u05E6\u05D5\u05D0",
  "gds.action.import": "\u05D9\u05D9\u05D1\u05D5\u05D0",
  "gds.action.preview": "\u05EA\u05E6\u05D5\u05D2\u05D4 \u05DE\u05E7\u05D3\u05D9\u05DE\u05D4",
  "gds.action.clone": "\u05E9\u05DB\u05E4\u05D5\u05DC",
  "gds.action.restore": "\u05E9\u05D7\u05D6\u05D5\u05E8",
  "gds.action.toggle": "\u05D4\u05D7\u05DC\u05E4\u05D4",
  "gds.action.search": "\u05D7\u05D9\u05E4\u05D5\u05E9",
  "gds.action.submit": "\u05E9\u05DC\u05D9\u05D7\u05D4",
  "gds.action.reset": "\u05D0\u05D9\u05E4\u05D5\u05E1",
  "gds.action.login": "\u05D4\u05EA\u05D7\u05D1\u05E8\u05D5\u05EA",
  "gds.action.register": "\u05D4\u05E8\u05E9\u05DE\u05D4",
  "gds.action.verify": "\u05D0\u05D9\u05DE\u05D5\u05EA",
  "gds.action.launch": "\u05D4\u05E9\u05E7\u05D4",
  "gds.action.draft": "\u05D8\u05D9\u05D5\u05D8\u05D4",
  "gds.action.refer": "\u05D4\u05E4\u05E0\u05D9\u05D4",
  "gds.action.evidence": "\u05E8\u05D0\u05D9\u05D4",
  "gds.feedback.saved": "\u05E0\u05E9\u05DE\u05E8",
  "gds.feedback.error": "\u05DE\u05E9\u05D4\u05D5 \u05D4\u05E9\u05EA\u05D1\u05E9",
  "gds.feedback.added": "\u05E0\u05D5\u05E1\u05E3",
  "gds.feedback.edited": "\u05E0\u05E2\u05E8\u05DA",
  "gds.feedback.deleted": "\u05E0\u05DE\u05D7\u05E7",
  "gds.feedback.canceled": "\u05D1\u05D5\u05D8\u05DC",
  "gds.feedback.confirmed": "\u05D0\u05D5\u05E9\u05E8",
  "gds.feedback.closed": "\u05E0\u05E1\u05D2\u05E8",
  "gds.feedback.changed": "\u05E9\u05D5\u05E0\u05D4",
  "gds.feedback.loaded": "\u05E0\u05D8\u05E2\u05DF",
  "gds.feedback.started": "\u05D4\u05D5\u05EA\u05D7\u05DC",
  "gds.feedback.opened": "\u05E0\u05E4\u05EA\u05D7",
  "gds.feedback.sent": "\u05E0\u05E9\u05DC\u05D7",
  "gds.feedback.replied": "\u05E0\u05E2\u05E0\u05D4",
  "gds.feedback.forwarded": "\u05D4\u05D5\u05E2\u05D1\u05E8",
  "gds.feedback.attached": "\u05E6\u05D5\u05E8\u05E3",
  "gds.feedback.uploaded": "\u05D4\u05D5\u05E2\u05DC\u05D4",
  "gds.feedback.downloaded": "\u05D4\u05D5\u05E8\u05D3",
  "gds.feedback.printed": "\u05D4\u05D5\u05D3\u05E4\u05E1",
  "gds.feedback.copied": "\u05D4\u05D5\u05E2\u05EA\u05E7",
  "gds.feedback.duplicated": "\u05E9\u05D5\u05DB\u05E4\u05DC",
  "gds.feedback.checked": "\u05E1\u05D5\u05DE\u05DF",
  "gds.feedback.unchecked": "\u05D4\u05E1\u05D9\u05DE\u05D5\u05DF \u05D1\u05D5\u05D8\u05DC",
  "gds.feedback.completed": "\u05D4\u05D5\u05E9\u05DC\u05DD",
  "gds.feedback.cleared": "\u05E0\u05D5\u05E7\u05D4",
  "gds.feedback.captured": "\u05E6\u05D5\u05DC\u05DD",
  "gds.feedback.recorded": "\u05D4\u05D5\u05E7\u05DC\u05D8",
  "gds.feedback.flipped": "\u05E0\u05D4\u05E4\u05DA",
  "gds.feedback.flashed": "\u05D4\u05D5\u05D1\u05D6\u05E7",
  "gds.feedback.done": "\u05D1\u05D5\u05E6\u05E2",
  "gds.feedback.rewarded": "\u05EA\u05D5\u05D2\u05DE\u05DC",
  "gds.feedback.paused": "\u05D4\u05D5\u05E9\u05D4\u05D4",
  "gds.feedback.mailed": "\u05E0\u05E9\u05DC\u05D7",
  "gds.feedback.refreshed": "\u05E8\u05D5\u05E2\u05E0\u05DF",
  "gds.feedback.loggedOut": "\u05D4\u05EA\u05E0\u05EA\u05E7",
  "gds.feedback.filtered": "\u05E1\u05D5\u05E0\u05DF",
  "gds.feedback.sorted": "\u05DE\u05D5\u05D9\u05DF",
  "gds.feedback.exported": "\u05D9\u05D5\u05E6\u05D0",
  "gds.feedback.imported": "\u05D9\u05D5\u05D1\u05D0",
  "gds.feedback.previewed": "\u05D4\u05D5\u05E6\u05D2",
  "gds.feedback.cloned": "\u05E9\u05D5\u05DB\u05E4\u05DC",
  "gds.feedback.restored": "\u05E9\u05D5\u05D7\u05D6\u05E8",
  "gds.feedback.toggled": "\u05D4\u05D5\u05D7\u05DC\u05E3",
  "gds.feedback.searched": "\u05D7\u05D9\u05E4\u05D5\u05E9 \u05D4\u05D5\u05E9\u05DC\u05DD",
  "gds.feedback.submitted": "\u05E0\u05E9\u05DC\u05D7",
  "gds.feedback.reset": "\u05D0\u05D5\u05E4\u05E1",
  "gds.feedback.loggedIn": "\u05D4\u05EA\u05D7\u05D1\u05E8",
  "gds.feedback.registered": "\u05E0\u05E8\u05E9\u05DD",
  "gds.feedback.verified": "\u05D0\u05D5\u05DE\u05EA",
  "gds.feedback.launched": "\u05D4\u05D5\u05E9\u05E7",
  "gds.feedback.drafted": "\u05E0\u05E9\u05DE\u05E8 \u05DB\u05D8\u05D9\u05D5\u05D8\u05D4",
  "gds.feedback.referred": "\u05D4\u05D5\u05E4\u05E0\u05D4",
  "gds.aria.themeToggle": "\u05D4\u05D7\u05DC\u05E3 \u05E2\u05E8\u05DB\u05EA \u05E6\u05D1\u05E2\u05D9\u05DD",
  "gds.state.emptyData": "\u05D0\u05D9\u05DF \u05E0\u05EA\u05D5\u05E0\u05D9\u05DD \u05D6\u05DE\u05D9\u05E0\u05D9\u05DD."
};

// src/locales/hu.ts
var hu = {
  "gds.action.settings": "Be\xE1ll\xEDt\xE1sok",
  "gds.action.analytics": "Analitika",
  "gds.action.dashboard": "Ir\xE1ny\xEDt\xF3pult",
  "gds.action.play": "Lej\xE1tsz\xE1s",
  "gds.action.start": "Ind\xEDt\xE1s",
  "gds.action.users": "Felhaszn\xE1l\xF3k",
  "gds.action.add": "Hozz\xE1ad\xE1s",
  "gds.action.edit": "Szerkeszt\xE9s",
  "gds.action.delete": "T\xF6rl\xE9s",
  "gds.action.save": "Ment\xE9s",
  "gds.action.cancel": "M\xE9gse",
  "gds.action.confirm": "Meger\u0151s\xEDt\xE9s",
  "gds.action.close": "Bez\xE1r\xE1s",
  "gds.action.language": "Nyelv",
  "gds.action.theme": "T\xE9ma",
  "gds.action.home": "F\u0151oldal",
  "gds.action.inbox": "Be\xE9rkez\u0151",
  "gds.action.calendar": "Napt\xE1r",
  "gds.action.gallery": "Gal\xE9ria",
  "gds.action.history": "El\u0151zm\xE9nyek",
  "gds.action.profile": "Profil",
  "gds.action.send": "K\xFCld\xE9s",
  "gds.action.reply": "V\xE1lasz",
  "gds.action.forward": "Tov\xE1bb\xEDt\xE1s",
  "gds.action.attach": "Csatol\xE1s",
  "gds.action.upload": "Felt\xF6lt\xE9s",
  "gds.action.download": "Let\xF6lt\xE9s",
  "gds.action.print": "Nyomtat\xE1s",
  "gds.action.copy": "M\xE1sol\xE1s",
  "gds.action.duplicate": "Duplik\xE1l\xE1s",
  "gds.action.check": "Jel\xF6l\xE9s",
  "gds.action.uncheck": "Jel\xF6l\xE9s t\xF6rl\xE9se",
  "gds.action.complete": "K\xE9sz",
  "gds.action.clear": "Ki\xFCr\xEDt\xE9s",
  "gds.action.capture": "Felv\xE9tel",
  "gds.action.record": "R\xF6gz\xEDt\xE9s",
  "gds.action.flip": "Ford\xEDt\xE1s",
  "gds.action.flash": "Vaku",
  "gds.action.course": "Tanfolyam",
  "gds.action.lesson": "Lecke",
  "gds.action.certificate": "Tan\xFAs\xEDtv\xE1ny",
  "gds.action.student": "Tanul\xF3",
  "gds.action.class": "Oszt\xE1ly",
  "gds.action.grade": "Oszt\xE1lyzat",
  "gds.action.child": "Gyermek",
  "gds.action.family": "Csal\xE1d",
  "gds.action.habit": "Szok\xE1s",
  "gds.action.goal": "C\xE9l",
  "gds.action.streak": "Sorozat",
  "gds.action.reward": "Jutalom",
  "gds.action.trophy": "Tr\xF3fea",
  "gds.action.crown": "Korona",
  "gds.action.pause": "Sz\xFCnet",
  "gds.action.message": "\xDCzenet",
  "gds.action.mail": "Lev\xE9l",
  "gds.action.refresh": "Friss\xEDt\xE9s",
  "gds.action.trendingUp": "N\xF6vekv\u0151 trend",
  "gds.action.trendingDown": "Cs\xF6kken\u0151 trend",
  "gds.action.currency": "P\xE9nznem",
  "gds.action.grid": "R\xE1cs",
  "gds.action.list": "Lista",
  "gds.action.logout": "Kijelentkez\xE9s",
  "gds.action.notifications": "\xC9rtes\xEDt\xE9sek",
  "gds.action.back": "Vissza",
  "gds.action.eye": "Megtekint\xE9s",
  "gds.action.eyeOff": "Elrejt\xE9s",
  "gds.action.help": "S\xFAg\xF3",
  "gds.action.filter": "Sz\u0171r\u0151",
  "gds.action.sort": "Rendez\xE9s",
  "gds.action.export": "Export\xE1l\xE1s",
  "gds.action.import": "Import\xE1l\xE1s",
  "gds.action.preview": "El\u0151n\xE9zet",
  "gds.action.clone": "Kl\xF3noz\xE1s",
  "gds.action.restore": "Vissza\xE1ll\xEDt\xE1s",
  "gds.action.toggle": "V\xE1lt\xE1s",
  "gds.action.search": "Keres\xE9s",
  "gds.action.submit": "K\xFCld\xE9s",
  "gds.action.reset": "Alaphelyzet",
  "gds.action.login": "Bejelentkez\xE9s",
  "gds.action.register": "Regisztr\xE1ci\xF3",
  "gds.action.verify": "Ellen\u0151rz\xE9s",
  "gds.action.launch": "Ind\xEDt\xE1s",
  "gds.action.draft": "Piszkozat",
  "gds.action.refer": "Aj\xE1nl\xE1s",
  "gds.action.evidence": "Bizony\xEDt\xE9k",
  "gds.feedback.saved": "Mentve",
  "gds.feedback.error": "Hiba t\xF6rt\xE9nt",
  "gds.feedback.added": "Hozz\xE1adva",
  "gds.feedback.edited": "Szerkesztve",
  "gds.feedback.deleted": "T\xF6r\xF6lve",
  "gds.feedback.canceled": "Megszak\xEDtva",
  "gds.feedback.confirmed": "Meger\u0151s\xEDtve",
  "gds.feedback.closed": "Bez\xE1rva",
  "gds.feedback.changed": "Megv\xE1ltoztatva",
  "gds.feedback.loaded": "Bet\xF6ltve",
  "gds.feedback.started": "Elind\xEDtva",
  "gds.feedback.opened": "Megnyitva",
  "gds.feedback.sent": "Elk\xFCldve",
  "gds.feedback.replied": "Megv\xE1laszolva",
  "gds.feedback.forwarded": "Tov\xE1bb\xEDtva",
  "gds.feedback.attached": "Csatolva",
  "gds.feedback.uploaded": "Felt\xF6ltve",
  "gds.feedback.downloaded": "Let\xF6ltve",
  "gds.feedback.printed": "Kinyomtatva",
  "gds.feedback.copied": "M\xE1solva",
  "gds.feedback.duplicated": "Duplik\xE1lva",
  "gds.feedback.checked": "Kijel\xF6lve",
  "gds.feedback.unchecked": "Kijel\xF6l\xE9s t\xF6r\xF6lve",
  "gds.feedback.completed": "Befejezve",
  "gds.feedback.cleared": "Ki\xFCr\xEDtve",
  "gds.feedback.captured": "R\xF6gz\xEDtve",
  "gds.feedback.recorded": "Felv\xE9ve",
  "gds.feedback.flipped": "Megford\xEDtva",
  "gds.feedback.flashed": "Villantva",
  "gds.feedback.done": "K\xE9sz",
  "gds.feedback.rewarded": "Jutalmazva",
  "gds.feedback.paused": "Sz\xFCneteltetve",
  "gds.feedback.mailed": "Elk\xFCldve",
  "gds.feedback.refreshed": "Friss\xEDtve",
  "gds.feedback.loggedOut": "Kijelentkezve",
  "gds.feedback.filtered": "Sz\u0171rve",
  "gds.feedback.sorted": "Rendezve",
  "gds.feedback.exported": "Export\xE1lva",
  "gds.feedback.imported": "Import\xE1lva",
  "gds.feedback.previewed": "El\u0151n\xE9zet bet\xF6ltve",
  "gds.feedback.cloned": "Kl\xF3nozva",
  "gds.feedback.restored": "Vissza\xE1ll\xEDtva",
  "gds.feedback.toggled": "\xC1tv\xE1ltva",
  "gds.feedback.searched": "Keresve",
  "gds.feedback.submitted": "Elk\xFCldve",
  "gds.feedback.reset": "Alaphelyzetbe \xE1ll\xEDtva",
  "gds.feedback.loggedIn": "Bejelentkezve",
  "gds.feedback.registered": "Regisztr\xE1lva",
  "gds.feedback.verified": "Ellen\u0151rizve",
  "gds.feedback.launched": "Elind\xEDtva",
  "gds.feedback.drafted": "L\xE9trehozva",
  "gds.feedback.referred": "Aj\xE1nlva",
  "gds.aria.themeToggle": "Sz\xEDns\xE9ma v\xE1lt\xE1sa",
  "gds.state.emptyData": "Nincs el\xE9rhet\u0151 adat."
};

// src/locales/it.ts
var it = {
  "gds.action.settings": "Impostazioni",
  "gds.action.analytics": "Analitica",
  "gds.action.dashboard": "Dashboard",
  "gds.action.play": "Riproduci",
  "gds.action.start": "Inizia",
  "gds.action.users": "Utenti",
  "gds.action.add": "Aggiungi",
  "gds.action.edit": "Modifica",
  "gds.action.delete": "Elimina",
  "gds.action.save": "Salva",
  "gds.action.cancel": "Annulla",
  "gds.action.confirm": "Conferma",
  "gds.action.close": "Chiudi",
  "gds.action.language": "Lingua",
  "gds.action.theme": "Tema",
  "gds.action.home": "Home",
  "gds.action.inbox": "Posta in arrivo",
  "gds.action.calendar": "Calendario",
  "gds.action.gallery": "Galleria",
  "gds.action.history": "Cronologia",
  "gds.action.profile": "Profilo",
  "gds.action.send": "Invia",
  "gds.action.reply": "Rispondi",
  "gds.action.forward": "Inoltra",
  "gds.action.attach": "Allega",
  "gds.action.upload": "Carica",
  "gds.action.download": "Scarica",
  "gds.action.print": "Stampa",
  "gds.action.copy": "Copia",
  "gds.action.duplicate": "Duplica",
  "gds.action.check": "Seleziona",
  "gds.action.uncheck": "Deseleziona",
  "gds.action.complete": "Completa",
  "gds.action.clear": "Pulisci",
  "gds.action.capture": "Cattura",
  "gds.action.record": "Registra",
  "gds.action.flip": "Capovolgi",
  "gds.action.flash": "Flash",
  "gds.action.course": "Corso",
  "gds.action.lesson": "Lezione",
  "gds.action.certificate": "Certificato",
  "gds.action.student": "Studente",
  "gds.action.class": "Classe",
  "gds.action.grade": "Voto",
  "gds.action.child": "Bambino",
  "gds.action.family": "Famiglia",
  "gds.action.habit": "Abitudine",
  "gds.action.goal": "Obiettivo",
  "gds.action.streak": "Serie",
  "gds.action.reward": "Ricompensa",
  "gds.action.trophy": "Trofeo",
  "gds.action.crown": "Corona",
  "gds.action.pause": "Pausa",
  "gds.action.message": "Messaggio",
  "gds.action.mail": "Posta",
  "gds.action.refresh": "Aggiorna",
  "gds.action.trendingUp": "In crescita",
  "gds.action.trendingDown": "In calo",
  "gds.action.currency": "Valuta",
  "gds.action.grid": "Griglia",
  "gds.action.list": "Elenco",
  "gds.action.logout": "Esci",
  "gds.action.notifications": "Notifiche",
  "gds.action.back": "Indietro",
  "gds.action.eye": "Mostra",
  "gds.action.eyeOff": "Nascondi",
  "gds.action.help": "Aiuto",
  "gds.action.filter": "Filtra",
  "gds.action.sort": "Ordina",
  "gds.action.export": "Esporta",
  "gds.action.import": "Importa",
  "gds.action.preview": "Anteprima",
  "gds.action.clone": "Clona",
  "gds.action.restore": "Ripristina",
  "gds.action.toggle": "Attiva/Disattiva",
  "gds.action.search": "Cerca",
  "gds.action.submit": "Invia",
  "gds.action.reset": "Reimposta",
  "gds.action.login": "Accedi",
  "gds.action.register": "Registrati",
  "gds.action.verify": "Verifica",
  "gds.action.launch": "Avvia",
  "gds.action.draft": "Bozza",
  "gds.action.refer": "Segnala",
  "gds.action.evidence": "Prova",
  "gds.feedback.saved": "Salvato",
  "gds.feedback.error": "Si \xE8 verificato un errore",
  "gds.feedback.added": "Aggiunto",
  "gds.feedback.edited": "Modificato",
  "gds.feedback.deleted": "Eliminato",
  "gds.feedback.canceled": "Annullato",
  "gds.feedback.confirmed": "Confermato",
  "gds.feedback.closed": "Chiuso",
  "gds.feedback.changed": "Cambiato",
  "gds.feedback.loaded": "Caricato",
  "gds.feedback.started": "Iniziato",
  "gds.feedback.opened": "Aperto",
  "gds.feedback.sent": "Inviato",
  "gds.feedback.replied": "Risposto",
  "gds.feedback.forwarded": "Inoltrato",
  "gds.feedback.attached": "Allegato",
  "gds.feedback.uploaded": "Caricato",
  "gds.feedback.downloaded": "Scaricato",
  "gds.feedback.printed": "Stampato",
  "gds.feedback.copied": "Copiato",
  "gds.feedback.duplicated": "Duplicato",
  "gds.feedback.checked": "Selezionato",
  "gds.feedback.unchecked": "Deselezionato",
  "gds.feedback.completed": "Completato",
  "gds.feedback.cleared": "Svuotato",
  "gds.feedback.captured": "Catturato",
  "gds.feedback.recorded": "Registrato",
  "gds.feedback.flipped": "Capovolto",
  "gds.feedback.flashed": "Lampeggiato",
  "gds.feedback.done": "Fatto",
  "gds.feedback.rewarded": "Premiato",
  "gds.feedback.paused": "In pausa",
  "gds.feedback.mailed": "Inviato",
  "gds.feedback.refreshed": "Aggiornato",
  "gds.feedback.loggedOut": "Disconnesso",
  "gds.feedback.filtered": "Filtrato",
  "gds.feedback.sorted": "Ordinato",
  "gds.feedback.exported": "Esportato",
  "gds.feedback.imported": "Importato",
  "gds.feedback.previewed": "Visualizzato",
  "gds.feedback.cloned": "Clonato",
  "gds.feedback.restored": "Ripristinato",
  "gds.feedback.toggled": "Attivato",
  "gds.feedback.searched": "Cercato",
  "gds.feedback.submitted": "Inviato",
  "gds.feedback.reset": "Reimpostato",
  "gds.feedback.loggedIn": "Accesso effettuato",
  "gds.feedback.registered": "Registrato",
  "gds.feedback.verified": "Verificato",
  "gds.feedback.launched": "Avviato",
  "gds.feedback.drafted": "Bozza salvata",
  "gds.feedback.referred": "Segnalato",
  "gds.aria.themeToggle": "Cambia schema colori",
  "gds.state.emptyData": "Nessun dato disponibile."
};

// src/locales/ru.ts
var ru = {
  "gds.action.settings": "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438",
  "gds.action.analytics": "\u0410\u043D\u0430\u043B\u0438\u0442\u0438\u043A\u0430",
  "gds.action.dashboard": "\u041F\u0430\u043D\u0435\u043B\u044C",
  "gds.action.play": "\u0412\u043E\u0441\u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0441\u0442\u0438",
  "gds.action.start": "\u0421\u0442\u0430\u0440\u0442",
  "gds.action.users": "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0438",
  "gds.action.add": "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C",
  "gds.action.edit": "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C",
  "gds.action.delete": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C",
  "gds.action.save": "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C",
  "gds.action.cancel": "\u041E\u0442\u043C\u0435\u043D\u0430",
  "gds.action.confirm": "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C",
  "gds.action.close": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C",
  "gds.action.language": "\u042F\u0437\u044B\u043A",
  "gds.action.theme": "\u0422\u0435\u043C\u0430",
  "gds.action.home": "\u0413\u043B\u0430\u0432\u043D\u0430\u044F",
  "gds.action.inbox": "\u0412\u0445\u043E\u0434\u044F\u0449\u0438\u0435",
  "gds.action.calendar": "\u041A\u0430\u043B\u0435\u043D\u0434\u0430\u0440\u044C",
  "gds.action.gallery": "\u0413\u0430\u043B\u0435\u0440\u0435\u044F",
  "gds.action.history": "\u0418\u0441\u0442\u043E\u0440\u0438\u044F",
  "gds.action.profile": "\u041F\u0440\u043E\u0444\u0438\u043B\u044C",
  "gds.action.send": "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C",
  "gds.action.reply": "\u041E\u0442\u0432\u0435\u0442\u0438\u0442\u044C",
  "gds.action.forward": "\u041F\u0435\u0440\u0435\u0441\u043B\u0430\u0442\u044C",
  "gds.action.attach": "\u041F\u0440\u0438\u043A\u0440\u0435\u043F\u0438\u0442\u044C",
  "gds.action.upload": "\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C",
  "gds.action.download": "\u0421\u043A\u0430\u0447\u0430\u0442\u044C",
  "gds.action.print": "\u041F\u0435\u0447\u0430\u0442\u044C",
  "gds.action.copy": "\u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
  "gds.action.duplicate": "\u0414\u0443\u0431\u043B\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
  "gds.action.check": "\u041E\u0442\u043C\u0435\u0442\u0438\u0442\u044C",
  "gds.action.uncheck": "\u0421\u043D\u044F\u0442\u044C \u043E\u0442\u043C\u0435\u0442\u043A\u0443",
  "gds.action.complete": "\u0417\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044C",
  "gds.action.clear": "\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C",
  "gds.action.capture": "\u0421\u043D\u044F\u0442\u044C",
  "gds.action.record": "\u0417\u0430\u043F\u0438\u0441\u044C",
  "gds.action.flip": "\u041F\u0435\u0440\u0435\u0432\u0435\u0440\u043D\u0443\u0442\u044C",
  "gds.action.flash": "\u0412\u0441\u043F\u044B\u0448\u043A\u0430",
  "gds.action.course": "\u041A\u0443\u0440\u0441",
  "gds.action.lesson": "\u0423\u0440\u043E\u043A",
  "gds.action.certificate": "\u0421\u0435\u0440\u0442\u0438\u0444\u0438\u043A\u0430\u0442",
  "gds.action.student": "\u0421\u0442\u0443\u0434\u0435\u043D\u0442",
  "gds.action.class": "\u041A\u043B\u0430\u0441\u0441",
  "gds.action.grade": "\u041E\u0446\u0435\u043D\u043A\u0430",
  "gds.action.child": "\u0420\u0435\u0431\u0435\u043D\u043E\u043A",
  "gds.action.family": "\u0421\u0435\u043C\u044C\u044F",
  "gds.action.habit": "\u041F\u0440\u0438\u0432\u044B\u0447\u043A\u0430",
  "gds.action.goal": "\u0426\u0435\u043B\u044C",
  "gds.action.streak": "\u0421\u0435\u0440\u0438\u044F",
  "gds.action.reward": "\u041D\u0430\u0433\u0440\u0430\u0434\u0430",
  "gds.action.trophy": "\u0422\u0440\u043E\u0444\u0435\u0439",
  "gds.action.crown": "\u041A\u043E\u0440\u043E\u043D\u0430",
  "gds.action.pause": "\u041F\u0430\u0443\u0437\u0430",
  "gds.action.message": "\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435",
  "gds.action.mail": "\u041F\u043E\u0447\u0442\u0430",
  "gds.action.refresh": "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C",
  "gds.action.trendingUp": "\u0422\u0435\u043D\u0434\u0435\u043D\u0446\u0438\u044F \u0432\u0432\u0435\u0440\u0445",
  "gds.action.trendingDown": "\u0422\u0435\u043D\u0434\u0435\u043D\u0446\u0438\u044F \u0432\u043D\u0438\u0437",
  "gds.action.currency": "\u0412\u0430\u043B\u044E\u0442\u0430",
  "gds.action.grid": "\u0421\u0435\u0442\u043A\u0430",
  "gds.action.list": "\u0421\u043F\u0438\u0441\u043E\u043A",
  "gds.action.logout": "\u0412\u044B\u0439\u0442\u0438",
  "gds.action.notifications": "\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F",
  "gds.action.back": "\u041D\u0430\u0437\u0430\u0434",
  "gds.action.eye": "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C",
  "gds.action.eyeOff": "\u0421\u043A\u0440\u044B\u0442\u044C",
  "gds.action.help": "\u041F\u043E\u043C\u043E\u0449\u044C",
  "gds.action.filter": "\u0424\u0438\u043B\u044C\u0442\u0440",
  "gds.action.sort": "\u0421\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u043A\u0430",
  "gds.action.export": "\u042D\u043A\u0441\u043F\u043E\u0440\u0442",
  "gds.action.import": "\u0418\u043C\u043F\u043E\u0440\u0442",
  "gds.action.preview": "\u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440",
  "gds.action.clone": "\u041A\u043B\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
  "gds.action.restore": "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C",
  "gds.action.toggle": "\u041F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0438\u0442\u044C",
  "gds.action.search": "\u041F\u043E\u0438\u0441\u043A",
  "gds.action.submit": "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C",
  "gds.action.reset": "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C",
  "gds.action.login": "\u0412\u043E\u0439\u0442\u0438",
  "gds.action.register": "\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044F",
  "gds.action.verify": "\u041F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C",
  "gds.action.launch": "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C",
  "gds.action.draft": "\u0427\u0435\u0440\u043D\u043E\u0432\u0438\u043A",
  "gds.action.refer": "\u041D\u0430\u043F\u0440\u0430\u0432\u0438\u0442\u044C",
  "gds.action.evidence": "\u0414\u043E\u043A\u0430\u0437\u0430\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E",
  "gds.feedback.saved": "\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E",
  "gds.feedback.error": "\u0427\u0442\u043E-\u0442\u043E \u043F\u043E\u0448\u043B\u043E \u043D\u0435 \u0442\u0430\u043A",
  "gds.feedback.added": "\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E",
  "gds.feedback.edited": "\u0418\u0437\u043C\u0435\u043D\u0435\u043D\u043E",
  "gds.feedback.deleted": "\u0423\u0434\u0430\u043B\u0435\u043D\u043E",
  "gds.feedback.canceled": "\u041E\u0442\u043C\u0435\u043D\u0435\u043D\u043E",
  "gds.feedback.confirmed": "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u043E",
  "gds.feedback.closed": "\u0417\u0430\u043A\u0440\u044B\u0442\u043E",
  "gds.feedback.changed": "\u0418\u0437\u043C\u0435\u043D\u0435\u043D\u043E",
  "gds.feedback.loaded": "\u0417\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043E",
  "gds.feedback.started": "\u041D\u0430\u0447\u0430\u0442\u043E",
  "gds.feedback.opened": "\u041E\u0442\u043A\u0440\u044B\u0442\u043E",
  "gds.feedback.sent": "\u041E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E",
  "gds.feedback.replied": "\u041E\u0442\u0432\u0435\u0447\u0435\u043D\u043E",
  "gds.feedback.forwarded": "\u041F\u0435\u0440\u0435\u0441\u043B\u0430\u043D\u043E",
  "gds.feedback.attached": "\u041F\u0440\u0438\u043A\u0440\u0435\u043F\u043B\u0435\u043D\u043E",
  "gds.feedback.uploaded": "\u0417\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043E",
  "gds.feedback.downloaded": "\u0421\u043A\u0430\u0447\u0430\u043D\u043E",
  "gds.feedback.printed": "\u0420\u0430\u0441\u043F\u0435\u0447\u0430\u0442\u0430\u043D\u043E",
  "gds.feedback.copied": "\u0421\u043A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u043D\u043E",
  "gds.feedback.duplicated": "\u0414\u0443\u0431\u043B\u0438\u0440\u043E\u0432\u0430\u043D\u043E",
  "gds.feedback.checked": "\u041E\u0442\u043C\u0435\u0447\u0435\u043D\u043E",
  "gds.feedback.unchecked": "\u041E\u0442\u043C\u0435\u0442\u043A\u0430 \u0441\u043D\u044F\u0442\u0430",
  "gds.feedback.completed": "\u0417\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E",
  "gds.feedback.cleared": "\u041E\u0447\u0438\u0449\u0435\u043D\u043E",
  "gds.feedback.captured": "\u0421\u043D\u044F\u0442\u043E",
  "gds.feedback.recorded": "\u0417\u0430\u043F\u0438\u0441\u0430\u043D\u043E",
  "gds.feedback.flipped": "\u041F\u0435\u0440\u0435\u0432\u0435\u0440\u043D\u0443\u0442\u043E",
  "gds.feedback.flashed": "\u0412\u0441\u043F\u044B\u0448\u043A\u0430",
  "gds.feedback.done": "\u0413\u043E\u0442\u043E\u0432\u043E",
  "gds.feedback.rewarded": "\u041D\u0430\u0433\u0440\u0430\u0436\u0434\u0435\u043D\u043E",
  "gds.feedback.paused": "\u041F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E",
  "gds.feedback.mailed": "\u041E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E",
  "gds.feedback.refreshed": "\u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u043E",
  "gds.feedback.loggedOut": "\u0412\u044B\u0448\u0435\u043B",
  "gds.feedback.filtered": "\u041E\u0442\u0444\u0438\u043B\u044C\u0442\u0440\u043E\u0432\u0430\u043D\u043E",
  "gds.feedback.sorted": "\u041E\u0442\u0441\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043E",
  "gds.feedback.exported": "\u042D\u043A\u0441\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043E",
  "gds.feedback.imported": "\u0418\u043C\u043F\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043E",
  "gds.feedback.previewed": "\u041F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u043E",
  "gds.feedback.cloned": "\u041A\u043B\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u043E",
  "gds.feedback.restored": "\u0412\u043E\u0441\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043E",
  "gds.feedback.toggled": "\u041F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0435\u043D\u043E",
  "gds.feedback.searched": "\u041D\u0430\u0439\u0434\u0435\u043D\u043E",
  "gds.feedback.submitted": "\u041E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E",
  "gds.feedback.reset": "\u0421\u0431\u0440\u043E\u0448\u0435\u043D\u043E",
  "gds.feedback.loggedIn": "\u0412\u0445\u043E\u0434 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D",
  "gds.feedback.registered": "\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u043E",
  "gds.feedback.verified": "\u041F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u043E",
  "gds.feedback.launched": "\u0417\u0430\u043F\u0443\u0449\u0435\u043D\u043E",
  "gds.feedback.drafted": "\u0427\u0435\u0440\u043D\u043E\u0432\u0438\u043A \u0441\u043E\u0437\u0434\u0430\u043D",
  "gds.feedback.referred": "\u041D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E",
  "gds.aria.themeToggle": "\u041F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0446\u0432\u0435\u0442\u043E\u0432\u0443\u044E \u0441\u0445\u0435\u043C\u0443",
  "gds.state.emptyData": "\u041D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445."
};

// src/locales/index.ts
var gdsLocales = {
  en,
  es,
  hu,
  de,
  fr,
  it,
  ru,
  he,
  ar
};
function getGdsMessages(locale) {
  return gdsLocales[locale] ?? en;
}

export {
  StatusBadge,
  EmptyState,
  GdsIcons,
  GdsVocabulary,
  MetricCard,
  ProgressCard,
  ProductCard,
  PublicProductCard,
  resolveAccentPanelStyles,
  AccentPanel,
  StateBlock,
  DataToolbar,
  PublicNav,
  PublicShell,
  PublicSiteFooter,
  PublicBrandFooter,
  AuthShell,
  ArticleShell,
  CtaButtonGroup,
  DocsPageShell,
  EditorialHero,
  FeatureBand,
  MediaCard,
  AccessSummary,
  FormField,
  PageHeader,
  FilterDrawer,
  PlaceholderPanel,
  SimpleDataTable,
  StatsSection,
  ar,
  de,
  en,
  es,
  fr,
  he,
  hu,
  it,
  ru,
  gdsLocales,
  getGdsMessages
};

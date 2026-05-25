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
  AccentPanel: () => AccentPanel,
  AccessRecoveryPanel: () => AccessRecoveryPanel,
  AccessSummary: () => AccessSummary,
  ArticleShell: () => ArticleShell,
  AuthShell: () => AuthShell,
  ConfirmDialog: () => ConfirmDialog,
  CtaButtonGroup: () => CtaButtonGroup,
  DataToolbar: () => DataToolbar,
  DocsCodeBlock: () => DocsCodeBlock,
  DocsPageShell: () => DocsPageShell,
  EditorialHero: () => EditorialHero,
  EmptyState: () => EmptyState,
  FeatureBand: () => FeatureBand,
  FilterDrawer: () => FilterDrawer,
  FormField: () => FormField,
  GameBoardTile: () => GameBoardTile,
  GdsIcons: () => GdsIcons,
  GdsVocabulary: () => GdsVocabulary,
  MediaCard: () => MediaCard,
  MetricCard: () => MetricCard,
  PageHeader: () => PageHeader,
  PlaceholderPanel: () => PlaceholderPanel,
  ProductCard: () => ProductCard,
  ProgressCard: () => ProgressCard,
  PublicBrandFooter: () => PublicBrandFooter,
  PublicNav: () => PublicNav,
  PublicProductCard: () => PublicProductCard,
  PublicShell: () => PublicShell,
  PublicSiteFooter: () => PublicSiteFooter,
  SemanticButton: () => SemanticButton,
  SimpleDataTable: () => SimpleDataTable,
  StateBlock: () => StateBlock,
  StatsSection: () => StatsSection,
  StatusBadge: () => StatusBadge,
  ThemeToggle: () => ThemeToggle,
  UploadDropzone: () => UploadDropzone,
  ar: () => ar,
  de: () => de,
  en: () => en,
  es: () => es,
  fr: () => fr,
  gdsLocales: () => gdsLocales,
  getGdsMessages: () => getGdsMessages,
  he: () => he,
  hu: () => hu,
  it: () => it,
  resolveAccentPanelStyles: () => resolveAccentPanelStyles,
  ru: () => ru
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
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_core2.Stack, { align: "center", justify: "center", gap: "md", py: "xl", ta: "center", children: [
    icon && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_core2.Box, { c: "dimmed", children: icon }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_core2.Title, { order: 3, children: title }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_core2.Text, { c: "dimmed", maw: 400, children: description }),
    action && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(import_core2.Box, { mt: "md", children: action })
  ] });
}

// src/ConfirmDialog.tsx
var import_core4 = require("@mantine/core");

// src/SemanticButton.tsx
var import_react = require("react");
var import_core3 = require("@mantine/core");
var import_theme = require("@gds/theme");
var import_icons_react2 = require("@tabler/icons-react");

// src/icons.ts
var import_icons_react = require("@tabler/icons-react");
var GdsIcons = {
  // Navigation
  Dashboard: import_icons_react.IconDashboard,
  Settings: import_icons_react.IconSettings,
  Users: import_icons_react.IconUsers,
  Analytics: import_icons_react.IconChartBar,
  Home: import_icons_react.IconHome,
  Inbox: import_icons_react.IconInbox,
  Calendar: import_icons_react.IconCalendar,
  Gallery: import_icons_react.IconPhoto,
  History: import_icons_react.IconHistory,
  Profile: import_icons_react.IconUser,
  // Actions
  Add: import_icons_react.IconPlus,
  Edit: import_icons_react.IconEdit,
  Delete: import_icons_react.IconTrash,
  Search: import_icons_react.IconSearch,
  Save: import_icons_react.IconDeviceFloppy,
  Play: import_icons_react.IconPlayerPlay,
  Start: import_icons_react.IconRocket,
  Send: import_icons_react.IconSend,
  Reply: import_icons_react.IconArrowBackUp,
  Forward: import_icons_react.IconArrowForwardUp,
  Attach: import_icons_react.IconPaperclip,
  Upload: import_icons_react.IconUpload,
  Download: import_icons_react.IconDownload,
  Print: import_icons_react.IconPrinter,
  Copy: import_icons_react.IconCopy,
  Duplicate: import_icons_react.IconCopyPlus,
  Check: import_icons_react.IconSquareCheck,
  Uncheck: import_icons_react.IconSquareX,
  Complete: import_icons_react.IconChecks,
  Clear: import_icons_react.IconClearAll,
  Cancel: import_icons_react.IconBan,
  Confirm: import_icons_react.IconThumbUp,
  Close: import_icons_react.IconX,
  // Preferences & System
  Language: import_icons_react.IconLanguage,
  Theme: import_icons_react.IconPalette,
  // Media
  Capture: import_icons_react.IconCamera,
  Record: import_icons_react.IconVideo,
  Flip: import_icons_react.IconCameraRotate,
  Flash: import_icons_react.IconBolt,
  // Domain specific
  Course: import_icons_react.IconBook,
  Lesson: import_icons_react.IconNotebook,
  Certificate: import_icons_react.IconCertificate,
  Student: import_icons_react.IconSchool,
  Class: import_icons_react.IconBooks,
  Grade: import_icons_react.IconAward,
  Child: import_icons_react.IconMoodKid,
  Family: import_icons_react.IconUsersGroup,
  Habit: import_icons_react.IconTarget,
  Goal: import_icons_react.IconFlag,
  Streak: import_icons_react.IconFlame,
  Reward: import_icons_react.IconGift,
  // Feedback
  Success: import_icons_react.IconCheck,
  Warning: import_icons_react.IconAlertTriangle,
  Danger: import_icons_react.IconAlertCircle,
  Info: import_icons_react.IconInfoCircle,
  // Analysis additions
  Trophy: import_icons_react.IconTrophy,
  Crown: import_icons_react.IconCrown,
  Pause: import_icons_react.IconPlayerPause,
  Message: import_icons_react.IconMessage,
  Mail: import_icons_react.IconMail,
  Refresh: import_icons_react.IconRefresh,
  TrendingUp: import_icons_react.IconTrendingUp,
  TrendingDown: import_icons_react.IconTrendingDown,
  Currency: import_icons_react.IconCurrencyDollar,
  Grid: import_icons_react.IconLayoutGrid,
  List: import_icons_react.IconList,
  Logout: import_icons_react.IconDoorExit,
  Notifications: import_icons_react.IconBell,
  Back: import_icons_react.IconArrowLeft,
  Eye: import_icons_react.IconEye,
  EyeOff: import_icons_react.IconEyeOff,
  Help: import_icons_react.IconHelpCircle,
  Filter: import_icons_react.IconFilter,
  Sort: import_icons_react.IconArrowsSort,
  // New Audit-driven additions
  Export: import_icons_react.IconFileExport,
  Import: import_icons_react.IconFileImport,
  Preview: import_icons_react.IconEye,
  Clone: import_icons_react.IconCopy,
  Restore: import_icons_react.IconTrashOff,
  Toggle: import_icons_react.IconToggleLeft,
  Submit: import_icons_react.IconCheck,
  Reset: import_icons_react.IconRefresh,
  Login: import_icons_react.IconLogin,
  Register: import_icons_react.IconUserPlus,
  Verify: import_icons_react.IconShieldCheck,
  Launch: import_icons_react.IconRocket,
  Draft: import_icons_react.IconFileText,
  Refer: import_icons_react.IconShare,
  Evidence: import_icons_react.IconPaperclip,
  // System
  ChevronDown: import_icons_react.IconChevronDown,
  ChevronUp: import_icons_react.IconChevronUp,
  Menu: import_icons_react.IconMenu2,
  Moon: import_icons_react.IconMoon,
  Sun: import_icons_react.IconSun
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

// src/SemanticButton.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function SemanticButton({ action, loading, feedbackState, feedbackText, ...props }) {
  const { t } = (0, import_theme.useGdsTranslation)();
  const config = GdsVocabulary[action];
  const [internalFeedback, setInternalFeedback] = (0, import_react.useState)(null);
  (0, import_react.useEffect)(() => {
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
    const defaultFeedback = "feedback" in config && config.feedback ? config.feedback : { icon: import_icons_react2.IconCheck, color: "teal", messageId: "gds.feedback.saved" };
    Icon = defaultFeedback.icon;
    label = feedbackText || t(defaultFeedback.messageId, "Success");
    color = defaultFeedback.color;
  } else if (internalFeedback === "error") {
    Icon = import_icons_react2.IconX;
    label = feedbackText || t("gds.feedback.error", "Something went wrong");
    color = "red";
  }
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    import_core3.Button,
    {
      leftSection: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Icon, { size: "1rem" }),
      loading,
      color,
      ...props,
      children: label
    }
  );
}

// src/ConfirmDialog.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
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
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_core4.Modal, { opened, onClose, title, centered: true, trapFocus: true, children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(import_core4.Text, { size: "sm", mb: "xl", children }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_core4.Group, { justify: "flex-end", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SemanticButton, { action: cancelAction, variant: "default", onClick: onClose, disabled: loading }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(SemanticButton, { action: confirmAction, color: isDanger ? "red" : "violet", onClick: onConfirm, loading })
    ] })
  ] });
}

// src/ThemeToggle.tsx
var import_core5 = require("@mantine/core");
var import_theme2 = require("@gds/theme");
var import_jsx_runtime5 = require("react/jsx-runtime");
function ThemeToggle({ size = "md" }) {
  const { setColorScheme } = (0, import_core5.useMantineColorScheme)();
  const computedColorScheme = (0, import_core5.useComputedColorScheme)("light", { getInitialValueInEffect: true });
  const { t } = (0, import_theme2.useGdsTranslation)();
  const toggleColorScheme = () => {
    setColorScheme(computedColorScheme === "dark" ? "light" : "dark");
  };
  const isDark = computedColorScheme === "dark";
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
    import_core5.ActionIcon,
    {
      onClick: toggleColorScheme,
      variant: "default",
      size,
      "aria-label": t("gds.aria.themeToggle", "Toggle color scheme"),
      children: isDark ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(GdsIcons.Sun, { size: "1.2rem" }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(GdsIcons.Moon, { size: "1.2rem" })
    }
  );
}

// src/MetricCard.tsx
var import_core6 = require("@mantine/core");
var import_jsx_runtime6 = require("react/jsx-runtime");
var trendColors = {
  positive: "teal",
  negative: "red",
  neutral: "gray"
};
function MetricCard({ label, value, description, trend, icon, footer }) {
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_core6.Card, { withBorder: true, radius: "lg", padding: "lg", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_core6.Stack, { gap: "md", children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_core6.Group, { justify: "space-between", align: "flex-start", wrap: "nowrap", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_core6.Stack, { gap: 4, children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_core6.Text, { size: "sm", c: "dimmed", fw: 600, children: label }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_core6.Title, { order: 3, children: value })
      ] }),
      icon ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_core6.ThemeIcon, { variant: "light", size: "xl", radius: "xl", "aria-hidden": true, children: icon }) : null
    ] }),
    description || trend ? /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)(import_core6.Group, { justify: "space-between", align: "center", gap: "sm", children: [
      description ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_core6.Text, { size: "sm", c: "dimmed", flex: 1, children: description }) : /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", {}),
      trend ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(import_core6.Badge, { color: trendColors[trend.tone ?? "neutral"], variant: "light", children: trend.label }) : null
    ] }) : null,
    footer
  ] }) });
}

// src/ProgressCard.tsx
var import_core7 = require("@mantine/core");
var import_jsx_runtime7 = require("react/jsx-runtime");
function ProgressCard({
  label,
  value,
  progress,
  progressLabel,
  description,
  action
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_core7.Card, { withBorder: true, radius: "lg", padding: "lg", children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_core7.Stack, { gap: "md", children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_core7.Group, { justify: "space-between", align: "flex-start", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_core7.Stack, { gap: 4, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_core7.Text, { size: "sm", c: "dimmed", fw: 600, children: label }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_core7.Title, { order: 3, children: value })
      ] }),
      action
    ] }),
    description ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_core7.Text, { size: "sm", c: "dimmed", children: description }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_core7.Stack, { gap: 6, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_core7.Group, { justify: "space-between", gap: "sm", children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_core7.Text, { size: "sm", fw: 500, children: progressLabel ?? "Progress" }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(import_core7.Text, { size: "sm", c: "dimmed", children: [
          Math.round(progress),
          "%"
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(import_core7.Progress, { value: progress, radius: "xl", size: "md" })
    ] })
  ] }) });
}

// src/GameBoardTile.tsx
var import_core8 = require("@mantine/core");
var import_hooks = require("@mantine/hooks");
var import_jsx_runtime8 = require("react/jsx-runtime");
function GameBoardTile({
  face,
  revealed,
  matched,
  disabled,
  onPress,
  highlightColor
}) {
  const theme = (0, import_core8.useMantineTheme)();
  const reduceMotion = (0, import_hooks.useMediaQuery)("(prefers-reduced-motion: reduce)");
  const highlighted = revealed && !matched;
  const revealBg = highlightColor ?? (typeof theme.primaryColor === "string" ? `${theme.primaryColor}.5` : "violet.5");
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.UnstyledButton, { w: "100%", disabled, onClick: onPress, "aria-pressed": revealed, children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(
    import_core8.Paper,
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
      children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Center, { h: "100%", children: /* @__PURE__ */ (0, import_jsx_runtime8.jsx)(import_core8.Text, { size: "xl", fw: 700, children: face }) })
    }
  ) });
}

// src/ProductCard.tsx
var import_core9 = require("@mantine/core");
var import_jsx_runtime9 = require("react/jsx-runtime");
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
  return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.Card, { withBorder: true, radius: "lg", padding: "lg", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_core9.Stack, { gap: "md", children: [
    media,
    /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_core9.Group, { justify: "space-between", align: "flex-start", wrap: "nowrap", children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_core9.Group, { align: "flex-start", gap: "sm", wrap: "nowrap", children: [
        icon ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.ThemeIcon, { variant: "light", size: "xl", radius: "xl", "aria-hidden": true, children: icon }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_core9.Stack, { gap: 4, children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.Title, { order: 4, children: title }),
          description ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.Text, { size: "sm", c: "dimmed", lineClamp: 3, children: description }) : null
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_core9.Group, { gap: "xs", align: "center", wrap: "nowrap", children: [
        typeof status === "string" ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.Badge, { variant: "light", children: status }) : status,
        secondaryActions.length ? /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_core9.Menu, { position: "bottom-end", withinPortal: true, children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.Menu.Target, { children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.ActionIcon, { variant: "subtle", "aria-label": "More actions", children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(MoreIcon, { size: "1rem" }) }) }),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.Menu.Dropdown, { children: secondaryActions.map(
            (action) => action.href ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.Menu.Item, { component: "a", href: action.href, color: action.color, children: action.label }, action.label) : /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.Menu.Item, { onClick: action.onClick, color: action.color, children: action.label }, action.label)
          ) })
        ] }) : null
      ] })
    ] }),
    metadata.length ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.Stack, { gap: 6, children: metadata.map((item) => /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)(import_core9.Group, { justify: "space-between", gap: "sm", children: [
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.Text, { size: "sm", c: "dimmed", children: item.label }),
      /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.Text, { size: "sm", fw: 500, ta: "right", children: item.value })
    ] }, item.label)) }) : null,
    primaryAction ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(import_core9.Group, { justify: "space-between", children: primaryAction }) : null,
    footer
  ] }) });
}

// src/PublicProductCard.tsx
var import_react2 = require("react");
var import_core10 = require("@mantine/core");
var import_jsx_runtime10 = require("react/jsx-runtime");
var stateConfig = {
  available: { label: "Available", color: "teal" },
  limited: { label: "Limited", color: "yellow" },
  "sold-out": { label: "Sold out", color: "red" },
  preorder: { label: "Preorder", color: "violet" }
};
function enhanceAction(action, disabled) {
  if (!(0, import_react2.isValidElement)(action)) {
    return action;
  }
  return (0, import_react2.cloneElement)(action, {
    disabled: disabled || Boolean(action.props.disabled),
    "aria-disabled": disabled || void 0
  });
}
function ImageFallback({ compact }) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.AspectRatio, { ratio: compact ? 16 / 9 : 4 / 3, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
    import_core10.ThemeIcon,
    {
      size: "100%",
      radius: "md",
      variant: "light",
      color: "gray",
      "aria-label": "No product image available",
      children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(GdsIcons.Gallery, { size: compact ? "1.5rem" : "2rem" })
    }
  ) });
}
function LoadingCard({ compact }) {
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.Card, { withBorder: true, radius: "lg", padding: compact ? "md" : "lg", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_core10.Stack, { gap: "md", children: [
    /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.AspectRatio, { ratio: compact ? 16 / 9 : 4 / 3, children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.Skeleton, { radius: "md" }) }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_core10.Stack, { gap: "xs", children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.Skeleton, { height: 20, radius: "sm", width: "70%" }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.Skeleton, { height: 14, radius: "sm", width: "100%" }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.Skeleton, { height: 14, radius: "sm", width: "85%" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_core10.Group, { justify: "space-between", align: "center", children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.Skeleton, { height: 18, radius: "sm", width: 72 }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.Skeleton, { height: 36, radius: "md", width: 120 })
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
    return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(LoadingCard, { compact });
  }
  const isActionDisabled = disabled || state === "sold-out";
  const resolvedPrimaryAction = enhanceAction(primaryAction, isActionDisabled);
  const resolvedSecondaryAction = enhanceAction(secondaryAction, disabled);
  const stateBadge = stateConfig[state];
  return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.Card, { withBorder: true, radius: "lg", padding: compact ? "md" : "lg", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_core10.Stack, { gap: compact ? "sm" : "md", children: [
    image ?? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(ImageFallback, { compact }),
    /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_core10.Group, { justify: "space-between", align: "flex-start", wrap: "nowrap", gap: "sm", children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_core10.Stack, { gap: 4, style: { minWidth: 0, flex: 1 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.Title, { order: compact ? 5 : 4, lineClamp: 2, children: title }),
        description ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.Text, { size: "sm", c: "dimmed", lineClamp: compact ? 2 : 3, children: description }) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.Badge, { variant: "light", color: stateBadge.color, children: stateBadge.label })
    ] }),
    price || helperText ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_core10.Group, { justify: "space-between", align: "flex-end", gap: "sm", wrap: "nowrap", children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_core10.Stack, { gap: 2, style: { minWidth: 0, flex: 1 }, children: [
        price ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.Text, { fw: 700, size: compact ? "md" : "lg", children: price }) : null,
        helperText ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.Text, { size: "xs", c: "dimmed", children: helperText }) : null
      ] }),
      resolvedPrimaryAction
    ] }) : resolvedPrimaryAction ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.Group, { justify: "flex-end", children: resolvedPrimaryAction }) : null,
    metadata.length ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.Stack, { gap: 6, children: metadata.map((item) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_core10.Group, { justify: "space-between", gap: "sm", children: [
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.Text, { size: "sm", c: "dimmed", children: item.label }),
      /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.Text, { size: "sm", fw: 500, ta: "right", children: item.value })
    ] }, item.label)) }) : null,
    resolvedSecondaryAction ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_core10.Group, { justify: "flex-end", children: resolvedSecondaryAction }) : null
  ] }) });
}

// src/AccentPanel.tsx
var import_core11 = require("@mantine/core");
var import_jsx_runtime11 = require("react/jsx-runtime");
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
  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_core11.Paper, { withBorder: true, radius: "lg", p: "lg", style: styles, children: /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_core11.Stack, { gap: "sm", children: [
    title || badge ? /* @__PURE__ */ (0, import_jsx_runtime11.jsxs)(import_core11.Group, { justify: "space-between", align: "flex-start", gap: "sm", wrap: "wrap", children: [
      title ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_core11.Title, { order: 4, c: "inherit", children: title }) : /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_core11.Box, {}),
      badge ? typeof badge === "string" ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_core11.Badge, { color: tone === "amber" ? "yellow" : tone, variant: "filled", children: badge }) : badge : null
    ] }) : null,
    typeof children === "string" ? /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_core11.Text, { c: "inherit", children }) : /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(import_core11.Box, { c: "inherit", children })
  ] }) });
}

// src/StateBlock.tsx
var import_core12 = require("@mantine/core");
var import_jsx_runtime12 = require("react/jsx-runtime");
var variantConfig = {
  loading: { color: "violet", icon: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(import_core12.Loader, { size: "sm" }) },
  empty: { color: "gray", icon: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(GdsIcons.Inbox, { size: "1.1rem" }) },
  error: { color: "red", icon: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(GdsIcons.Danger, { size: "1.1rem" }) },
  permission: { color: "orange", icon: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(GdsIcons.Verify, { size: "1.1rem" }) },
  disabled: { color: "gray", icon: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(GdsIcons.Toggle, { size: "1.1rem" }) },
  success: { color: "teal", icon: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(GdsIcons.Success, { size: "1.1rem" }) },
  info: { color: "blue", icon: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(GdsIcons.Info, { size: "1.1rem" }) },
  "not-enough-data": { color: "yellow", icon: /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(GdsIcons.Analytics, { size: "1.1rem" }) }
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
  return /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(
    import_core12.Stack,
    {
      align: compact ? "flex-start" : "center",
      justify: "center",
      gap: "md",
      py: compact ? "md" : "xl",
      ta: compact ? "left" : "center",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(import_core12.ThemeIcon, { variant: "light", color: config.color, size: compact ? "lg" : "xl", radius: "xl", children: icon ?? config.icon }),
        /* @__PURE__ */ (0, import_jsx_runtime12.jsxs)(import_core12.Stack, { gap: 6, align: compact ? "flex-start" : "center", children: [
          /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(import_core12.Title, { order: compact ? 4 : 3, children: title }),
          description ? /* @__PURE__ */ (0, import_jsx_runtime12.jsx)(import_core12.Text, { c: "dimmed", maw: compact ? void 0 : 480, children: description }) : null
        ] }),
        action
      ]
    }
  );
}

// src/DataToolbar.tsx
var import_core13 = require("@mantine/core");
var import_jsx_runtime13 = require("react/jsx-runtime");
function DataToolbar({
  searchSlot,
  filterSlot,
  sortSlot,
  resetAction,
  createAction,
  activeFilters = []
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_core13.Stack, { gap: "sm", children: [
    /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_core13.Group, { justify: "space-between", align: "flex-start", gap: "sm", children: [
      /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_core13.Group, { flex: 1, align: "flex-start", gap: "sm", children: [
        searchSlot,
        filterSlot,
        sortSlot
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime13.jsxs)(import_core13.Group, { gap: "sm", children: [
        resetAction,
        createAction
      ] })
    ] }),
    activeFilters.length ? /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(import_core13.Group, { gap: "xs", children: activeFilters.map((filter) => /* @__PURE__ */ (0, import_jsx_runtime13.jsx)(
      import_core13.Badge,
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

// src/PublicShell.tsx
var import_core15 = require("@mantine/core");

// src/PublicNav.tsx
var import_core14 = require("@mantine/core");
var import_jsx_runtime14 = require("react/jsx-runtime");
function PublicNav({ items, activeId, renderLink }) {
  return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(import_core14.Group, { component: "nav", "aria-label": "Primary", gap: "lg", wrap: "nowrap", children: items.map((item) => {
    const active = item.id === activeId;
    if (renderLink) {
      return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)("span", { children: renderLink(item, active) }, item.id);
    }
    return /* @__PURE__ */ (0, import_jsx_runtime14.jsx)(
      import_core14.Anchor,
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
var import_jsx_runtime15 = require("react/jsx-runtime");
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
  const resolvedNavigation = navigation ?? (navItems ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(PublicNav, { items: navItems, activeId: activeNavId }) : null);
  const containerSize = maxContentWidth ?? (compact ? "md" : "lg");
  return /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_core15.AppShell, { header: { height: 72 }, footer: mobileNavigation ? { height: 68 } : void 0, padding: 0, children: [
    /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_core15.AppShell.Header, { withBorder: headerBordered, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_core15.Container, { size: containerSize, h: "100%", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_core15.Group, { h: "100%", justify: "space-between", wrap: "nowrap", children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_core15.Group, { wrap: "nowrap", gap: "sm", children: [
        mobileNavigation ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_core15.Burger, { hiddenFrom: "sm", disabled: true, opened: false, "aria-hidden": true }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_core15.Box, { children: brand })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_core15.Group, { visibleFrom: "sm", gap: "lg", children: resolvedNavigation }),
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_core15.Group, { gap: "sm", children: actions })
    ] }) }) }),
    mobileNavigation ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_core15.AppShell.Footer, { withBorder: true, children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_core15.Container, { size: containerSize, h: "100%", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_core15.Group, { h: "100%", justify: "space-around", wrap: "nowrap", children: mobileNavigation }) }) }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime15.jsxs)(import_core15.AppShell.Main, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_core15.Container, { size: containerSize, py: "xl", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_core15.Stack, { gap: "xl", children }) }),
      footer ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_core15.Box, { component: typeof footer === "string" ? "footer" : "div", py: "xl", children: /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_core15.Container, { size: containerSize, children: typeof footer === "string" ? /* @__PURE__ */ (0, import_jsx_runtime15.jsx)(import_core15.Text, { size: "sm", c: "dimmed", children: footer }) : footer }) }) : null
    ] })
  ] });
}

// src/PublicSiteFooter.tsx
var import_core16 = require("@mantine/core");
var import_jsx_runtime16 = require("react/jsx-runtime");
function PublicSiteFooter({ children, meta }) {
  return /* @__PURE__ */ (0, import_jsx_runtime16.jsxs)(import_core16.Stack, { component: "footer", gap: "xs", children: [
    children ? /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_core16.Text, { size: "sm", children }) : null,
    meta ? /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_core16.Group, { gap: "sm", children: /* @__PURE__ */ (0, import_jsx_runtime16.jsx)(import_core16.Text, { size: "xs", c: "dimmed", children: meta }) }) : null
  ] });
}

// src/PublicBrandFooter.tsx
var import_core17 = require("@mantine/core");
var import_jsx_runtime17 = require("react/jsx-runtime");
function PublicBrandFooter({
  media,
  brandTitle,
  description,
  actions,
  secondary,
  legal,
  compact = false
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_core17.Paper, { component: "footer", withBorder: true, radius: "xl", p: compact ? "lg" : "xl", children: /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_core17.Stack, { gap: "lg", children: [
    /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_core17.Grid, { gutter: compact ? "lg" : "xl", align: "flex-start", children: [
      media ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_core17.Grid.Col, { span: { base: 12, md: 4 }, children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_core17.Box, { children: media }) }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_core17.Grid.Col, { span: { base: 12, md: media ? 4 : 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_core17.Stack, { gap: "sm", children: [
        brandTitle ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_core17.Title, { order: 4, children: brandTitle }) : null,
        description ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_core17.Text, { c: "dimmed", children: description }) : null,
        actions ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_core17.Box, { children: actions }) : null
      ] }) }),
      secondary ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_core17.Grid.Col, { span: { base: 12, md: media ? 4 : 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_core17.Stack, { gap: "sm", children: secondary }) }) : null
    ] }),
    legal ? /* @__PURE__ */ (0, import_jsx_runtime17.jsxs)(import_jsx_runtime17.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_core17.Divider, {}),
      /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_core17.Group, { justify: "space-between", gap: "sm", wrap: "wrap", children: typeof legal === "string" ? /* @__PURE__ */ (0, import_jsx_runtime17.jsx)(import_core17.Text, { size: "sm", c: "dimmed", children: legal }) : legal })
    ] }) : null
  ] }) });
}

// src/AuthShell.tsx
var import_core18 = require("@mantine/core");
var import_jsx_runtime18 = require("react/jsx-runtime");
function AuthShell({ title, description, brand, footer, helper, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_core18.Box, { py: { base: "xl", md: "4rem" }, children: /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_core18.Container, { size: "xs", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_core18.Stack, { gap: "xl", children: [
    brand ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_core18.Group, { justify: "center", children: brand }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_core18.Card, { withBorder: true, radius: "lg", padding: "xl", children: /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_core18.Stack, { gap: "lg", children: [
      /* @__PURE__ */ (0, import_jsx_runtime18.jsxs)(import_core18.Stack, { gap: "xs", ta: "center", children: [
        /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_core18.Title, { order: 2, children: title }),
        description ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_core18.Text, { c: "dimmed", size: "sm", children: description }) : null
      ] }),
      children,
      helper ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_core18.Text, { size: "sm", c: "dimmed", ta: "center", children: helper }) : null
    ] }) }),
    footer ? /* @__PURE__ */ (0, import_jsx_runtime18.jsx)(import_core18.Text, { size: "sm", c: "dimmed", ta: "center", children: footer }) : null
  ] }) }) });
}

// src/ArticleShell.tsx
var import_core19 = require("@mantine/core");
var import_jsx_runtime19 = require("react/jsx-runtime");
function ArticleShell({ eyebrow, title, lead, meta, sideRail, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(import_core19.Container, { size: "lg", py: "xl", children: /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(import_core19.Group, { align: "flex-start", gap: "xl", wrap: "nowrap", children: [
    /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(import_core19.Stack, { gap: "lg", maw: 760, flex: 1, children: [
      /* @__PURE__ */ (0, import_jsx_runtime19.jsxs)(import_core19.Stack, { gap: "sm", children: [
        eyebrow ? /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(import_core19.Text, { size: "sm", fw: 700, c: "dimmed", tt: "uppercase", children: eyebrow }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(import_core19.Title, { order: 1, children: title }),
        lead ? /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(import_core19.Text, { size: "lg", c: "dimmed", children: lead }) : null,
        meta ? /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(import_core19.Group, { gap: "md", children: meta }) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(import_core19.Stack, { gap: "md", children })
    ] }),
    sideRail ? /* @__PURE__ */ (0, import_jsx_runtime19.jsx)(import_core19.Stack, { visibleFrom: "lg", gap: "md", w: 240, children: sideRail }) : null
  ] }) });
}

// src/DocsCodeBlock.tsx
var import_react3 = require("react");
var import_core20 = require("@mantine/core");
var import_jsx_runtime20 = require("react/jsx-runtime");
function DocsCodeBlock({ code, language, title, withCopy = true }) {
  const [copied, setCopied] = (0, import_react3.useState)(false);
  const handleCopy = async () => {
    if (!navigator?.clipboard) {
      return;
    }
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_core20.Paper, { withBorder: true, radius: "lg", p: "md", children: /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_core20.Stack, { gap: "sm", children: [
    title || withCopy ? /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_core20.Group, { justify: "space-between", align: "center", children: [
      /* @__PURE__ */ (0, import_jsx_runtime20.jsxs)(import_core20.Stack, { gap: 0, children: [
        title ? /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_core20.Text, { fw: 600, children: title }) : null,
        language ? /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_core20.Text, { size: "xs", c: "dimmed", children: language }) : null
      ] }),
      withCopy ? /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(
        import_core20.ActionIcon,
        {
          variant: "subtle",
          "aria-label": copied ? "Copied code block" : "Copy code block",
          onClick: () => {
            void handleCopy();
          },
          children: /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(GdsIcons.Copy, { size: "1rem" })
        }
      ) : null
    ] }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime20.jsx)(import_core20.Code, { block: true, children: code })
  ] }) });
}

// src/CtaButtonGroup.tsx
var import_core21 = require("@mantine/core");
var import_jsx_runtime21 = require("react/jsx-runtime");
function CtaButtonGroup({ primary, secondary, tertiary }) {
  return /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(import_core21.Stack, { gap: "sm", children: [
    /* @__PURE__ */ (0, import_jsx_runtime21.jsxs)(import_core21.Group, { gap: "sm", align: "stretch", children: [
      /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { children: primary }),
      secondary ? /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { children: secondary }) : null
    ] }),
    tertiary ? /* @__PURE__ */ (0, import_jsx_runtime21.jsx)("div", { children: tertiary }) : null
  ] });
}

// src/DocsPageShell.tsx
var import_core22 = require("@mantine/core");
var import_jsx_runtime22 = require("react/jsx-runtime");
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
  return /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_core22.Container, { size: "lg", py: "xl", children: /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)(import_core22.Group, { align: "flex-start", gap: "xl", wrap: "nowrap", children: [
    /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)(import_core22.Stack, { component: "article", gap: "lg", maw: 760, flex: 1, children: [
      breadcrumbs.length ? /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_core22.Breadcrumbs, { children: breadcrumbs.map(
        (crumb) => crumb.href ? /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_core22.Anchor, { href: crumb.href, children: crumb.label }, `${crumb.label}-${crumb.href}`) : /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_core22.Text, { children: crumb.label }, crumb.label)
      ) }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime22.jsxs)(import_core22.Stack, { gap: "sm", children: [
        eyebrow ? /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_core22.Text, { size: "sm", fw: 700, c: "dimmed", children: eyebrow }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_core22.Title, { order: 1, children: title }),
        lead ? /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_core22.Text, { size: "lg", c: "dimmed", children: lead }) : null,
        meta ? /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_core22.Group, { gap: "md", children: meta }) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_core22.Stack, { gap: "md", children }),
      footerNext ? /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_core22.Anchor, { href: footerNext.href, fw: 600, children: footerNext.label }) : null
    ] }),
    sideRail ? /* @__PURE__ */ (0, import_jsx_runtime22.jsx)(import_core22.Stack, { visibleFrom: "lg", gap: "md", w: 240, children: sideRail }) : null
  ] }) });
}

// src/EditorialHero.tsx
var import_core23 = require("@mantine/core");
var import_jsx_runtime23 = require("react/jsx-runtime");
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
  const content = /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
    import_core23.Anchor,
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
    return /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
      import_core23.Box,
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
  return /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_core23.Paper, { withBorder: true, radius: "xl", p: compact ? "lg" : "xl", children: /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(import_core23.Grid, { gutter: compact ? "lg" : "xl", align: "center", children: [
    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_core23.Grid.Col, { span: { base: 12, md: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(import_core23.Stack, { gap: "md", children: [
      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_core23.Skeleton, { height: 16, width: 96, radius: "xl" }),
      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_core23.Skeleton, { height: 48, width: "90%", radius: "md" }),
      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_core23.Skeleton, { height: 18, width: "100%", radius: "md" }),
      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_core23.Skeleton, { height: 18, width: "82%", radius: "md" }),
      /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(import_core23.Group, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_core23.Skeleton, { height: 40, width: 140, radius: "md" }),
        /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_core23.Skeleton, { height: 40, width: 140, radius: "md" })
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_core23.Grid.Col, { span: { base: 12, md: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_core23.AspectRatio, { ratio: 16 / 11, children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_core23.Skeleton, { radius: "lg" }) }) })
  ] }) });
}
function MediaFallback() {
  return /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_core23.AspectRatio, { ratio: 16 / 11, children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
    import_core23.ThemeIcon,
    {
      size: "100%",
      radius: "lg",
      color: "gray",
      variant: "light",
      "aria-label": "Hero media is unavailable",
      children: /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(GdsIcons.Gallery, { size: "2.5rem" })
    }
  ) });
}
function MediaFrame({
  media,
  mediaAlt,
  mediaFade
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(
    import_core23.Box,
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
        media ?? /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(MediaFallback, {}),
        media && mediaFade !== "none" ? /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
          import_core23.Box,
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
    return /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(LoadingHero, { compact });
  }
  const stackAlign = align === "center" ? "center" : "flex-start";
  const textAlign = align === "center" ? "center" : "left";
  let seenPrimary = false;
  const renderedActions = actions.slice(0, 3).map((action, index) => {
    const resolved = resolveActionVariant(action, index, seenPrimary);
    seenPrimary = resolved.seenPrimary;
    return /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(HeroAction, { action, variant: resolved.variant }, `${action.label}-${index}`);
  });
  const textSlot = /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(import_core23.Stack, { gap: compact ? "md" : "lg", justify: "center", h: "100%", children: [
    /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(import_core23.Stack, { gap: "sm", align: stackAlign, children: [
      eyebrow ? /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_core23.Text, { size: "sm", fw: 700, c: "dimmed", ta: textAlign, children: eyebrow }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_core23.Title, { order: 1, maw: 760, ta: textAlign, children: title }),
      description ? /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_core23.Text, { size: compact ? "md" : "lg", c: "dimmed", maw: 720, ta: textAlign, children: description }) : null
    ] }),
    renderedActions.length ? /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(
      CtaButtonGroup,
      {
        primary: renderedActions[0],
        secondary: renderedActions[1],
        tertiary: renderedActions[2]
      }
    ) : null,
    meta.length ? /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_core23.Group, { gap: "sm", wrap: "wrap", "aria-label": "Supporting details", children: meta.map((item) => /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(
      import_core23.Group,
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
          /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_core23.Text, { size: "sm", c: "dimmed", children: item.label })
        ]
      },
      item.id
    )) }) : null
  ] });
  const mediaSlot = error ? /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(AccentPanel, { tone: "red", variant: "soft-outline", title: "Media unavailable", children: error }) : /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(MediaFrame, { media, mediaAlt, mediaFade });
  const textCol = /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_core23.Grid.Col, { span: { base: 12, md: 6 }, order: { base: 1, md: mediaPosition === "left" ? 2 : 1 }, children: textSlot });
  const mediaCol = /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_core23.Grid.Col, { span: { base: 12, md: 6 }, order: { base: 2, md: mediaPosition === "left" ? 1 : 2 }, children: mediaSlot });
  return /* @__PURE__ */ (0, import_jsx_runtime23.jsx)(import_core23.Paper, { component: "section", withBorder: true, radius: "xl", p: compact ? "lg" : "xl", children: /* @__PURE__ */ (0, import_jsx_runtime23.jsxs)(import_core23.Grid, { gutter: compact ? "lg" : "xl", align: "center", children: [
    textCol,
    mediaCol
  ] }) });
}

// src/FeatureBand.tsx
var import_core24 = require("@mantine/core");
var import_jsx_runtime24 = require("react/jsx-runtime");
function FeatureBandSkeleton({ columns = 3, bordered = true }) {
  return /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_core24.SimpleGrid, { cols: { base: 1, sm: Math.min(columns, 2), lg: columns }, spacing: "lg", children: Array.from({ length: columns }).map((_, index) => /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_core24.Paper, { withBorder: bordered, radius: "lg", p: "lg", children: /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(import_core24.Stack, { gap: "md", children: [
    /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_core24.Skeleton, { height: 42, width: 42, radius: "xl" }),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(import_core24.Stack, { gap: "xs", children: [
      /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_core24.Skeleton, { height: 20, width: "75%", radius: "md" }),
      /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_core24.Skeleton, { height: 14, width: "100%", radius: "md" }),
      /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_core24.Skeleton, { height: 14, width: "82%", radius: "md" })
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
    return /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(FeatureBandSkeleton, { columns, bordered });
  }
  if (!items.length) {
    return emptyState ? /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_jsx_runtime24.Fragment, { children: emptyState }) : /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(
      EmptyState,
      {
        title: "No supporting details available",
        description: "Add shared feature-band items when this public surface needs trust, service, or location context."
      }
    );
  }
  return /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_core24.Box, { component: "section", "aria-label": "Supporting features", children: /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_core24.SimpleGrid, { cols: { base: 1, sm: Math.min(columns, 2), lg: columns }, spacing: "lg", children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_core24.Paper, { withBorder: bordered, radius: "lg", p: "lg", children: /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(import_core24.Stack, { gap: "md", children: [
    item.media ? item.media : item.icon ? /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_core24.Group, { children: /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_core24.ThemeIcon, { size: "xl", radius: "xl", variant: "light", color: "violet", children: item.icon }) }) : /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_core24.Group, { children: /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_core24.ThemeIcon, { size: "xl", radius: "xl", variant: "light", color: "gray", "aria-hidden": true, children: /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(GdsIcons.Info, { size: "1.25rem" }) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime24.jsxs)(import_core24.Stack, { gap: "xs", children: [
      /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_core24.Title, { order: 4, children: item.title }),
      item.description ? /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_core24.Text, { c: "dimmed", children: item.description }) : null,
      item.meta ? /* @__PURE__ */ (0, import_jsx_runtime24.jsx)(import_core24.Text, { size: "sm", c: "dimmed", children: item.meta }) : null
    ] })
  ] }) }, item.id)) }) });
}

// src/UploadDropzone.tsx
var import_react4 = require("react");
var import_core25 = require("@mantine/core");
var import_jsx_runtime25 = require("react/jsx-runtime");
function UploadDropzone({
  title,
  description,
  onFilesSelected,
  accept,
  multiple = true,
  actionLabel = "Choose files",
  mode = "panel"
}) {
  const inputRef = (0, import_react4.useRef)(null);
  const [dragging, setDragging] = (0, import_react4.useState)(false);
  const UploadIcon = GdsIcons.Upload;
  const forwardFiles = (files) => {
    if (!files?.length || !onFilesSelected) {
      return;
    }
    onFilesSelected(Array.from(files));
  };
  return /* @__PURE__ */ (0, import_jsx_runtime25.jsxs)(
    import_core25.Box,
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
        /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(
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
        /* @__PURE__ */ (0, import_jsx_runtime25.jsxs)(import_core25.Stack, { align: mode === "inline" ? "flex-start" : "center", ta: mode === "inline" ? "left" : "center", gap: "sm", children: [
          /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(UploadIcon, { size: "1.5rem" }),
          /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(import_core25.Text, { fw: 600, children: title }),
          description ? /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(import_core25.Text, { size: "sm", c: "dimmed", children: description }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(import_core25.Group, { children: /* @__PURE__ */ (0, import_jsx_runtime25.jsx)(import_core25.Button, { variant: "light", onClick: () => inputRef.current?.click(), children: actionLabel }) })
        ] })
      ]
    }
  );
}

// src/MediaCard.tsx
var import_core26 = require("@mantine/core");
var import_jsx_runtime26 = require("react/jsx-runtime");
function MediaCard({ title, image, description, status, overlay, actions = [] }) {
  const EyeIcon = GdsIcons.Eye;
  return /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)(import_core26.Card, { withBorder: true, radius: "lg", padding: "md", children: [
    /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)(import_core26.Card.Section, { pos: "relative", children: [
      image,
      overlay ? /* @__PURE__ */ (0, import_jsx_runtime26.jsx)("div", { style: { position: "absolute", inset: 12, display: "flex", justifyContent: "flex-end", alignItems: "flex-start" }, children: overlay }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)(import_core26.Stack, { gap: "sm", mt: "md", children: [
      /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)(import_core26.Group, { justify: "space-between", align: "flex-start", children: [
        /* @__PURE__ */ (0, import_jsx_runtime26.jsxs)(import_core26.Stack, { gap: 4, children: [
          /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(import_core26.Title, { order: 4, children: title }),
          description ? /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(import_core26.Text, { size: "sm", c: "dimmed", lineClamp: 2, children: description }) : null
        ] }),
        status ? /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(import_core26.Badge, { variant: "light", children: status }) : null
      ] }),
      actions.length ? /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(import_core26.Group, { justify: "flex-end", gap: "xs", children: actions.map((action) => /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(import_core26.ActionIcon, { variant: "light", "aria-label": action.label, onClick: action.onClick, children: /* @__PURE__ */ (0, import_jsx_runtime26.jsx)(EyeIcon, { size: "1rem" }) }, action.label)) }) : null
    ] })
  ] });
}

// src/AccessSummary.tsx
var import_core27 = require("@mantine/core");
var import_jsx_runtime27 = require("react/jsx-runtime");
function AccessSummary({ title, roles, scope, blocked = false, description }) {
  return /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(import_core27.Card, { withBorder: true, radius: "lg", padding: "lg", children: /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)(import_core27.Stack, { gap: "sm", children: [
    /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)(import_core27.Group, { justify: "space-between", align: "center", children: [
      /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(import_core27.Title, { order: 4, children: title }),
      /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(import_core27.Badge, { color: blocked ? "red" : "teal", variant: "light", children: blocked ? "Blocked" : "Allowed" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(import_core27.Group, { gap: "xs", children: roles.map((role) => /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(import_core27.Badge, { variant: "outline", children: role }, role)) }),
    scope ? /* @__PURE__ */ (0, import_jsx_runtime27.jsxs)(import_core27.Text, { size: "sm", c: "dimmed", children: [
      "Scope: ",
      scope
    ] }) : null,
    description ? /* @__PURE__ */ (0, import_jsx_runtime27.jsx)(import_core27.Text, { size: "sm", children: description }) : null
  ] }) });
}

// src/AccessRecoveryPanel.tsx
var import_core28 = require("@mantine/core");
var import_theme3 = require("@gds/theme");
var import_jsx_runtime28 = require("react/jsx-runtime");
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
  return /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(import_core28.Group, { gap: "sm", justify: "center", wrap: "wrap", children: actions.map((actionConfig, index) => /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(
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
  const { t } = (0, import_theme3.useGdsTranslation)();
  const defaultCopy = defaultCopyByState[state];
  const defaults = defaultActionsForState(state, {
    onRetry,
    onSignIn,
    onBack,
    supportAction
  });
  return /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(
    StateBlock,
    {
      variant: stateBlockVariantByState[state],
      compact,
      title: title ?? t(`gds.accessRecovery.${state}.title`, defaultCopy.title),
      description: description ?? t(`gds.accessRecovery.${state}.description`, defaultCopy.description),
      action: /* @__PURE__ */ (0, import_jsx_runtime28.jsx)(
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

// src/FormField.tsx
var import_core29 = require("@mantine/core");
var import_jsx_runtime29 = require("react/jsx-runtime");
function FormField({ label, description, error, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_core29.Box, { component: "label", children: /* @__PURE__ */ (0, import_jsx_runtime29.jsxs)(import_core29.Stack, { gap: 4, children: [
    /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_core29.Text, { size: "xs", fw: 600, c: "dimmed", children: label }),
    description ? /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_core29.Text, { size: "xs", c: "dimmed", children: description }) : null,
    children,
    error ? /* @__PURE__ */ (0, import_jsx_runtime29.jsx)(import_core29.Text, { size: "xs", c: "red.7", children: error }) : null
  ] }) });
}

// src/PageHeader.tsx
var import_core30 = require("@mantine/core");
var import_jsx_runtime30 = require("react/jsx-runtime");
function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  eyebrowVariant = "neutral"
}) {
  const eyebrowProps = eyebrowVariant === "ornamental" ? { tt: "uppercase", style: { letterSpacing: "0.12em" } } : {};
  return /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)(import_core30.Group, { justify: "space-between", align: "flex-start", gap: "lg", wrap: "wrap", children: [
    /* @__PURE__ */ (0, import_jsx_runtime30.jsxs)(import_core30.Stack, { gap: "xs", children: [
      eyebrow && /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(import_core30.Text, { size: "xs", fw: 700, c: "dimmed", ...eyebrowProps, children: eyebrow }),
      /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(import_core30.Title, { order: 1, children: title }),
      description && /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(import_core30.Text, { c: "dimmed", maw: 720, children: description })
    ] }),
    actions ? /* @__PURE__ */ (0, import_jsx_runtime30.jsx)(import_core30.Box, { children: actions }) : null
  ] });
}

// src/FilterDrawer.tsx
var import_core31 = require("@mantine/core");
var import_jsx_runtime31 = require("react/jsx-runtime");
function FilterDrawer({
  opened,
  onClose,
  title,
  children,
  primaryAction,
  secondaryAction
}) {
  return /* @__PURE__ */ (0, import_jsx_runtime31.jsx)(import_core31.Drawer, { opened, onClose, title, position: "right", size: "md", children: /* @__PURE__ */ (0, import_jsx_runtime31.jsxs)(import_core31.Stack, { gap: "md", children: [
    children,
    primaryAction || secondaryAction ? /* @__PURE__ */ (0, import_jsx_runtime31.jsxs)(import_core31.Group, { justify: "space-between", mt: "md", children: [
      secondaryAction ?? /* @__PURE__ */ (0, import_jsx_runtime31.jsx)("span", {}),
      primaryAction
    ] }) : null
  ] }) });
}

// src/PlaceholderPanel.tsx
var import_core32 = require("@mantine/core");
var import_jsx_runtime32 = require("react/jsx-runtime");
function PlaceholderPanel({
  title,
  description,
  badge,
  footer,
  children,
  mode
}) {
  if (mode === "live" && children) {
    return /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(import_jsx_runtime32.Fragment, { children });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(import_core32.Card, { children: /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)(import_core32.Stack, { gap: "md", children: [
    badge ? /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(import_core32.Badge, { variant: "light", color: "blue", w: "fit-content", children: badge }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime32.jsxs)(import_core32.Stack, { gap: "xs", children: [
      /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(import_core32.Title, { order: 4, children: title }),
      /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(import_core32.Text, { c: "dimmed", children: description })
    ] }),
    footer ? /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(import_core32.Text, { size: "sm", children: footer }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime32.jsx)(
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
var import_core33 = require("@mantine/core");
var import_jsx_runtime33 = require("react/jsx-runtime");
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
    return /* @__PURE__ */ (0, import_jsx_runtime33.jsx)(StateBlock, { variant: "error", title: "Unable to load data", description: error, compact: true });
  }
  if (loading) {
    return /* @__PURE__ */ (0, import_jsx_runtime33.jsx)(StateBlock, { variant: "loading", title: "Loading data", description: "Please wait while the shared dataset is prepared.", compact: true });
  }
  if (!rows.length) {
    return /* @__PURE__ */ (0, import_jsx_runtime33.jsx)(StateBlock, { variant: "empty", title: emptyTitle, description: emptyDescription, compact: true });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime33.jsx)(import_core33.ScrollArea, { children: /* @__PURE__ */ (0, import_jsx_runtime33.jsxs)(import_core33.Table, { striped: true, highlightOnHover: true, withTableBorder: true, withColumnBorders: true, children: [
    /* @__PURE__ */ (0, import_jsx_runtime33.jsx)(import_core33.Table.Thead, { children: /* @__PURE__ */ (0, import_jsx_runtime33.jsx)(import_core33.Table.Tr, { children: columns.map((column) => /* @__PURE__ */ (0, import_jsx_runtime33.jsx)(import_core33.Table.Th, { children: column.header }, String(column.key))) }) }),
    /* @__PURE__ */ (0, import_jsx_runtime33.jsx)(import_core33.Table.Tbody, { children: rows.map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime33.jsx)(import_core33.Table.Tr, { children: columns.map((column) => /* @__PURE__ */ (0, import_jsx_runtime33.jsx)(import_core33.Table.Td, { children: column.render ? column.render(row) : String(row[column.key] ?? "") }, String(column.key))) }, getRowKey ? getRowKey(row, index) : index)) })
  ] }) });
}

// src/StatsSection.tsx
var import_core34 = require("@mantine/core");
var import_jsx_runtime34 = require("react/jsx-runtime");
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
    content = /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(StateBlock, { variant: "error", title: "Unable to load statistics", description: error, compact: true });
  } else if (loading) {
    content = /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(StateBlock, { variant: "loading", title: "Loading statistics", description: "This shared data surface is still synchronizing.", compact: true });
  } else if (belowThreshold) {
    content = /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(
      StateBlock,
      {
        variant: "not-enough-data",
        title: "Not enough data yet",
        description: thresholdMessage ?? "This view is hidden until the reporting threshold is met.",
        compact: true
      }
    );
  } else if (placeholder) {
    content = /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(PlaceholderPanel, { ...placeholder, mode: "placeholder" });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime34.jsxs)(import_core34.Stack, { gap: "md", children: [
    /* @__PURE__ */ (0, import_jsx_runtime34.jsx)(import_core34.Title, { order: 3, children: title }),
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AccentPanel,
  AccessRecoveryPanel,
  AccessSummary,
  ArticleShell,
  AuthShell,
  ConfirmDialog,
  CtaButtonGroup,
  DataToolbar,
  DocsCodeBlock,
  DocsPageShell,
  EditorialHero,
  EmptyState,
  FeatureBand,
  FilterDrawer,
  FormField,
  GameBoardTile,
  GdsIcons,
  GdsVocabulary,
  MediaCard,
  MetricCard,
  PageHeader,
  PlaceholderPanel,
  ProductCard,
  ProgressCard,
  PublicBrandFooter,
  PublicNav,
  PublicProductCard,
  PublicShell,
  PublicSiteFooter,
  SemanticButton,
  SimpleDataTable,
  StateBlock,
  StatsSection,
  StatusBadge,
  ThemeToggle,
  UploadDropzone,
  ar,
  de,
  en,
  es,
  fr,
  gdsLocales,
  getGdsMessages,
  he,
  hu,
  it,
  resolveAccentPanelStyles,
  ru
});

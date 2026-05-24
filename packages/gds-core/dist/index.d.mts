import * as react_jsx_runtime from 'react/jsx-runtime';
import * as react from 'react';
import react__default from 'react';
import { BadgeProps, ButtonProps } from '@mantine/core';
import * as _tabler_icons_react from '@tabler/icons-react';

type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';
interface StatusBadgeProps extends Omit<BadgeProps, 'color'> {
    status: StatusVariant;
    children: react__default.ReactNode;
}
/**
 * StatusBadge enforces strict semantic coloring.
 * Arbitrary hex colors are prohibited.
 */
declare function StatusBadge({ status, children, ...props }: StatusBadgeProps): react_jsx_runtime.JSX.Element;

interface EmptyStateProps {
    icon?: react__default.ReactNode;
    title: string;
    description: string;
    action?: react__default.ReactNode;
}
/**
 * Standardized EmptyState component.
 */
declare function EmptyState({ icon, title, description, action }: EmptyStateProps): react_jsx_runtime.JSX.Element;

declare const GdsVocabulary: {
    readonly settings: {
        readonly id: "gds.action.settings";
        readonly defaultMessage: "Settings";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.saved";
        };
    };
    readonly analytics: {
        readonly id: "gds.action.analytics";
        readonly defaultMessage: "Analytics";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.loaded";
        };
    };
    readonly dashboard: {
        readonly id: "gds.action.dashboard";
        readonly defaultMessage: "Dashboard";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.loaded";
        };
    };
    readonly play: {
        readonly id: "gds.action.play";
        readonly defaultMessage: "Play";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.started";
        };
    };
    readonly start: {
        readonly id: "gds.action.start";
        readonly defaultMessage: "Start";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.started";
        };
    };
    readonly users: {
        readonly id: "gds.action.users";
        readonly defaultMessage: "Users";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.loaded";
        };
    };
    readonly add: {
        readonly id: "gds.action.add";
        readonly defaultMessage: "Add";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.added";
        };
    };
    readonly edit: {
        readonly id: "gds.action.edit";
        readonly defaultMessage: "Edit";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.edited";
        };
    };
    readonly delete: {
        readonly id: "gds.action.delete";
        readonly defaultMessage: "Delete";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "red";
            readonly messageId: "gds.feedback.deleted";
        };
    };
    readonly save: {
        readonly id: "gds.action.save";
        readonly defaultMessage: "Save";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.saved";
        };
    };
    readonly cancel: {
        readonly id: "gds.action.cancel";
        readonly defaultMessage: "Cancel";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "red";
            readonly messageId: "gds.feedback.canceled";
        };
    };
    readonly confirm: {
        readonly id: "gds.action.confirm";
        readonly defaultMessage: "Confirm";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.confirmed";
        };
    };
    readonly close: {
        readonly id: "gds.action.close";
        readonly defaultMessage: "Close";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "gray";
            readonly messageId: "gds.feedback.closed";
        };
    };
    readonly language: {
        readonly id: "gds.action.language";
        readonly defaultMessage: "Language";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.changed";
        };
    };
    readonly theme: {
        readonly id: "gds.action.theme";
        readonly defaultMessage: "Theme";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.changed";
        };
    };
    readonly home: {
        readonly id: "gds.action.home";
        readonly defaultMessage: "Home";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.opened";
        };
    };
    readonly inbox: {
        readonly id: "gds.action.inbox";
        readonly defaultMessage: "Inbox";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.opened";
        };
    };
    readonly calendar: {
        readonly id: "gds.action.calendar";
        readonly defaultMessage: "Calendar";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.opened";
        };
    };
    readonly gallery: {
        readonly id: "gds.action.gallery";
        readonly defaultMessage: "Gallery";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.opened";
        };
    };
    readonly history: {
        readonly id: "gds.action.history";
        readonly defaultMessage: "History";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.opened";
        };
    };
    readonly profile: {
        readonly id: "gds.action.profile";
        readonly defaultMessage: "Profile";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.opened";
        };
    };
    readonly send: {
        readonly id: "gds.action.send";
        readonly defaultMessage: "Send";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "blue";
            readonly messageId: "gds.feedback.sent";
        };
    };
    readonly reply: {
        readonly id: "gds.action.reply";
        readonly defaultMessage: "Reply";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "blue";
            readonly messageId: "gds.feedback.replied";
        };
    };
    readonly forward: {
        readonly id: "gds.action.forward";
        readonly defaultMessage: "Forward";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "blue";
            readonly messageId: "gds.feedback.forwarded";
        };
    };
    readonly attach: {
        readonly id: "gds.action.attach";
        readonly defaultMessage: "Attach";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.attached";
        };
    };
    readonly upload: {
        readonly id: "gds.action.upload";
        readonly defaultMessage: "Upload";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.uploaded";
        };
    };
    readonly download: {
        readonly id: "gds.action.download";
        readonly defaultMessage: "Download";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.downloaded";
        };
    };
    readonly print: {
        readonly id: "gds.action.print";
        readonly defaultMessage: "Print";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.printed";
        };
    };
    readonly copy: {
        readonly id: "gds.action.copy";
        readonly defaultMessage: "Copy";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.copied";
        };
    };
    readonly duplicate: {
        readonly id: "gds.action.duplicate";
        readonly defaultMessage: "Duplicate";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.duplicated";
        };
    };
    readonly check: {
        readonly id: "gds.action.check";
        readonly defaultMessage: "Check";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.checked";
        };
    };
    readonly uncheck: {
        readonly id: "gds.action.uncheck";
        readonly defaultMessage: "Uncheck";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "red";
            readonly messageId: "gds.feedback.unchecked";
        };
    };
    readonly complete: {
        readonly id: "gds.action.complete";
        readonly defaultMessage: "Complete";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.completed";
        };
    };
    readonly clear: {
        readonly id: "gds.action.clear";
        readonly defaultMessage: "Clear";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "red";
            readonly messageId: "gds.feedback.cleared";
        };
    };
    readonly capture: {
        readonly id: "gds.action.capture";
        readonly defaultMessage: "Capture";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.captured";
        };
    };
    readonly record: {
        readonly id: "gds.action.record";
        readonly defaultMessage: "Record";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.recorded";
        };
    };
    readonly flip: {
        readonly id: "gds.action.flip";
        readonly defaultMessage: "Flip";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.flipped";
        };
    };
    readonly flash: {
        readonly id: "gds.action.flash";
        readonly defaultMessage: "Flash";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.flashed";
        };
    };
    readonly course: {
        readonly id: "gds.action.course";
        readonly defaultMessage: "Course";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.done";
        };
    };
    readonly lesson: {
        readonly id: "gds.action.lesson";
        readonly defaultMessage: "Lesson";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.done";
        };
    };
    readonly certificate: {
        readonly id: "gds.action.certificate";
        readonly defaultMessage: "Certificate";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.done";
        };
    };
    readonly student: {
        readonly id: "gds.action.student";
        readonly defaultMessage: "Student";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.done";
        };
    };
    readonly class: {
        readonly id: "gds.action.class";
        readonly defaultMessage: "Class";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.done";
        };
    };
    readonly grade: {
        readonly id: "gds.action.grade";
        readonly defaultMessage: "Grade";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.done";
        };
    };
    readonly child: {
        readonly id: "gds.action.child";
        readonly defaultMessage: "Child";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.done";
        };
    };
    readonly family: {
        readonly id: "gds.action.family";
        readonly defaultMessage: "Family";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.done";
        };
    };
    readonly habit: {
        readonly id: "gds.action.habit";
        readonly defaultMessage: "Habit";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.done";
        };
    };
    readonly goal: {
        readonly id: "gds.action.goal";
        readonly defaultMessage: "Goal";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.done";
        };
    };
    readonly streak: {
        readonly id: "gds.action.streak";
        readonly defaultMessage: "Streak";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.done";
        };
    };
    readonly reward: {
        readonly id: "gds.action.reward";
        readonly defaultMessage: "Reward";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "yellow";
            readonly messageId: "gds.feedback.rewarded";
        };
    };
    readonly trophy: {
        readonly id: "gds.action.trophy";
        readonly defaultMessage: "Trophy";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "yellow";
            readonly messageId: "gds.feedback.rewarded";
        };
    };
    readonly crown: {
        readonly id: "gds.action.crown";
        readonly defaultMessage: "Crown";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "yellow";
            readonly messageId: "gds.feedback.rewarded";
        };
    };
    readonly pause: {
        readonly id: "gds.action.pause";
        readonly defaultMessage: "Pause";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.paused";
        };
    };
    readonly message: {
        readonly id: "gds.action.message";
        readonly defaultMessage: "Message";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "blue";
            readonly messageId: "gds.feedback.sent";
        };
    };
    readonly mail: {
        readonly id: "gds.action.mail";
        readonly defaultMessage: "Mail";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "blue";
            readonly messageId: "gds.feedback.mailed";
        };
    };
    readonly refresh: {
        readonly id: "gds.action.refresh";
        readonly defaultMessage: "Refresh";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.refreshed";
        };
    };
    readonly trendingUp: {
        readonly id: "gds.action.trendingUp";
        readonly defaultMessage: "Trending Up";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.done";
        };
    };
    readonly trendingDown: {
        readonly id: "gds.action.trendingDown";
        readonly defaultMessage: "Trending Down";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.done";
        };
    };
    readonly currency: {
        readonly id: "gds.action.currency";
        readonly defaultMessage: "Currency";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.done";
        };
    };
    readonly grid: {
        readonly id: "gds.action.grid";
        readonly defaultMessage: "Grid";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.done";
        };
    };
    readonly list: {
        readonly id: "gds.action.list";
        readonly defaultMessage: "List";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.done";
        };
    };
    readonly logout: {
        readonly id: "gds.action.logout";
        readonly defaultMessage: "Logout";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.loggedOut";
        };
    };
    readonly notifications: {
        readonly id: "gds.action.notifications";
        readonly defaultMessage: "Notifications";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.done";
        };
    };
    readonly back: {
        readonly id: "gds.action.back";
        readonly defaultMessage: "Back";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.done";
        };
    };
    readonly eye: {
        readonly id: "gds.action.eye";
        readonly defaultMessage: "View";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.done";
        };
    };
    readonly eyeOff: {
        readonly id: "gds.action.eyeOff";
        readonly defaultMessage: "Hide";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.done";
        };
    };
    readonly help: {
        readonly id: "gds.action.help";
        readonly defaultMessage: "Help";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.done";
        };
    };
    readonly filter: {
        readonly id: "gds.action.filter";
        readonly defaultMessage: "Filter";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.filtered";
        };
    };
    readonly sort: {
        readonly id: "gds.action.sort";
        readonly defaultMessage: "Sort";
        readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
        readonly feedback: {
            readonly icon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
            readonly color: "teal";
            readonly messageId: "gds.feedback.sorted";
        };
    };
};
type SemanticAction = keyof typeof GdsVocabulary;

interface ConfirmDialogProps {
    opened: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    children: react__default.ReactNode;
    confirmAction?: SemanticAction;
    cancelAction?: SemanticAction;
    isDanger?: boolean;
    loading?: boolean;
}
/**
 * Standardized destructive/confirmation dialog.
 */
declare function ConfirmDialog({ opened, onClose, onConfirm, title, children, confirmAction, cancelAction, isDanger, loading, }: ConfirmDialogProps): react_jsx_runtime.JSX.Element;

/**
 * GdsIcons is the centralized semantic icon dictionary.
 * Applications MUST use these exported icons instead of importing
 * raw icons from tabler/icons-react directly. This ensures complete
 * visual consistency across the platform.
 */
declare const GdsIcons: {
    Dashboard: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Settings: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Users: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Analytics: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Home: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Inbox: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Calendar: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Gallery: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    History: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Profile: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Add: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Edit: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Delete: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Search: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Save: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Play: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Start: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Send: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Reply: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Forward: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Attach: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Upload: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Download: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Print: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Copy: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Duplicate: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Check: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Uncheck: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Complete: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Clear: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Cancel: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Confirm: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Close: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Language: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Theme: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Capture: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Record: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Flip: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Flash: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Course: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Lesson: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Certificate: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Student: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Class: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Grade: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Child: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Family: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Habit: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Goal: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Streak: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Reward: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Success: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Warning: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Danger: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Info: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Trophy: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Crown: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Pause: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Message: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Mail: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Refresh: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    TrendingUp: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    TrendingDown: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Currency: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Grid: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    List: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Logout: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Notifications: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Back: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Eye: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    EyeOff: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Help: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Filter: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Sort: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    ChevronDown: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    ChevronUp: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Menu: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Moon: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
    Sun: react.ForwardRefExoticComponent<_tabler_icons_react.IconProps & react.RefAttributes<SVGSVGElement>>;
};

interface ThemeToggleProps {
    size?: 'sm' | 'md' | 'lg' | 'xl';
}
/**
 * Standardized ThemeToggle component for switching between Light and Dark mode.
 * Should be placed in the main application header/shell.
 */
declare function ThemeToggle({ size }: ThemeToggleProps): react_jsx_runtime.JSX.Element;

interface SemanticButtonProps extends ButtonProps, Omit<react__default.ComponentPropsWithoutRef<'button'>, keyof ButtonProps | 'leftSection' | 'children'> {
    action: SemanticAction;
    loading?: boolean;
    feedbackState?: 'success' | 'error' | null;
    feedbackText?: string;
}
/**
 * SemanticButton strictly enforces ubiquitous language and standardized iconography.
 * Developers cannot pass arbitrary text or icons; they must use a semantic action key.
 */
declare function SemanticButton({ action, loading, feedbackState, feedbackText, ...props }: SemanticButtonProps): react_jsx_runtime.JSX.Element;

declare const en: {
    'gds.action.settings': string;
    'gds.action.analytics': string;
    'gds.action.dashboard': string;
    'gds.action.play': string;
    'gds.action.start': string;
    'gds.action.users': string;
    'gds.action.add': string;
    'gds.action.edit': string;
    'gds.action.delete': string;
    'gds.action.save': string;
    'gds.action.cancel': string;
    'gds.action.confirm': string;
    'gds.action.close': string;
    'gds.action.language': string;
    'gds.action.theme': string;
    'gds.action.home': string;
    'gds.action.inbox': string;
    'gds.action.calendar': string;
    'gds.action.gallery': string;
    'gds.action.history': string;
    'gds.action.profile': string;
    'gds.action.send': string;
    'gds.action.reply': string;
    'gds.action.forward': string;
    'gds.action.attach': string;
    'gds.action.upload': string;
    'gds.action.download': string;
    'gds.action.print': string;
    'gds.action.copy': string;
    'gds.action.duplicate': string;
    'gds.action.check': string;
    'gds.action.uncheck': string;
    'gds.action.complete': string;
    'gds.action.clear': string;
    'gds.action.capture': string;
    'gds.action.record': string;
    'gds.action.flip': string;
    'gds.action.flash': string;
    'gds.action.course': string;
    'gds.action.lesson': string;
    'gds.action.certificate': string;
    'gds.action.student': string;
    'gds.action.class': string;
    'gds.action.grade': string;
    'gds.action.child': string;
    'gds.action.family': string;
    'gds.action.habit': string;
    'gds.action.goal': string;
    'gds.action.streak': string;
    'gds.action.reward': string;
    'gds.action.trophy': string;
    'gds.action.crown': string;
    'gds.action.pause': string;
    'gds.action.message': string;
    'gds.action.mail': string;
    'gds.action.refresh': string;
    'gds.action.trendingUp': string;
    'gds.action.trendingDown': string;
    'gds.action.currency': string;
    'gds.action.grid': string;
    'gds.action.list': string;
    'gds.action.logout': string;
    'gds.action.notifications': string;
    'gds.action.back': string;
    'gds.action.eye': string;
    'gds.action.eyeOff': string;
    'gds.action.help': string;
    'gds.action.filter': string;
    'gds.action.sort': string;
    'gds.feedback.saved': string;
    'gds.feedback.added': string;
    'gds.feedback.edited': string;
    'gds.feedback.deleted': string;
    'gds.feedback.canceled': string;
    'gds.feedback.confirmed': string;
    'gds.feedback.closed': string;
    'gds.feedback.changed': string;
    'gds.feedback.loaded': string;
    'gds.feedback.started': string;
    'gds.feedback.opened': string;
    'gds.feedback.sent': string;
    'gds.feedback.replied': string;
    'gds.feedback.forwarded': string;
    'gds.feedback.attached': string;
    'gds.feedback.uploaded': string;
    'gds.feedback.downloaded': string;
    'gds.feedback.printed': string;
    'gds.feedback.copied': string;
    'gds.feedback.duplicated': string;
    'gds.feedback.checked': string;
    'gds.feedback.unchecked': string;
    'gds.feedback.completed': string;
    'gds.feedback.cleared': string;
    'gds.feedback.captured': string;
    'gds.feedback.recorded': string;
    'gds.feedback.flipped': string;
    'gds.feedback.flashed': string;
    'gds.feedback.done': string;
    'gds.feedback.rewarded': string;
    'gds.feedback.paused': string;
    'gds.feedback.mailed': string;
    'gds.feedback.refreshed': string;
    'gds.feedback.loggedOut': string;
    'gds.feedback.filtered': string;
    'gds.feedback.sorted': string;
};

declare const hu: {
    'gds.action.settings': string;
    'gds.action.analytics': string;
    'gds.action.dashboard': string;
    'gds.action.play': string;
    'gds.action.start': string;
    'gds.action.users': string;
    'gds.action.add': string;
    'gds.action.edit': string;
    'gds.action.delete': string;
    'gds.action.save': string;
    'gds.action.cancel': string;
    'gds.action.confirm': string;
    'gds.action.close': string;
    'gds.action.language': string;
    'gds.action.theme': string;
    'gds.action.home': string;
    'gds.action.inbox': string;
    'gds.action.calendar': string;
    'gds.action.gallery': string;
    'gds.action.history': string;
    'gds.action.profile': string;
    'gds.action.send': string;
    'gds.action.reply': string;
    'gds.action.forward': string;
    'gds.action.attach': string;
    'gds.action.upload': string;
    'gds.action.download': string;
    'gds.action.print': string;
    'gds.action.copy': string;
    'gds.action.duplicate': string;
    'gds.action.check': string;
    'gds.action.uncheck': string;
    'gds.action.complete': string;
    'gds.action.clear': string;
    'gds.action.capture': string;
    'gds.action.record': string;
    'gds.action.flip': string;
    'gds.action.flash': string;
    'gds.action.course': string;
    'gds.action.lesson': string;
    'gds.action.certificate': string;
    'gds.action.student': string;
    'gds.action.class': string;
    'gds.action.grade': string;
    'gds.action.child': string;
    'gds.action.family': string;
    'gds.action.habit': string;
    'gds.action.goal': string;
    'gds.action.streak': string;
    'gds.action.reward': string;
    'gds.action.trophy': string;
    'gds.action.crown': string;
    'gds.action.pause': string;
    'gds.action.message': string;
    'gds.action.mail': string;
    'gds.action.refresh': string;
    'gds.action.trendingUp': string;
    'gds.action.trendingDown': string;
    'gds.action.currency': string;
    'gds.action.grid': string;
    'gds.action.list': string;
    'gds.action.logout': string;
    'gds.action.notifications': string;
    'gds.action.back': string;
    'gds.action.eye': string;
    'gds.action.eyeOff': string;
    'gds.action.help': string;
    'gds.action.filter': string;
    'gds.action.sort': string;
    'gds.feedback.saved': string;
    'gds.feedback.added': string;
    'gds.feedback.edited': string;
    'gds.feedback.deleted': string;
    'gds.feedback.canceled': string;
    'gds.feedback.confirmed': string;
    'gds.feedback.closed': string;
    'gds.feedback.changed': string;
    'gds.feedback.loaded': string;
    'gds.feedback.started': string;
    'gds.feedback.opened': string;
    'gds.feedback.sent': string;
    'gds.feedback.replied': string;
    'gds.feedback.forwarded': string;
    'gds.feedback.attached': string;
    'gds.feedback.uploaded': string;
    'gds.feedback.downloaded': string;
    'gds.feedback.printed': string;
    'gds.feedback.copied': string;
    'gds.feedback.duplicated': string;
    'gds.feedback.checked': string;
    'gds.feedback.unchecked': string;
    'gds.feedback.completed': string;
    'gds.feedback.cleared': string;
    'gds.feedback.captured': string;
    'gds.feedback.recorded': string;
    'gds.feedback.flipped': string;
    'gds.feedback.flashed': string;
    'gds.feedback.done': string;
    'gds.feedback.rewarded': string;
    'gds.feedback.paused': string;
    'gds.feedback.mailed': string;
    'gds.feedback.refreshed': string;
    'gds.feedback.loggedOut': string;
    'gds.feedback.filtered': string;
    'gds.feedback.sorted': string;
};

declare const de: {
    'gds.action.settings': string;
    'gds.action.analytics': string;
    'gds.action.dashboard': string;
    'gds.action.play': string;
    'gds.action.start': string;
    'gds.action.users': string;
    'gds.action.add': string;
    'gds.action.edit': string;
    'gds.action.delete': string;
    'gds.action.save': string;
    'gds.action.cancel': string;
    'gds.action.confirm': string;
    'gds.action.close': string;
    'gds.action.language': string;
    'gds.action.theme': string;
    'gds.action.home': string;
    'gds.action.inbox': string;
    'gds.action.calendar': string;
    'gds.action.gallery': string;
    'gds.action.history': string;
    'gds.action.profile': string;
    'gds.action.send': string;
    'gds.action.reply': string;
    'gds.action.forward': string;
    'gds.action.attach': string;
    'gds.action.upload': string;
    'gds.action.download': string;
    'gds.action.print': string;
    'gds.action.copy': string;
    'gds.action.duplicate': string;
    'gds.action.check': string;
    'gds.action.uncheck': string;
    'gds.action.complete': string;
    'gds.action.clear': string;
    'gds.action.capture': string;
    'gds.action.record': string;
    'gds.action.flip': string;
    'gds.action.flash': string;
    'gds.action.course': string;
    'gds.action.lesson': string;
    'gds.action.certificate': string;
    'gds.action.student': string;
    'gds.action.class': string;
    'gds.action.grade': string;
    'gds.action.child': string;
    'gds.action.family': string;
    'gds.action.habit': string;
    'gds.action.goal': string;
    'gds.action.streak': string;
    'gds.action.reward': string;
    'gds.action.trophy': string;
    'gds.action.crown': string;
    'gds.action.pause': string;
    'gds.action.message': string;
    'gds.action.mail': string;
    'gds.action.refresh': string;
    'gds.action.trendingUp': string;
    'gds.action.trendingDown': string;
    'gds.action.currency': string;
    'gds.action.grid': string;
    'gds.action.list': string;
    'gds.action.logout': string;
    'gds.action.notifications': string;
    'gds.action.back': string;
    'gds.action.eye': string;
    'gds.action.eyeOff': string;
    'gds.action.help': string;
    'gds.action.filter': string;
    'gds.action.sort': string;
    'gds.feedback.saved': string;
    'gds.feedback.added': string;
    'gds.feedback.edited': string;
    'gds.feedback.deleted': string;
    'gds.feedback.canceled': string;
    'gds.feedback.confirmed': string;
    'gds.feedback.closed': string;
    'gds.feedback.changed': string;
    'gds.feedback.loaded': string;
    'gds.feedback.started': string;
    'gds.feedback.opened': string;
    'gds.feedback.sent': string;
    'gds.feedback.replied': string;
    'gds.feedback.forwarded': string;
    'gds.feedback.attached': string;
    'gds.feedback.uploaded': string;
    'gds.feedback.downloaded': string;
    'gds.feedback.printed': string;
    'gds.feedback.copied': string;
    'gds.feedback.duplicated': string;
    'gds.feedback.checked': string;
    'gds.feedback.unchecked': string;
    'gds.feedback.completed': string;
    'gds.feedback.cleared': string;
    'gds.feedback.captured': string;
    'gds.feedback.recorded': string;
    'gds.feedback.flipped': string;
    'gds.feedback.flashed': string;
    'gds.feedback.done': string;
    'gds.feedback.rewarded': string;
    'gds.feedback.paused': string;
    'gds.feedback.mailed': string;
    'gds.feedback.refreshed': string;
    'gds.feedback.loggedOut': string;
    'gds.feedback.filtered': string;
    'gds.feedback.sorted': string;
};

declare const fr: {
    'gds.action.settings': string;
    'gds.action.analytics': string;
    'gds.action.dashboard': string;
    'gds.action.play': string;
    'gds.action.start': string;
    'gds.action.users': string;
    'gds.action.add': string;
    'gds.action.edit': string;
    'gds.action.delete': string;
    'gds.action.save': string;
    'gds.action.cancel': string;
    'gds.action.confirm': string;
    'gds.action.close': string;
    'gds.action.language': string;
    'gds.action.theme': string;
    'gds.action.home': string;
    'gds.action.inbox': string;
    'gds.action.calendar': string;
    'gds.action.gallery': string;
    'gds.action.history': string;
    'gds.action.profile': string;
    'gds.action.send': string;
    'gds.action.reply': string;
    'gds.action.forward': string;
    'gds.action.attach': string;
    'gds.action.upload': string;
    'gds.action.download': string;
    'gds.action.print': string;
    'gds.action.copy': string;
    'gds.action.duplicate': string;
    'gds.action.check': string;
    'gds.action.uncheck': string;
    'gds.action.complete': string;
    'gds.action.clear': string;
    'gds.action.capture': string;
    'gds.action.record': string;
    'gds.action.flip': string;
    'gds.action.flash': string;
    'gds.action.course': string;
    'gds.action.lesson': string;
    'gds.action.certificate': string;
    'gds.action.student': string;
    'gds.action.class': string;
    'gds.action.grade': string;
    'gds.action.child': string;
    'gds.action.family': string;
    'gds.action.habit': string;
    'gds.action.goal': string;
    'gds.action.streak': string;
    'gds.action.reward': string;
    'gds.action.trophy': string;
    'gds.action.crown': string;
    'gds.action.pause': string;
    'gds.action.message': string;
    'gds.action.mail': string;
    'gds.action.refresh': string;
    'gds.action.trendingUp': string;
    'gds.action.trendingDown': string;
    'gds.action.currency': string;
    'gds.action.grid': string;
    'gds.action.list': string;
    'gds.action.logout': string;
    'gds.action.notifications': string;
    'gds.action.back': string;
    'gds.action.eye': string;
    'gds.action.eyeOff': string;
    'gds.action.help': string;
    'gds.action.filter': string;
    'gds.action.sort': string;
    'gds.feedback.saved': string;
    'gds.feedback.added': string;
    'gds.feedback.edited': string;
    'gds.feedback.deleted': string;
    'gds.feedback.canceled': string;
    'gds.feedback.confirmed': string;
    'gds.feedback.closed': string;
    'gds.feedback.changed': string;
    'gds.feedback.loaded': string;
    'gds.feedback.started': string;
    'gds.feedback.opened': string;
    'gds.feedback.sent': string;
    'gds.feedback.replied': string;
    'gds.feedback.forwarded': string;
    'gds.feedback.attached': string;
    'gds.feedback.uploaded': string;
    'gds.feedback.downloaded': string;
    'gds.feedback.printed': string;
    'gds.feedback.copied': string;
    'gds.feedback.duplicated': string;
    'gds.feedback.checked': string;
    'gds.feedback.unchecked': string;
    'gds.feedback.completed': string;
    'gds.feedback.cleared': string;
    'gds.feedback.captured': string;
    'gds.feedback.recorded': string;
    'gds.feedback.flipped': string;
    'gds.feedback.flashed': string;
    'gds.feedback.done': string;
    'gds.feedback.rewarded': string;
    'gds.feedback.paused': string;
    'gds.feedback.mailed': string;
    'gds.feedback.refreshed': string;
    'gds.feedback.loggedOut': string;
    'gds.feedback.filtered': string;
    'gds.feedback.sorted': string;
};

declare const it: {
    'gds.action.settings': string;
    'gds.action.analytics': string;
    'gds.action.dashboard': string;
    'gds.action.play': string;
    'gds.action.start': string;
    'gds.action.users': string;
    'gds.action.add': string;
    'gds.action.edit': string;
    'gds.action.delete': string;
    'gds.action.save': string;
    'gds.action.cancel': string;
    'gds.action.confirm': string;
    'gds.action.close': string;
    'gds.action.language': string;
    'gds.action.theme': string;
    'gds.action.home': string;
    'gds.action.inbox': string;
    'gds.action.calendar': string;
    'gds.action.gallery': string;
    'gds.action.history': string;
    'gds.action.profile': string;
    'gds.action.send': string;
    'gds.action.reply': string;
    'gds.action.forward': string;
    'gds.action.attach': string;
    'gds.action.upload': string;
    'gds.action.download': string;
    'gds.action.print': string;
    'gds.action.copy': string;
    'gds.action.duplicate': string;
    'gds.action.check': string;
    'gds.action.uncheck': string;
    'gds.action.complete': string;
    'gds.action.clear': string;
    'gds.action.capture': string;
    'gds.action.record': string;
    'gds.action.flip': string;
    'gds.action.flash': string;
    'gds.action.course': string;
    'gds.action.lesson': string;
    'gds.action.certificate': string;
    'gds.action.student': string;
    'gds.action.class': string;
    'gds.action.grade': string;
    'gds.action.child': string;
    'gds.action.family': string;
    'gds.action.habit': string;
    'gds.action.goal': string;
    'gds.action.streak': string;
    'gds.action.reward': string;
    'gds.action.trophy': string;
    'gds.action.crown': string;
    'gds.action.pause': string;
    'gds.action.message': string;
    'gds.action.mail': string;
    'gds.action.refresh': string;
    'gds.action.trendingUp': string;
    'gds.action.trendingDown': string;
    'gds.action.currency': string;
    'gds.action.grid': string;
    'gds.action.list': string;
    'gds.action.logout': string;
    'gds.action.notifications': string;
    'gds.action.back': string;
    'gds.action.eye': string;
    'gds.action.eyeOff': string;
    'gds.action.help': string;
    'gds.action.filter': string;
    'gds.action.sort': string;
    'gds.feedback.saved': string;
    'gds.feedback.added': string;
    'gds.feedback.edited': string;
    'gds.feedback.deleted': string;
    'gds.feedback.canceled': string;
    'gds.feedback.confirmed': string;
    'gds.feedback.closed': string;
    'gds.feedback.changed': string;
    'gds.feedback.loaded': string;
    'gds.feedback.started': string;
    'gds.feedback.opened': string;
    'gds.feedback.sent': string;
    'gds.feedback.replied': string;
    'gds.feedback.forwarded': string;
    'gds.feedback.attached': string;
    'gds.feedback.uploaded': string;
    'gds.feedback.downloaded': string;
    'gds.feedback.printed': string;
    'gds.feedback.copied': string;
    'gds.feedback.duplicated': string;
    'gds.feedback.checked': string;
    'gds.feedback.unchecked': string;
    'gds.feedback.completed': string;
    'gds.feedback.cleared': string;
    'gds.feedback.captured': string;
    'gds.feedback.recorded': string;
    'gds.feedback.flipped': string;
    'gds.feedback.flashed': string;
    'gds.feedback.done': string;
    'gds.feedback.rewarded': string;
    'gds.feedback.paused': string;
    'gds.feedback.mailed': string;
    'gds.feedback.refreshed': string;
    'gds.feedback.loggedOut': string;
    'gds.feedback.filtered': string;
    'gds.feedback.sorted': string;
};

declare const ru: {
    'gds.action.settings': string;
    'gds.action.analytics': string;
    'gds.action.dashboard': string;
    'gds.action.play': string;
    'gds.action.start': string;
    'gds.action.users': string;
    'gds.action.add': string;
    'gds.action.edit': string;
    'gds.action.delete': string;
    'gds.action.save': string;
    'gds.action.cancel': string;
    'gds.action.confirm': string;
    'gds.action.close': string;
    'gds.action.language': string;
    'gds.action.theme': string;
    'gds.action.home': string;
    'gds.action.inbox': string;
    'gds.action.calendar': string;
    'gds.action.gallery': string;
    'gds.action.history': string;
    'gds.action.profile': string;
    'gds.action.send': string;
    'gds.action.reply': string;
    'gds.action.forward': string;
    'gds.action.attach': string;
    'gds.action.upload': string;
    'gds.action.download': string;
    'gds.action.print': string;
    'gds.action.copy': string;
    'gds.action.duplicate': string;
    'gds.action.check': string;
    'gds.action.uncheck': string;
    'gds.action.complete': string;
    'gds.action.clear': string;
    'gds.action.capture': string;
    'gds.action.record': string;
    'gds.action.flip': string;
    'gds.action.flash': string;
    'gds.action.course': string;
    'gds.action.lesson': string;
    'gds.action.certificate': string;
    'gds.action.student': string;
    'gds.action.class': string;
    'gds.action.grade': string;
    'gds.action.child': string;
    'gds.action.family': string;
    'gds.action.habit': string;
    'gds.action.goal': string;
    'gds.action.streak': string;
    'gds.action.reward': string;
    'gds.action.trophy': string;
    'gds.action.crown': string;
    'gds.action.pause': string;
    'gds.action.message': string;
    'gds.action.mail': string;
    'gds.action.refresh': string;
    'gds.action.trendingUp': string;
    'gds.action.trendingDown': string;
    'gds.action.currency': string;
    'gds.action.grid': string;
    'gds.action.list': string;
    'gds.action.logout': string;
    'gds.action.notifications': string;
    'gds.action.back': string;
    'gds.action.eye': string;
    'gds.action.eyeOff': string;
    'gds.action.help': string;
    'gds.action.filter': string;
    'gds.action.sort': string;
    'gds.feedback.saved': string;
    'gds.feedback.added': string;
    'gds.feedback.edited': string;
    'gds.feedback.deleted': string;
    'gds.feedback.canceled': string;
    'gds.feedback.confirmed': string;
    'gds.feedback.closed': string;
    'gds.feedback.changed': string;
    'gds.feedback.loaded': string;
    'gds.feedback.started': string;
    'gds.feedback.opened': string;
    'gds.feedback.sent': string;
    'gds.feedback.replied': string;
    'gds.feedback.forwarded': string;
    'gds.feedback.attached': string;
    'gds.feedback.uploaded': string;
    'gds.feedback.downloaded': string;
    'gds.feedback.printed': string;
    'gds.feedback.copied': string;
    'gds.feedback.duplicated': string;
    'gds.feedback.checked': string;
    'gds.feedback.unchecked': string;
    'gds.feedback.completed': string;
    'gds.feedback.cleared': string;
    'gds.feedback.captured': string;
    'gds.feedback.recorded': string;
    'gds.feedback.flipped': string;
    'gds.feedback.flashed': string;
    'gds.feedback.done': string;
    'gds.feedback.rewarded': string;
    'gds.feedback.paused': string;
    'gds.feedback.mailed': string;
    'gds.feedback.refreshed': string;
    'gds.feedback.loggedOut': string;
    'gds.feedback.filtered': string;
    'gds.feedback.sorted': string;
};

declare const he: {
    'gds.action.settings': string;
    'gds.action.analytics': string;
    'gds.action.dashboard': string;
    'gds.action.play': string;
    'gds.action.start': string;
    'gds.action.users': string;
    'gds.action.add': string;
    'gds.action.edit': string;
    'gds.action.delete': string;
    'gds.action.save': string;
    'gds.action.cancel': string;
    'gds.action.confirm': string;
    'gds.action.close': string;
    'gds.action.language': string;
    'gds.action.theme': string;
    'gds.action.home': string;
    'gds.action.inbox': string;
    'gds.action.calendar': string;
    'gds.action.gallery': string;
    'gds.action.history': string;
    'gds.action.profile': string;
    'gds.action.send': string;
    'gds.action.reply': string;
    'gds.action.forward': string;
    'gds.action.attach': string;
    'gds.action.upload': string;
    'gds.action.download': string;
    'gds.action.print': string;
    'gds.action.copy': string;
    'gds.action.duplicate': string;
    'gds.action.check': string;
    'gds.action.uncheck': string;
    'gds.action.complete': string;
    'gds.action.clear': string;
    'gds.action.capture': string;
    'gds.action.record': string;
    'gds.action.flip': string;
    'gds.action.flash': string;
    'gds.action.course': string;
    'gds.action.lesson': string;
    'gds.action.certificate': string;
    'gds.action.student': string;
    'gds.action.class': string;
    'gds.action.grade': string;
    'gds.action.child': string;
    'gds.action.family': string;
    'gds.action.habit': string;
    'gds.action.goal': string;
    'gds.action.streak': string;
    'gds.action.reward': string;
    'gds.action.trophy': string;
    'gds.action.crown': string;
    'gds.action.pause': string;
    'gds.action.message': string;
    'gds.action.mail': string;
    'gds.action.refresh': string;
    'gds.action.trendingUp': string;
    'gds.action.trendingDown': string;
    'gds.action.currency': string;
    'gds.action.grid': string;
    'gds.action.list': string;
    'gds.action.logout': string;
    'gds.action.notifications': string;
    'gds.action.back': string;
    'gds.action.eye': string;
    'gds.action.eyeOff': string;
    'gds.action.help': string;
    'gds.action.filter': string;
    'gds.action.sort': string;
    'gds.feedback.saved': string;
    'gds.feedback.added': string;
    'gds.feedback.edited': string;
    'gds.feedback.deleted': string;
    'gds.feedback.canceled': string;
    'gds.feedback.confirmed': string;
    'gds.feedback.closed': string;
    'gds.feedback.changed': string;
    'gds.feedback.loaded': string;
    'gds.feedback.started': string;
    'gds.feedback.opened': string;
    'gds.feedback.sent': string;
    'gds.feedback.replied': string;
    'gds.feedback.forwarded': string;
    'gds.feedback.attached': string;
    'gds.feedback.uploaded': string;
    'gds.feedback.downloaded': string;
    'gds.feedback.printed': string;
    'gds.feedback.copied': string;
    'gds.feedback.duplicated': string;
    'gds.feedback.checked': string;
    'gds.feedback.unchecked': string;
    'gds.feedback.completed': string;
    'gds.feedback.cleared': string;
    'gds.feedback.captured': string;
    'gds.feedback.recorded': string;
    'gds.feedback.flipped': string;
    'gds.feedback.flashed': string;
    'gds.feedback.done': string;
    'gds.feedback.rewarded': string;
    'gds.feedback.paused': string;
    'gds.feedback.mailed': string;
    'gds.feedback.refreshed': string;
    'gds.feedback.loggedOut': string;
    'gds.feedback.filtered': string;
    'gds.feedback.sorted': string;
};

declare const ar: {
    'gds.action.settings': string;
    'gds.action.analytics': string;
    'gds.action.dashboard': string;
    'gds.action.play': string;
    'gds.action.start': string;
    'gds.action.users': string;
    'gds.action.add': string;
    'gds.action.edit': string;
    'gds.action.delete': string;
    'gds.action.save': string;
    'gds.action.cancel': string;
    'gds.action.confirm': string;
    'gds.action.close': string;
    'gds.action.language': string;
    'gds.action.theme': string;
    'gds.action.home': string;
    'gds.action.inbox': string;
    'gds.action.calendar': string;
    'gds.action.gallery': string;
    'gds.action.history': string;
    'gds.action.profile': string;
    'gds.action.send': string;
    'gds.action.reply': string;
    'gds.action.forward': string;
    'gds.action.attach': string;
    'gds.action.upload': string;
    'gds.action.download': string;
    'gds.action.print': string;
    'gds.action.copy': string;
    'gds.action.duplicate': string;
    'gds.action.check': string;
    'gds.action.uncheck': string;
    'gds.action.complete': string;
    'gds.action.clear': string;
    'gds.action.capture': string;
    'gds.action.record': string;
    'gds.action.flip': string;
    'gds.action.flash': string;
    'gds.action.course': string;
    'gds.action.lesson': string;
    'gds.action.certificate': string;
    'gds.action.student': string;
    'gds.action.class': string;
    'gds.action.grade': string;
    'gds.action.child': string;
    'gds.action.family': string;
    'gds.action.habit': string;
    'gds.action.goal': string;
    'gds.action.streak': string;
    'gds.action.reward': string;
    'gds.action.trophy': string;
    'gds.action.crown': string;
    'gds.action.pause': string;
    'gds.action.message': string;
    'gds.action.mail': string;
    'gds.action.refresh': string;
    'gds.action.trendingUp': string;
    'gds.action.trendingDown': string;
    'gds.action.currency': string;
    'gds.action.grid': string;
    'gds.action.list': string;
    'gds.action.logout': string;
    'gds.action.notifications': string;
    'gds.action.back': string;
    'gds.action.eye': string;
    'gds.action.eyeOff': string;
    'gds.action.help': string;
    'gds.action.filter': string;
    'gds.action.sort': string;
    'gds.feedback.saved': string;
    'gds.feedback.added': string;
    'gds.feedback.edited': string;
    'gds.feedback.deleted': string;
    'gds.feedback.canceled': string;
    'gds.feedback.confirmed': string;
    'gds.feedback.closed': string;
    'gds.feedback.changed': string;
    'gds.feedback.loaded': string;
    'gds.feedback.started': string;
    'gds.feedback.opened': string;
    'gds.feedback.sent': string;
    'gds.feedback.replied': string;
    'gds.feedback.forwarded': string;
    'gds.feedback.attached': string;
    'gds.feedback.uploaded': string;
    'gds.feedback.downloaded': string;
    'gds.feedback.printed': string;
    'gds.feedback.copied': string;
    'gds.feedback.duplicated': string;
    'gds.feedback.checked': string;
    'gds.feedback.unchecked': string;
    'gds.feedback.completed': string;
    'gds.feedback.cleared': string;
    'gds.feedback.captured': string;
    'gds.feedback.recorded': string;
    'gds.feedback.flipped': string;
    'gds.feedback.flashed': string;
    'gds.feedback.done': string;
    'gds.feedback.rewarded': string;
    'gds.feedback.paused': string;
    'gds.feedback.mailed': string;
    'gds.feedback.refreshed': string;
    'gds.feedback.loggedOut': string;
    'gds.feedback.filtered': string;
    'gds.feedback.sorted': string;
};

export { ConfirmDialog, type ConfirmDialogProps, EmptyState, type EmptyStateProps, GdsIcons, GdsVocabulary, type SemanticAction, SemanticButton, type SemanticButtonProps, StatusBadge, type StatusBadgeProps, type StatusVariant, ThemeToggle, type ThemeToggleProps, ar, de, en, fr, he, hu, it, ru };

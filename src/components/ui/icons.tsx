import { HugeiconsIcon, type HugeiconsIconProps } from "@hugeicons/react"
import { cn } from "@/lib/utils"
import {
  Activity01Icon,
  AiChat02Icon,
  Alert02Icon,
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowDownLeft01Icon,
  ArrowLeft01Icon,
  ArrowLeft02Icon,
  ArrowRight01Icon,
  ArrowRight02Icon,
  ArrowTurnBackwardIcon,
  ArrowUp02Icon,
  ArrowUpRight01Icon,
  Building03Icon,
  Calendar03Icon,
  CancelCircleIcon,
  Cancel01Icon,
  ChartColumnIcon,
  ChartIncreaseIcon,
  CheckmarkBadge01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  Clock04Icon,
  CloudUploadIcon,
  ComputerIcon,
  Copy01Icon,
  CreditCardIcon,
  DatabaseIcon,
  Delete02Icon,
  Download01Icon,
  FileUnknownIcon,
  FlashIcon,
  Globe02Icon,
  HelpCircleIcon,
  Home01Icon,
  InboxIcon,
  InformationCircleIcon,
  Invoice01Icon,
  LinkSquare02Icon,
  Loading03Icon,
  Location01Icon,
  Mail01Icon,
  MailReply01Icon,
  Maximize01Icon,
  Menu01Icon,
  Message01Icon,
  MinusSignIcon,
  MoneyBag02Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  PlusSignIcon,
  RefreshIcon,
  Search01Icon,
  SecurityCheckIcon,
  SentIcon,
  Settings01Icon,
  SidebarLeftIcon,
  SparklesIcon,
  StopCircleIcon,
  Tag01Icon,
  Target02Icon,
  Tick02Icon,
  UnfoldMoreIcon,
  UserCircleIcon,
  UserGroupIcon,
  UserIcon,
  VolumeOffIcon,
} from "@hugeicons/core-free-icons"

/**
 * The app's icon set: Hugeicons (free, MIT, Stroke Rounded). Lucide and
 * Phosphor were removed; the names below kept their old Lucide names so
 * call sites did not change.
 *
 * Sizes: 16px default (size-4), 14px in dense rows (size-3.5), 20px large
 * (size-5). Stroke is set in rendered pixels by the .ui-icon rule in
 * globals.css (better-ui: 1.5px next to regular text, 2px next to medium or
 * semibold text). Set --icon-stroke on a parent to change it; the strokeWidth
 * prop is overridden. Icons are decorative (aria-hidden) unless given an
 * aria-label; icon-only buttons need their own aria-label.
 */
export type IconProps = Omit<HugeiconsIconProps, "icon">
export type Icon = (props: IconProps) => React.JSX.Element

function icon(svg: HugeiconsIconProps["icon"], name: string): Icon {
  function IconComponent({ size = 16, className, ...props }: IconProps) {
    const labelled = props["aria-label"] !== undefined || props["aria-labelledby"] !== undefined
    return (
      <HugeiconsIcon
        icon={svg}
        size={size}
        className={cn("ui-icon", className)}
        aria-hidden={labelled ? undefined : true}
        focusable={false}
        {...props}
      />
    )
  }
  IconComponent.displayName = name
  return IconComponent
}

export const Activity = icon(Activity01Icon, "Activity")
export const AlertCircle = icon(AlertCircleIcon, "AlertCircle")
export const AlertTriangle = icon(Alert02Icon, "AlertTriangle")
export const ArrowDownLeft = icon(ArrowDownLeft01Icon, "ArrowDownLeft")
export const ArrowLeft = icon(ArrowLeft02Icon, "ArrowLeft")
export const ArrowRight = icon(ArrowRight02Icon, "ArrowRight")
export const ArrowUp = icon(ArrowUp02Icon, "ArrowUp")
export const ArrowUpRight = icon(ArrowUpRight01Icon, "ArrowUpRight")
export const BadgeCheck = icon(CheckmarkBadge01Icon, "BadgeCheck")
export const Banknote = icon(MoneyBag02Icon, "Banknote")
export const BarChart3 = icon(ChartColumnIcon, "BarChart3")
export const Bot = icon(AiChat02Icon, "Bot")
export const Building2 = icon(Building03Icon, "Building2")
export const Calendar = icon(Calendar03Icon, "Calendar")
export const Check = icon(Tick02Icon, "Check")
export const CheckCircle2 = icon(CheckmarkCircle02Icon, "CheckCircle2")
export const ChevronDown = icon(ArrowDown01Icon, "ChevronDown")
export const ChevronLeft = icon(ArrowLeft01Icon, "ChevronLeft")
export const ChevronRight = icon(ArrowRight01Icon, "ChevronRight")
export const ChevronUpDown = icon(UnfoldMoreIcon, "ChevronUpDown")
export const Clock = icon(Clock01Icon, "Clock")
export const Copy = icon(Copy01Icon, "Copy")
export const CreditCard = icon(CreditCardIcon, "CreditCard")
export const Download = icon(Download01Icon, "Download")
export const Edit2 = icon(PencilEdit02Icon, "Edit2")
export const ExternalLink = icon(LinkSquare02Icon, "ExternalLink")
export const FileQuestion = icon(FileUnknownIcon, "FileQuestion")
export const Globe = icon(Globe02Icon, "Globe")
export const HelpCircle = icon(HelpCircleIcon, "HelpCircle")
export const History = icon(Clock04Icon, "History")
export const Home = icon(Home01Icon, "Home")
export const Inbox = icon(InboxIcon, "Inbox")
export const Info = icon(InformationCircleIcon, "Info")
export const Loader2 = icon(Loading03Icon, "Loader2")
export const Mail = icon(Mail01Icon, "Mail")
export const MailReply = icon(MailReply01Icon, "MailReply")
export const MapPin = icon(Location01Icon, "MapPin")
export const Maximize = icon(Maximize01Icon, "Maximize")
export const Menu = icon(Menu01Icon, "Menu")
export const MessageSquare = icon(Message01Icon, "MessageSquare")
export const Minus = icon(MinusSignIcon, "Minus")
export const Monitor = icon(ComputerIcon, "Monitor")
export const MoreHorizontal = icon(MoreHorizontalIcon, "MoreHorizontal")
export const PanelLeft = icon(SidebarLeftIcon, "PanelLeft")
export const Plus = icon(PlusSignIcon, "Plus")
export const Receipt = icon(Invoice01Icon, "Receipt")
export const RefreshCw = icon(RefreshIcon, "RefreshCw")
export const RotateCcw = icon(ArrowTurnBackwardIcon, "RotateCcw")
export const Search = icon(Search01Icon, "Search")
export const Send = icon(SentIcon, "Send")
export const Server = icon(DatabaseIcon, "Server")
export const Settings = icon(Settings01Icon, "Settings")
export const ShieldCheck = icon(SecurityCheckIcon, "ShieldCheck")
export const Sparkles = icon(SparklesIcon, "Sparkles")
export const StopCircle = icon(StopCircleIcon, "StopCircle")
export const Tag = icon(Tag01Icon, "Tag")
export const Target = icon(Target02Icon, "Target")
export const Trash2 = icon(Delete02Icon, "Trash2")
export const TrendingUp = icon(ChartIncreaseIcon, "TrendingUp")
export const UploadCloud = icon(CloudUploadIcon, "UploadCloud")
export const User = icon(UserIcon, "User")
export const UserRound = icon(UserCircleIcon, "UserRound")
export const Users = icon(UserGroupIcon, "Users")
export const VolumeX = icon(VolumeOffIcon, "VolumeX")
export const X = icon(Cancel01Icon, "X")
export const XCircle = icon(CancelCircleIcon, "XCircle")
export const Zap = icon(FlashIcon, "Zap")

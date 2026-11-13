import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  RiArrowRightSLine,
  RiLinkedinBoxFill,
  RiMailFill,
  RiQuillPenLine,
  RiSparkling2Line,
  RiTimeLine,
  RiWhatsappFill,
} from "@remixicon/react";
import { AppIcon } from "@/components/brand/Logo";
import type { Messages } from "@/i18n/catalog";
import { cn } from "@/utils/cn";

/**
 * The panel beside the auth forms: a photograph, and over it a slice of
 * the product doing its job — the morning's replies from every channel,
 * each already sorted. The table bleeds off the right edge on purpose: it
 * is a window onto the app, not a picture of all of it.
 *
 * Every person and company here is fictional (the same names the demo
 * seed uses): the names stay as they are in every language, while roles,
 * replies, categories and labels are translated. Decorative: hidden from
 * assistive tech.
 *
 * Photo: Marek Piwnicki, https://unsplash.com/photos/w4sxddUJ5-0 — free
 * under the Unsplash License (https://unsplash.com/license).
 */

type Channel = "email" | "linkedin" | "whatsapp";
type Category = "interested" | "meetingBooked" | "outOfOffice" | "notNow" | "referral";
type Showcase = Messages["auth"]["showcase"];

/** The numbers the mock-up shows; the nouns around them are plural-aware messages. */
const NEW_TODAY = 24;
const INTERESTED = 9;
const DRAFTS = 9;
const MEETINGS = 3;

const REPLIES: {
  name: string;
  roleKey: keyof Showcase["roles"];
  company: string;
  channel: Channel;
  replyKey: keyof Showcase["replies"];
  category: Category;
  tint: string;
}[] = [
  { name: "Sana Brennan", roleKey: "headOfOps", company: "Pinecrest Health", channel: "linkedin", replyKey: "sana", category: "interested", tint: "bg-sky-100 text-sky-800" },
  { name: "Diego Underhill", roleKey: "vpSales", company: "Harborview Logistics", channel: "email", replyKey: "diego", category: "meetingBooked", tint: "bg-amber-100 text-amber-800" },
  { name: "Amara Lindqvist", roleKey: "revOpsLead", company: "Tallgrass Energy", channel: "whatsapp", replyKey: "amara", category: "interested", tint: "bg-emerald-100 text-emerald-800" },
  { name: "Theo Marlowe", roleKey: "directorCs", company: "Saltmarsh Foods", channel: "email", replyKey: "theo", category: "outOfOffice", tint: "bg-orange-100 text-orange-800" },
  { name: "Hugo Okafor", roleKey: "cro", company: "Zephyr Cloudworks", channel: "email", replyKey: "hugo", category: "meetingBooked", tint: "bg-violet-100 text-violet-800" },
  { name: "Nia Zielinski", roleKey: "sdrManager", company: "Redwood Robotics", channel: "linkedin", replyKey: "nia", category: "notNow", tint: "bg-rose-100 text-rose-800" },
  { name: "Mei Rasmussen", roleKey: "marketingManager", company: "Brightloop", channel: "whatsapp", replyKey: "mei", category: "referral", tint: "bg-indigo-100 text-indigo-800" },
  { name: "Lucas Yilmaz", roleKey: "founder", company: "Verdant Learning", channel: "linkedin", replyKey: "lucas", category: "interested", tint: "bg-teal-100 text-teal-800" },
];

const CHANNEL = {
  email: { Icon: RiMailFill, labelKey: "email", className: "text-[#f26b3a]" },
  linkedin: { Icon: RiLinkedinBoxFill, labelKey: "linkedin", className: "text-[#0a66c2]" },
  whatsapp: { Icon: RiWhatsappFill, labelKey: "whatsapp", className: "text-[#1fae55]" },
} satisfies Record<Channel, { Icon: typeof RiMailFill; labelKey: keyof Showcase["channels"]; className: string }>;

const CATEGORY: Record<Category, string> = {
  interested: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  meetingBooked: "bg-[#335cff]/[0.08] text-[#2547d0] ring-[#335cff]/20",
  outOfOffice: "bg-amber-50 text-amber-700 ring-amber-600/15",
  notNow: "bg-zinc-100 text-zinc-600 ring-zinc-500/15",
  referral: "bg-violet-50 text-violet-700 ring-violet-600/15",
};

const CHIPS: { Icon: typeof RiSparkling2Line; labelKey: keyof Showcase["chips"] }[] = [
  { Icon: RiSparkling2Line, labelKey: "classify" },
  { Icon: RiQuillPenLine, labelKey: "draft" },
  { Icon: RiTimeLine, labelKey: "followUp" },
];

/** Lead, channel, category, reply: the reply runs off the right edge. */
const COLUMNS = "grid grid-cols-[220px_112px_150px_1fr]";

/** Role and company side by side, not a sentence; the company name is a fictional proper noun and is not translated. */
const ROLE_SEPARATOR = " · ";

const initials = (name: string) => name.split(" ").map((p) => p[0]).join("");

/** Glass on the photograph: the status line above the table and the chips below it. */
const glass = "border border-white/15 bg-black/25 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] backdrop-blur-md";

export function AuthShowcase({ className }: { className?: string }) {
  const t = useTranslations("auth.showcase");
  /** The bold figure in the footer line: the message supplies the noun, with its plural. */
  const figure = (chunks: React.ReactNode) => <span className="font-medium text-zinc-800">{chunks}</span>;
  const classified = t.rich("classified", { count: NEW_TODAY, figure });
  const draftsReady = t.rich("draftsReady", { count: DRAFTS, figure });
  const meetingsBooked = t.rich("meetingsBooked", { count: MEETINGS, figure });
  return (
    <div aria-hidden="true" className={cn("relative h-full w-full overflow-hidden rounded-[28px] bg-[#05070f]", className)}>
      <Image src="/auth/blue-light.webp" alt="" fill sizes="50vw" className="object-cover object-[50%_35%]" />
      {/* Settle the photo so the white table reads cleanly against it. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/60" />

      {/* Status line, table and chips: one column, centred, bleeding off the right edge. */}
      <div className="absolute inset-y-0 left-[8%] right-0 flex flex-col justify-center gap-6 py-10">
        <div className={cn(glass, "flex items-center gap-2.5 self-start rounded-full py-1.5 pl-1.5 pr-3 text-[13px]")}>
          <AppIcon small className="size-6" />
          <span className="font-medium">{t("status", { count: NEW_TODAY })}</span>
          <RiArrowRightSLine className="size-4 text-white/60" />
        </div>

        <div className="w-[max(780px,100%)] shrink-0 overflow-hidden rounded-xl bg-white text-zinc-900 shadow-[0_30px_80px_-20px_rgb(2_6_23/0.7),0_0_0_1px_rgb(255_255_255/0.4)]">
          <div className="flex items-center gap-3 border-b border-zinc-200/80 px-5 py-3.5">
            <span className="text-[15px] font-semibold tracking-[-0.01em]">{t("title")}</span>
            <span className="text-[13px] text-zinc-500">{t("newToday", { count: NEW_TODAY })}</span>
            <div className="ml-6 flex gap-1 text-[12px] font-medium">
              <span className="rounded-md bg-zinc-900 px-2 py-1 text-white">{t("tabAll")}</span>
              <span className="rounded-md px-2 py-1 text-zinc-500">{t("tabInterested", { count: INTERESTED })}</span>
              <span className="rounded-md px-2 py-1 text-zinc-500">{t("tabMeetings", { count: MEETINGS })}</span>
            </div>
          </div>
          <div className={cn(COLUMNS, "border-b border-zinc-200/80 bg-zinc-50 px-5 py-2 text-[12px] font-medium text-zinc-500")}>
            <span>{t("columns.lead")}</span>
            <span>{t("columns.channel")}</span>
            <span>{t("columns.category")}</span>
            <span>{t("columns.reply")}</span>
          </div>
          <div className="relative">
            {REPLIES.map((r) => {
              const ch = CHANNEL[r.channel];
              const role = [t(`roles.${r.roleKey}`), r.company].join(ROLE_SEPARATOR);
              return (
                <div key={r.name} className={cn(COLUMNS, "items-center border-b border-zinc-100 px-5 py-2.5 text-[13px] last:border-b-0")}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", r.tint)}>{initials(r.name)}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium leading-tight">{r.name}</span>
                      <span className="block truncate text-[11.5px] leading-tight text-zinc-500">{role}</span>
                    </span>
                  </div>
                  <span className="flex items-center gap-1.5 text-zinc-600">
                    <ch.Icon className={cn("size-4", ch.className)} />
                    {t(`channels.${ch.labelKey}`)}
                  </span>
                  <span>
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-medium ring-1 ring-inset", CATEGORY[r.category])}>{t(`categories.${r.category}`)}</span>
                  </span>
                  <span className="truncate pr-5 text-zinc-700">{t(`replies.${r.replyKey}`)}</span>
                </div>
              );
            })}
            {/* The list carries on below the fold. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-b from-white/0 to-white" />
          </div>
          <div className="flex items-center gap-3 border-t border-zinc-200/80 bg-zinc-50 px-5 py-2.5 text-[12px] text-zinc-500">
            <span>{classified}</span>
            <span className="h-3 w-px bg-zinc-300" />
            <span>{draftsReady}</span>
            <span className="h-3 w-px bg-zinc-300" />
            <span>{meetingsBooked}</span>
          </div>
        </div>

        <div className="flex gap-2.5 whitespace-nowrap">
          {CHIPS.map(({ Icon, labelKey }) => (
            <span key={labelKey} className={cn(glass, "flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-[15px] font-medium")}>
              <Icon className="size-[18px] text-white/80" />
              {t(`chips.${labelKey}`)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

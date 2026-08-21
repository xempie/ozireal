import Link from "next/link";
import { RefreshCw, Lock, Plus } from "lucide-react";
import {
  PageHeader,
  Section,
  Card,
  CardTitle,
  Badge,
  Button,
  Callout,
  ProtoNote,
} from "@/components/ui";
import { calendarEvents, syncState } from "@/lib/sample-data-2";
import { contactName, listingById, listingAddress } from "@/lib/sample-data";
import { relative, timeOfDay, TODAY } from "@/lib/utils";

const kindTone = {
  inspection: "stock",
  appraisal: "brand",
  meeting: "neutral",
  settlement: "sent",
  personal: "neutral",
} as const;

const DAY_MS = 86400000;

export default function CalendarPage() {
  // Seven day columns starting today.
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(TODAY.getTime() + i * DAY_MS);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const eventsFor = (day: Date) =>
    calendarEvents
      .filter((e) => {
        const s = new Date(e.startsAt);
        s.setHours(0, 0, 0, 0);
        return s.getTime() === day.getTime();
      })
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const dayName = new Intl.DateTimeFormat("en-AU", { weekday: "short" });
  const dayNum = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" });

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Two-way sync with Google and Outlook. The external calendar stays the source of truth for anything it owns."
        actions={
          <Button variant="primary">
            <Plus size={13} />
            New event
          </Button>
        }
      />

      <div className="grid lg:grid-cols-4 gap-4 mb-6">
        {(["google", "outlook"] as const).map((p) => {
          const s = syncState[p];
          return (
            <Card key={p}>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold capitalize">{p}</span>
                <Badge tone={s.connected ? "sent" : "blocked"}>
                  {s.connected ? "connected" : "disconnected"}
                </Badge>
              </div>
              <div className="text-3 text-[11.5px] mt-1.5 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <RefreshCw size={10} />
                  synced {relative(s.lastSync)}
                </div>
                <div>
                  {s.events} events · {s.direction}
                </div>
              </div>
            </Card>
          );
        })}
        <Card className="lg:col-span-2">
          <Callout tone="brand" title="What the platform will not touch">
            We never edit or delete an event we did not create. Our own events carry an
            identifier so we recognise them and do not echo our writes back in as new
            appointments.
          </Callout>
        </Card>
      </div>

      <Section title="Next seven days">
        <div className="grid grid-cols-1 md:grid-cols-4 xl:grid-cols-7 gap-3">
          {days.map((day, idx) => {
            const evs = eventsFor(day);
            const isToday = idx === 0;
            return (
              <div key={day.toISOString()}>
                <div
                  className={
                    isToday
                      ? "flex items-baseline gap-1.5 mb-2 pb-1.5 border-b-2 border-[var(--accent)]"
                      : "flex items-baseline gap-1.5 mb-2 pb-1.5 border-b"
                  }
                >
                  <span className="text-[12.5px] font-semibold">
                    {dayName.format(day)}
                  </span>
                  <span className="text-3 text-[11.5px]">{dayNum.format(day)}</span>
                  {isToday && (
                    <span className="text-[10.5px] text-[var(--accent)] font-semibold ml-auto">
                      today
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 min-h-[60px]">
                  {evs.length === 0 && (
                    <div className="text-3 text-[11.5px] py-2">—</div>
                  )}
                  {evs.map((e) => {
                    const l = e.listingId ? listingById(e.listingId) : undefined;
                    return (
                      <div
                        key={e.id}
                        className="surface-2 border rounded-md p-2 text-[12px]"
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="tabular text-3 text-[11px]">
                            {timeOfDay(e.startsAt)}
                          </span>
                          {!e.ourWrite && (
                            <span title="External event — we never edit this">
                              <Lock size={9} className="text-3" />
                            </span>
                          )}
                        </div>
                        <div className="font-medium leading-snug">{e.title}</div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          <Badge tone={kindTone[e.kind]}>{e.kind}</Badge>
                        </div>
                        {(l || e.contactId) && (
                          <div className="mt-1.5 text-[11px]">
                            {l && (
                              <Link
                                href={`/listings/${l.id}`}
                                className="text-2 hover:underline underline-offset-2 block truncate"
                              >
                                {listingAddress(l)}
                              </Link>
                            )}
                            {e.contactId && (
                              <Link
                                href={`/contacts/${e.contactId}`}
                                className="text-2 hover:underline underline-offset-2 block truncate"
                              >
                                {contactName(e.contactId)}
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <ProtoNote>
          A padlock marks an event owned by the external calendar. Sync is incremental —
          Google sync tokens and Graph delta queries, with a reconcile job as the safety
          net, because push subscriptions expire and stop silently.
        </ProtoNote>
      </Section>
    </>
  );
}

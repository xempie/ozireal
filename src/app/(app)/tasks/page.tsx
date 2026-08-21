import Link from "next/link";
import { AlertTriangle, Check } from "lucide-react";
import {
  PageHeader,
  Section,
  Card,
  Badge,
  Empty,
  ProtoNote,
} from "@/components/ui";
import { tasks, contactName } from "@/lib/sample-data";
import { shortDate, TODAY, relative } from "@/lib/utils";

export default function TasksPage() {
  const open = tasks
    .filter((t) => !t.done)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  const done = tasks.filter((t) => t.done);

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Every task here was committed by a human from the confirm queue — none were written automatically."
      />

      <Section title="Open" hint={`${open.length} tasks`}>
        {open.length === 0 ? (
          <Empty>Nothing open.</Empty>
        ) : (
          <div className="space-y-2">
            {open.map((t) => {
              const overdue = t.dueAt.getTime() < TODAY.getTime() - 86400000;
              const today =
                Math.abs(t.dueAt.getTime() - TODAY.getTime()) <= 86400000;
              return (
                <Card key={t.id} className="p-3">
                  <div className="flex items-start gap-3">
                    <span className="h-4 w-4 rounded border mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium">{t.title}</div>
                      <div className="text-3 text-[12px] mt-0.5 flex flex-wrap items-center gap-x-2">
                        <Link
                          href={`/contacts/${t.contactId}`}
                          className="hover:underline underline-offset-2"
                        >
                          {contactName(t.contactId)}
                        </Link>
                        <span>·</span>
                        <span>from {t.source}</span>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {overdue ? (
                        <Badge tone="blocked">
                          <AlertTriangle size={10} />
                          {relative(t.dueAt)}
                        </Badge>
                      ) : today ? (
                        <Badge tone="queue">today</Badge>
                      ) : (
                        <span className="text-3 text-[12px]">
                          {shortDate(t.dueAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Section>

      <Section title="Recently completed">
        <div className="space-y-2">
          {done.map((t) => (
            <Card key={t.id} className="p-3 opacity-60">
              <div className="flex items-start gap-3">
                <span className="h-4 w-4 rounded border mt-0.5 shrink-0 grid place-items-center">
                  <Check size={11} />
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] line-through">{t.title}</div>
                  <div className="text-3 text-[12px] mt-0.5">
                    {contactName(t.contactId)}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </Section>

      <ProtoNote>
        Phase 3 adds the calendar and the voice recorder alongside this. The extraction
        path already exists in the confirm queue — a voice note becomes a proposed task,
        never a written one.
      </ProtoNote>
    </>
  );
}

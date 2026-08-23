import {
  ShieldCheck,
  X,
  Pencil,
  GitMerge,
  Globe,
  Check,
  LogIn,
  Download,
  Ban,
} from "lucide-react";
import {
  PageHeader,
  Section,
  Card,
  Badge,
  Button,
  Table,
  THead,
  TH,
  TD,
  TR,
  Callout,
  ProtoNote,
  Empty,
} from "@/components/ui";
import { getAuditLog } from "@/server/queries";
import { dateTime, relative } from "@/lib/utils";

const kindMeta = {
  approve: { icon: ShieldCheck, tone: "sent" as const, label: "Approve" },
  reject: { icon: X, tone: "blocked" as const, label: "Reject" },
  edit: { icon: Pencil, tone: "queue" as const, label: "Edit" },
  merge: { icon: GitMerge, tone: "queue" as const, label: "Merge" },
  publish: { icon: Globe, tone: "brand" as const, label: "Publish" },
  commit: { icon: Check, tone: "ai" as const, label: "Commit" },
  login: { icon: LogIn, tone: "neutral" as const, label: "Sign-in" },
  block: { icon: Ban, tone: "blocked" as const, label: "Block" },
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export default async function AuditPage() {
  const auditLog = await getAuditLog(50);

  const now = Date.now();
  const lastSevenDays = auditLog.filter((e) => now - e.at.getTime() <= WEEK_MS);

  const byActor = auditLog.reduce<Record<string, number>>((acc, e) => {
    acc[e.actor] = (acc[e.actor] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Who approved, edited, merged, committed or published — and when. Append-only, like the interaction log."
        actions={
          <Button>
            <Download size={13} />
            Export
          </Button>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 [&>*:last-child:nth-child(odd)]:sm:col-span-2">
        <Card>
          <div className="text-3 text-[11px] uppercase tracking-[0.06em] font-medium">
            Entries
          </div>
          <div className="text-[26px] font-semibold tabular mt-1">
            {lastSevenDays.length}
          </div>
          <div className="text-3 text-[11.5px]">last 7 days</div>
        </Card>
        <Card>
          <div className="text-3 text-[11px] uppercase tracking-[0.06em] font-medium">
            Actors
          </div>
          <div className="text-[26px] font-semibold tabular mt-1">
            {Object.keys(byActor).length}
          </div>
          <div className="text-3 text-[11.5px]">
            {Object.entries(byActor)
              .map(([a, n]) => `${a} (${n})`)
              .join(" · ") || "no activity recorded yet"}
          </div>
        </Card>
        <Card className="sm:col-span-2 lg:col-span-2">
          <Callout tone="brand" title="Why this exists separately">
            The interaction log records what happened with a contact. This records what a
            person did to the system — the two answer different questions when something
            is disputed months later.
          </Callout>
        </Card>
      </div>

      <Section title="Activity">
        {auditLog.length > 0 ? (
          <Table minWidth={760}>
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Actor</TH>
                <TH>Action</TH>
                <TH>Target</TH>
                <TH></TH>
              </TR>
            </THead>
            <tbody>
              {auditLog.map((e) => {
                const m = kindMeta[e.kind];
                const Icon = m.icon;
                return (
                  <TR key={e.id}>
                    <TD className="whitespace-nowrap">
                      <div className="text-[12.5px]">{relative(e.at)}</div>
                      <div className="text-3 text-[11px]">{dateTime(e.at)}</div>
                    </TD>
                    <TD>
                      <span
                        className={
                          e.actor === "System"
                            ? "text-2 italic text-[12.5px]"
                            : "text-[12.5px] font-medium"
                        }
                      >
                        {e.actor}
                      </span>
                    </TD>
                    <TD className="text-2">{e.action}</TD>
                    <TD className="text-2 max-w-[320px]">{e.target}</TD>
                    <TD className="text-right">
                      <Badge tone={m.tone}>
                        <Icon size={10} />
                        {m.label}
                      </Badge>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <Empty>No activity recorded yet.</Empty>
        )}
        <ProtoNote>
          Note the third row: the actor is <strong>System</strong>, not a person. A
          message was blocked at send time because consent had lapsed since the draft was
          written — the log records the machine refusing to send, which is exactly the
          event you would need to produce if a send were ever challenged.
        </ProtoNote>
      </Section>
    </>
  );
}

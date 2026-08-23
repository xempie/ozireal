import { Lock, Info } from "lucide-react";
import {
  PageHeader,
  Section,
  Card,
  Badge,
  KeyValue,
  Callout,
  ProtoNote,
  Empty,
} from "@/components/ui";
import { getAgency, getSettings } from "@/server/queries";
import { QueueHealthCard } from "@/components/jobs/queue-health";

/** "Sam Whitfield" -> "SW". Empty when there is no name to take them from. */
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export default async function SettingsPage() {
  const [agency, settings] = await Promise.all([getAgency(), getSettings()]);

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Agency configuration. Everything jurisdiction-specific lives here rather than in code."
      />

      <div className="grid lg:grid-cols-2 gap-6">
        <Section title="Agency">
          <Card>
            <KeyValue
              cols={1}
              items={[
                ["Legal name", agency.name],
                ["Trading as", agency.tradingName ?? "—"],
                ["Licence", agency.licence ?? "—"],
                ["ABN", agency.abn ?? "—"],
                ["Jurisdiction", agency.jurisdiction],
                ["Timezone", agency.timezone],
              ]}
            />
          </Card>
        </Section>

        <Section title="Users">
          <Card>
            <div className="flex items-center gap-3">
              <span className="h-8 w-8 rounded-full surface-3 border grid place-items-center text-[11px] font-semibold shrink-0">
                {initials(agency.user.name) || "—"}
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-medium">
                  {agency.user.name || "No user yet"}
                </div>
                <div className="text-3 text-[12px] truncate">
                  {agency.user.email || "—"}
                </div>
              </div>
              <Badge tone="brand" className="ml-auto">
                {agency.user.role}
              </Badge>
            </div>
            <div className="mt-3">
              <Callout tone="brand" title="One office, one user">
                Multi-user is deferred (D1). The users table has a real shape and every
                row carries an agency column, so adding people later is a feature rather
                than a rewrite — but there is no invite flow, no roles screen and no
                agency switcher.
              </Callout>
            </div>
          </Card>
        </Section>

        <Section title="Consent wording" hint="captured verbatim at submission">
          {settings.templates.length > 0 ? (
            <Card padded={false} className="p-0">
              {settings.templates.map((t) => (
                <div key={t.form} className="p-3 border-b last:border-b-0">
                  <div className="text-[12.5px] font-medium">{t.form}</div>
                  <p className="text-2 text-[12px] mt-1 leading-relaxed italic">
                    “{t.wording}”
                  </p>
                </div>
              ))}
            </Card>
          ) : (
            <Empty>No consent wording configured yet.</Empty>
          )}
          <ProtoNote>
            The exact text shown is stored on every consent row. Change the template and
            existing records keep the wording those people actually agreed to.
          </ProtoNote>
        </Section>

        <Section title="Disclosure rules" hint="per jurisdiction, never hardcoded">
          {settings.rules.length > 0 ? (
            <Card padded={false} className="p-0">
              {settings.rules.map((d) => (
                <div key={d.name} className="p-3 border-b last:border-b-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-medium">{d.name}</span>
                    <Badge tone="stock">{d.state}</Badge>
                  </div>
                  <p className="text-2 text-[12px] mt-0.5">{d.detail}</p>
                </div>
              ))}
            </Card>
          ) : (
            <Empty>No disclosure rules loaded yet.</Empty>
          )}
          <ProtoNote>
            Seeded with South Australia only (D2). Adding NSW later is a data load, not a
            rewrite — which only holds because nothing in the code hardcodes “SA”.
          </ProtoNote>
        </Section>

        <Section title="Background jobs" hint="the dead-letter view">
          <QueueHealthCard />
        </Section>
      </div>

      <Section title="Not configurable, by design" className="mt-2">
        <Card>
          <div className="space-y-3">
            {[
              [
                "Autonomous sending",
                "There is no setting that lets a message leave without human approval. Rule 1.",
              ],
              [
                "Skipping the send-time consent check",
                "Consent is re-checked at the instant of sending, always. Rule 2.",
              ],
              [
                "Direct AI writes to a contact record",
                "Extracted tasks and preference changes go to the confirm queue. Rule 5.",
              ],
              [
                "Publishing an SEO change set automatically",
                "The agent proposes a diff; a human applies it. Rule 4.",
              ],
            ].map(([title, detail]) => (
              <div key={title} className="flex items-start gap-2.5">
                <Lock size={13} className="text-3 mt-0.5 shrink-0" />
                <div>
                  <div className="text-[12.5px] font-medium">{title}</div>
                  <p className="text-2 text-[12px] mt-0.5">{detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t flex items-start gap-2 text-3 text-[11.5px]">
            <Info size={12} className="mt-0.5 shrink-0" />
            <span>
              These are listed here deliberately. A setting that does not exist should be
              visibly absent, not quietly missing.
            </span>
          </div>
        </Card>
      </Section>
    </>
  );
}

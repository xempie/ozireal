import Link from "next/link";
import { Mic, Sparkles, Check, Loader2, FileAudio } from "lucide-react";
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
import { getVoiceNotes } from "@/server/queries";
import { relative, dateTime } from "@/lib/utils";

function duration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default async function VoicePage() {
  const voiceNotes = await getVoiceNotes();

  const total = voiceNotes.reduce((s, v) => s + v.seconds, 0);
  const tasks = voiceNotes.reduce((s, v) => s + v.extracted.length, 0);

  return (
    <>
      <PageHeader
        title="Voice notes"
        subtitle="Record after an inspection or in the car. Transcribed, tasks extracted, and every one of them proposed rather than written."
        actions={
          <Button variant="primary">
            <Mic size={13} />
            Record
          </Button>
        }
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 [&>*:last-child:nth-child(odd)]:sm:col-span-2">
        <Card>
          <div className="text-3 text-[11px] uppercase tracking-[0.06em] font-medium">
            Recorded this week
          </div>
          <div className="text-[26px] font-semibold tabular mt-1">
            {voiceNotes.length}
          </div>
          <div className="text-3 text-[11.5px]">{duration(total)} of audio</div>
        </Card>
        <Card>
          <div className="text-3 text-[11px] uppercase tracking-[0.06em] font-medium">
            Tasks extracted
          </div>
          <div className="text-[26px] font-semibold tabular mt-1">{tasks}</div>
          <div className="text-3 text-[11.5px]">all pending your confirmation</div>
        </Card>
        <Card>
          <Callout tone="ai" title="Nothing is written automatically">
            Deepgram transcribes, a cheap model extracts, and the result lands in the
            confirm queue. You commit it.
          </Callout>
        </Card>
      </div>

      <Section title="Recent notes">
        <div className="space-y-3">
          {voiceNotes.map((v) => (
            <Card key={v.id}>
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-md surface-3 border grid place-items-center shrink-0">
                  <FileAudio size={15} className="text-3" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13px] font-medium tabular">
                      {duration(v.seconds)}
                    </span>
                    {v.contactId && (
                      <Link
                        href={`/contacts/${v.contactId}`}
                        className="text-[12.5px] text-2 hover:underline underline-offset-2"
                      >
                        {v.contactName ?? "Unnamed contact"}
                      </Link>
                    )}
                    {v.status === "processing" && (
                      <Badge tone="queue">
                        <Loader2 size={10} />
                        transcribing
                      </Badge>
                    )}
                    {v.status === "transcribed" && (
                      <Badge tone="ai">awaiting confirmation</Badge>
                    )}
                    {v.status === "confirmed" && (
                      <Badge tone="sent">
                        <Check size={10} />
                        committed
                      </Badge>
                    )}
                    <span className="text-3 text-[11.5px] ml-auto shrink-0">
                      {dateTime(v.recordedAt)}
                    </span>
                  </div>

                  {/* Waveform stand-in: deterministic bars, no randomness so SSR matches. */}
                  <div className="flex items-end gap-[2px] h-8 mt-2.5 mb-2">
                    {Array.from({ length: 56 }, (_, i) => {
                      const h = 10 + ((i * 37 + v.seconds * 13) % 90);
                      return (
                        <span
                          key={i}
                          className="flex-1 rounded-[1px] bg-[var(--accent)]/35"
                          style={{ height: `${h}%` }}
                        />
                      );
                    })}
                  </div>

                  {v.status === "processing" ? (
                    <p className="text-3 text-[12.5px] italic">
                      Transcription in progress — {relative(v.recordedAt)}.
                    </p>
                  ) : v.transcript ? (
                    <p className="text-2 text-[12.5px] leading-relaxed">
                      “{v.transcript}”
                    </p>
                  ) : (
                    <p className="text-3 text-[12.5px] italic">No transcript yet.</p>
                  )}

                  {v.extracted.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Sparkles size={12} className="text-[#4a3aa7] dark:text-[#a79bf0]" />
                        <span className="text-3 text-[10.5px] uppercase tracking-[0.05em] font-medium">
                          Extracted
                        </span>
                      </div>
                      <ul className="space-y-1.5">
                        {v.extracted.map((t) => (
                          <li
                            key={t}
                            className="text-[12.5px] flex items-start gap-2"
                          >
                            <span className="h-3.5 w-3.5 rounded border mt-[2px] shrink-0 grid place-items-center">
                              {v.status === "confirmed" && <Check size={9} />}
                            </span>
                            <span className={v.status === "confirmed" ? "text-2" : ""}>
                              {t}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {v.status === "transcribed" && (
                        <div className="flex flex-wrap gap-2 mt-2.5">
                          <Button variant="primary" size="sm">
                            Commit both
                          </Button>
                          <Button size="sm">Open in confirm queue</Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
        <ProtoNote>
          Phase 3 adds the actual recorder as a PWA surface, so this works on a phone
          with patchy signal — the upload queues and reconciles when the connection comes
          back.
        </ProtoNote>
      </Section>
    </>
  );
}

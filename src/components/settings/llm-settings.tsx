"use client";

import * as React from "react";
import { Lock, Wallet, AlertTriangle } from "lucide-react";
import {
  useAction,
  Input,
  Select,
  SubmitButton,
  FormError,
  FormSuccess,
} from "@/components/forms/action-form";
import { saveLlmSettings } from "@/server/actions/llm";
import { Badge, ProtoNote } from "@/components/ui";

/**
 * The AI configuration screen.
 *
 * Everything here used to be an environment variable, a literal at a call site,
 * or a constant in a source file — decisions the agency pays for but could not
 * see. The one thing deliberately NOT editable is the temperature for structured
 * output: it is shown, locked, and explained, because "0" is not a default
 * someone should be able to talk themselves out of.
 */

export type LlmSettingsValues = {
  fastModel: string;
  writingModel: string;
  proseTemperature: number;
  extractionMaxTokens: number;
  briefMaxTokens: number;
  rankingMaxTokens: number;
  monthlyBudgetAud: string | null;
  budgetAction: string;
  fastInputUsdPerMtok: string;
  fastOutputUsdPerMtok: string;
  writingInputUsdPerMtok: string;
  writingOutputUsdPerMtok: string;
  audPerUsd: string;
};

export type BudgetSummary = {
  spentAud: number;
  budgetAud: number | null;
  fraction: number | null;
  overBudget: boolean;
  action: "block" | "warn";
};

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

export function LlmSettingsForm({
  values,
  budget,
}: {
  values: LlmSettingsValues;
  budget: BudgetSummary;
}) {
  const a = useAction(saveLlmSettings);

  return (
    <div className="space-y-4">
      {/* Spend first: it is the number an owner opens this page to see. */}
      <div className="surface-2 border rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <Wallet size={14} className="text-3" />
          <span className="text-[12.5px] font-medium">This month&apos;s AI spend</span>
          {budget.overBudget && (
            <Badge tone={budget.action === "block" ? "blocked" : "queue"}>
              {budget.action === "block" ? "paused" : "over budget"}
            </Badge>
          )}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-[22px] font-semibold tabular">{money(budget.spentAud)}</span>
          <span className="text-3 text-[12px]">
            {budget.budgetAud !== null ? `of ${money(budget.budgetAud)}` : "no cap set"}
          </span>
        </div>
        {budget.fraction !== null && (
          <div className="mt-2 h-1.5 rounded-full surface-3 overflow-hidden">
            <div
              className={
                budget.fraction >= 1
                  ? "h-full bg-[#d03b3b]"
                  : budget.fraction >= 0.8
                    ? "h-full bg-[#eda100]"
                    : "h-full bg-[var(--accent)]"
              }
              style={{ width: `${Math.min(100, budget.fraction * 100)}%` }}
            />
          </div>
        )}
        {budget.overBudget && budget.action === "block" && (
          <div className="mt-2 flex items-start gap-2 text-[12px] rounded-md border border-[#d03b3b]/45 bg-[#d03b3b]/8 p-2.5">
            <AlertTriangle size={13} className="shrink-0 mt-px" />
            <span>
              New AI work is paused. Enquiries still arrive and nothing is lost — briefs
              and match reasons simply stop refreshing until the cap is raised or the
              month rolls over.
            </span>
          </div>
        )}
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          a.run(Object.fromEntries(f.entries()));
        }}
      >
        <div>
          <div className="text-3 text-[11px] uppercase tracking-[0.05em] font-medium mb-2">
            Models
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              label="Fast model — extraction and classification"
              name="fastModel"
              defaultValue={values.fastModel}
              errors={a.fieldErrors.fastModel}
            />
            <Input
              label="Writing model — briefs, drafts, match reasons"
              name="writingModel"
              defaultValue={values.writingModel}
              errors={a.fieldErrors.writingModel}
            />
          </div>
          <p className="text-3 text-[11px] mt-1.5">
            Free text, so a model released today is usable today without a deploy. A
            wrong id fails on the next job rather than silently doing nothing.
          </p>
        </div>

        <div>
          <div className="text-3 text-[11px] uppercase tracking-[0.05em] font-medium mb-2">
            Temperature
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <span className="block text-[12px] font-medium text-2 mb-1.5">
                Structured output
              </span>
              <div className="flex items-center gap-2 surface-3 border rounded-md px-2.5 py-2">
                <Lock size={13} className="text-3 shrink-0" />
                <span className="text-[13.5px] tabular">0</span>
                <span className="text-3 text-[11.5px] ml-auto">fixed</span>
              </div>
              <p className="text-3 text-[11px] mt-1">
                Extraction, briefs and ranking are parsed against a schema. A creative
                temperature there produces a failed job, not a better answer, so the
                database refuses any other value.
              </p>
            </div>
            <Input
              label="Prose — anything a person reads"
              name="proseTemperature"
              type="number"
              step="0.05"
              min="0"
              max="1"
              defaultValue={values.proseTemperature}
              errors={a.fieldErrors.proseTemperature}
            />
          </div>
        </div>

        <div>
          <div className="text-3 text-[11px] uppercase tracking-[0.05em] font-medium mb-2">
            Response ceilings (tokens)
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <Input
              label="Extraction"
              name="extractionMaxTokens"
              type="number"
              defaultValue={values.extractionMaxTokens}
              errors={a.fieldErrors.extractionMaxTokens}
            />
            <Input
              label="Rolling brief"
              name="briefMaxTokens"
              type="number"
              defaultValue={values.briefMaxTokens}
              errors={a.fieldErrors.briefMaxTokens}
            />
            <Input
              label="Match ranking"
              name="rankingMaxTokens"
              type="number"
              defaultValue={values.rankingMaxTokens}
              errors={a.fieldErrors.rankingMaxTokens}
            />
          </div>
          <p className="text-3 text-[11px] mt-1.5">
            A ceiling that is too low truncates the JSON and fails the job outright — it
            is never retried, because the same input truncates every time.
          </p>
        </div>

        <div>
          <div className="text-3 text-[11px] uppercase tracking-[0.05em] font-medium mb-2">
            Monthly budget
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              label="Cap (AUD, blank for none)"
              name="monthlyBudgetAud"
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 50.00"
              defaultValue={values.monthlyBudgetAud ?? ""}
              errors={a.fieldErrors.monthlyBudgetAud}
            />
            <Select
              label="At the cap"
              name="budgetAction"
              defaultValue={values.budgetAction}
              options={[
                { value: "block", label: "Pause AI work" },
                { value: "warn", label: "Warn but keep going" },
              ]}
            />
          </div>
          <p className="text-3 text-[11px] mt-1.5">
            Checked before every call, not after — a budget discovered at the end of the
            month is not a budget.
          </p>
        </div>

        <details className="group">
          <summary className="text-3 text-[11px] uppercase tracking-[0.05em] font-medium cursor-pointer">
            Pricing and exchange rate
          </summary>
          <div className="mt-2 grid sm:grid-cols-2 gap-3">
            <Input label="Fast — input USD/MTok" name="fastInputUsdPerMtok" type="number" step="0.0001" defaultValue={values.fastInputUsdPerMtok} />
            <Input label="Fast — output USD/MTok" name="fastOutputUsdPerMtok" type="number" step="0.0001" defaultValue={values.fastOutputUsdPerMtok} />
            <Input label="Writing — input USD/MTok" name="writingInputUsdPerMtok" type="number" step="0.0001" defaultValue={values.writingInputUsdPerMtok} />
            <Input label="Writing — output USD/MTok" name="writingOutputUsdPerMtok" type="number" step="0.0001" defaultValue={values.writingOutputUsdPerMtok} />
            <Input label="AUD per USD" name="audPerUsd" type="number" step="0.0001" defaultValue={values.audPerUsd} />
          </div>
          <p className="text-3 text-[11px] mt-1.5">
            Cost is computed at the moment of the call and frozen onto the ledger row, so
            correcting a price here never rewrites what past calls recorded.
          </p>
        </details>

        <FormError message={a.error} />
        {a.succeeded && <FormSuccess message="Saved. New AI calls use these settings." />}

        <SubmitButton pending={a.pending}>Save AI settings</SubmitButton>
      </form>

      <ProtoNote>
        Model ids, temperatures, ceilings and the cap were previously spread across
        environment variables and literals in four files. They are decisions the agency
        pays for, so they belong here.
      </ProtoNote>
    </div>
  );
}

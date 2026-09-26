# The assistant

The chat button at the bottom right of every console page. It answers questions from the
CRM's own data and makes changes, but **only after the agent presses Do it** on a card
describing the change.

## How a turn works

1. `assistantTurn` (src/server/actions/assistant.ts) sends the conversation to Claude
   (Sonnet tier, `prompts/assistant.v1.md`) with the tools in
   `src/server/assistant/tools.ts`. Every call is ledgered in `ai_generations`.
2. **Read tools** (look-ups and reports) are answered on the server and fed back, up to six
   rounds per turn.
3. **Write tools** are never executed by the model. The turn stops and returns them as
   cards (`describeWrite`, with names instead of ids).
4. **Do it** calls `assistantApply`, which runs the change through the *same Server Action
   the screen's own button uses* (`applyWrite` in `src/server/assistant/writes.ts`). Every
   validation, refusal and audit row applies. **Cancel** runs nothing.
5. The outcomes go back to the model, which says what happened.
6. **What next?** chips appear under the newest reply. Two sources, merged: fixed follow-ups
   for the change just confirmed (`nextSteps` in writes.ts, e.g. after a new contact: find
   matching properties, add a follow-up task, draft an SMS), and the model's own
   suggestions, which `assistant.v2` asks for on a final `Next: a | b | c` line that the
   widget lifts out of the text. Tapping a chip sends it as the next message.

## What it can and cannot do

| Can (after Do it) | Cannot |
|---|---|
| Add or update contacts (including the **agent** role), log interactions, record follow-ups | Send any message (drafts go to **Approvals**, rule 1) |
| Create and complete tasks | Publish or withdraw a listing |
| Add or update properties; draft and edit listings | Delete, merge, or change consent |
| Run matching for a listing or a contact | Invent listing price wording (it must be the agent's words) |
| Draft an SMS or email to one contact, if they consented on that channel | |
| Record consent the agent says a person gave (how, and what they agreed to) | Infer consent from a role or a published number |

`tests/assistant-tools.test.ts` pins these properties.

## Adding a tool

Add it to `TOOLS` with a Zod schema. A `read` needs a case in `runReadTool`; a `write` needs a
card in `describeWrite` and a case in `applyWrite` that calls an existing Server Action. A
write must never get its own database path, because the Server Action is where the rules live.

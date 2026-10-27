import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

export const AI_MODEL = 'openai/gpt-5.6-sol';

const RUN_ID = 'X-Lovable-AIG-Run-ID';

export type AiTask = 'note_to_trip' | 'summarize' | 'training' | 'draft_message' | 'ask';

const BASE = `You assist the Master Admin of MY FLORIDA NEMT, a Florida non-emergency medical transportation network.
Rules: never invent facts, phone numbers, prices, names or dates; say when information is missing.
You only produce text for the admin to review. You cannot submit requests, assign drivers, charge payments, send messages or change records — never claim you did.
Keep answers short, plain and scannable. Use plain text with simple dashes for lists; no markdown symbols like ** or #.`;

const TASKS: Record<AiTask, string> = {
  note_to_trip: 'Turn the note into a draft trip checklist: trip type, date/time, pickup, drop-off, service level (ambulatory/wheelchair/stretcher), rider needs, return trip, payer. Mark anything not stated as "Missing". End with questions to confirm.',
  summarize: 'Summarize the pasted request or trip details in 3–6 bullets for a dispatcher, then list missing or conflicting details.',
  training: 'Explain the NEMT training topic clearly for a new driver or dispatcher, with a short example. Do not provide exam answer keys.',
  draft_message: 'Draft a polite, professional message based on the instructions. Do not include personal medical details. Leave [placeholders] for unknown facts.',
  ask: 'Answer the admin\'s question helpfully.',
};

export async function runAssistant(task: AiTask, input: string) {
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) throw new Error('AI is not configured.');
  let runId: string | undefined;
  const openai = createOpenAI({
    baseURL: 'https://ai.gateway.lovable.dev/v1',
    apiKey: key,
    headers: { 'Lovable-API-Key': key, 'X-Lovable-AIG-SDK': 'vercel-ai-sdk' },
    fetch: async (url, init) => {
      const h = new Headers(init?.headers);
      if (runId) h.set(RUN_ID, runId);
      const res = await fetch(url, { ...init, headers: h });
      runId ??= res.headers.get(RUN_ID) ?? undefined;
      return res;
    },
  });
  let failure: unknown;
  const result = streamText({
    model: openai.responses(AI_MODEL),
    system: `${BASE}\n\nTask: ${TASKS[task]}`,
    prompt: input,
    providerOptions: {
      openai: { forceReasoning: true, reasoningEffort: 'low', reasoningSummary: 'auto', store: false, include: ['reasoning.encrypted_content'] },
    },
    onError: ({ error }) => { failure = error; },
  });
  const text = await result.text;
  if (failure || !text.trim()) {
    const status = (failure as { statusCode?: number })?.statusCode;
    console.error('AI assistant failed', status, failure);
    if (status === 429) throw new Error('AI is busy right now. Please try again in a minute.');
    if (status === 402) throw new Error('AI credits have run out. Add credits in Settings → Plans & credits.');
    if (status === 403) throw new Error('AI access is blocked for this workspace.');
    throw new Error('The AI could not answer. Please try again.');
  }
  return text;
}

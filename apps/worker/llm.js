const DIGEST_MODEL = process.env.DIGEST_MODEL || "gpt-6-luna";

let structured;

function digestModelName() {
  return process.env.DIGEST_MODEL || DIGEST_MODEL;
}

async function completeDigest(prompt) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY no está configurada");
  }
  if (!structured) {
    const { ChatOpenAI } = await import("@langchain/openai");
    const { z } = await import("zod");
    const model = new ChatOpenAI({
      model: digestModelName(),
      useResponsesApi: true,
      reasoning: { effort: "low" },
    });
    structured = model.withStructuredOutput(
      z.object({
        overview: z.string(),
        items: z.array(
          z.object({
            wa_id: z.string(),
            action: z.string(),
            needs_more_context: z.boolean(),
          }),
        ),
      }),
      { name: "daily_digest" },
    );
  }
  return structured.invoke(prompt);
}

module.exports = { completeDigest, digestModelName };

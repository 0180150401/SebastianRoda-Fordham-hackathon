import { NextResponse } from "next/server";

type ChatRole = "user" | "assistant";

type IncomingMessage = {
  role: ChatRole;
  content: string;
};

type SemanticUniversePayload = {
  nodes: unknown[];
  links: unknown[];
  evidence: unknown[];
  semanticDiscourse: unknown[];
  visualCorrelations: unknown[];
  modelStrength?: unknown;
};

function cleanEnvValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value.replace(/^['"]|['"]$/g, "").trim();
}

function normalizeMessages(value: unknown): IncomingMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Partial<IncomingMessage>;
      if ((row.role !== "user" && row.role !== "assistant") || typeof row.content !== "string") {
        return null;
      }
      const content = row.content.trim();
      if (!content) return null;
      return { role: row.role, content: content.slice(0, 3000) };
    })
    .filter((entry): entry is IncomingMessage => Boolean(entry))
    .slice(-14);
}

function normalizeUniverse(value: unknown): SemanticUniversePayload {
  if (!value || typeof value !== "object") {
    return {
      nodes: [],
      links: [],
      evidence: [],
      semanticDiscourse: [],
      visualCorrelations: [],
    };
  }
  const payload = value as Partial<SemanticUniversePayload>;
  return {
    nodes: Array.isArray(payload.nodes) ? payload.nodes : [],
    links: Array.isArray(payload.links) ? payload.links : [],
    evidence: Array.isArray(payload.evidence) ? payload.evidence : [],
    semanticDiscourse: Array.isArray(payload.semanticDiscourse) ? payload.semanticDiscourse : [],
    visualCorrelations: Array.isArray(payload.visualCorrelations) ? payload.visualCorrelations : [],
    modelStrength: payload.modelStrength,
  };
}

export async function POST(request: Request) {
  try {
    const openAiKey = cleanEnvValue(process.env.OPENAI_API_KEY ?? process.env.OPENAI_API);
    if (!openAiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY." }, { status: 500 });
    }

    const body = (await request.json().catch(() => ({}))) as {
      brand?: string;
      universe?: unknown;
      messages?: unknown;
    };
    const brand = body.brand?.trim();
    if (!brand) {
      return NextResponse.json({ error: "Brand is required." }, { status: 400 });
    }

    const universe = normalizeUniverse(body.universe);
    const conversation = normalizeMessages(body.messages);
    const latestUserMessage = [...conversation].reverse().find((entry) => entry.role === "user");
    if (!latestUserMessage) {
      return NextResponse.json({ error: "A user question is required." }, { status: 400 });
    }

    const systemPrompt = [
      "You are an AI advisor who speaks like an experienced marketing director.",
      "Your tone is natural, confident, commercially sharp, and practical.",
      "Use the provided semantic-universe data to explain how the company should operate better.",
      "Prioritize actions for messaging, content, product storytelling, merchandising, channel mix, and competitor response.",
      "Always ground claims in evidence, model strength, graph gaps, discourse, and visual correlations from the input.",
      "Do not invent facts, sources, or numeric claims that are not present in data.",
      "If data is weak, say exactly what is missing and how to collect it inside this app.",
      "Avoid robotic wording, generic filler, and vague motivational language.",
    ].join(" ");

    const responseStylePrompt = [
      "Writing rules:",
      "1) Write like a human advisor in a live chat, not like a report template.",
      "2) Prefer natural paragraphs with clear spacing between ideas.",
      "3) Do not use markdown headings, numbered frameworks, or rigid section labels unless the user asks for them.",
      "4) Keep a clear flow: insight, implication, recommended actions, and what to watch next.",
      "5) Use short, readable paragraphs (2-4 sentences each).",
      "6) Use bullets only when listing concrete actions or KPIs.",
      "7) When the ask is strategic, include a practical 30/60-day plan in plain language.",
      "8) Mention competitors, intents, and models only when supported by provided data.",
      "9) End with one crisp next-step recommendation sentence.",
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${openAiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.35,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "system", content: responseStylePrompt },
          {
            role: "system",
            content: `Brand under analysis: ${brand}`,
          },
          {
            role: "system",
            content: `Semantic universe data (JSON): ${JSON.stringify(universe)}`,
          },
          ...conversation.map((entry) => ({ role: entry.role, content: entry.content })),
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `OpenAI request failed: ${response.status} ${errText}` },
        { status: 500 },
      );
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = json.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return NextResponse.json({ error: "No response generated." }, { status: 500 });
    }

    return NextResponse.json({ reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

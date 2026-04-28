import { connectDB } from "@/lib/db";
import Chunk from "@/models/Chunk";
import { embeddingModel, chatModel } from "@/lib/gemini";
import { rateLimiter } from "@/lib/rateLimiter";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "anonymous";
  try {
    await rateLimiter.consume(ip);
  } catch (rejRes: any) {
    return Response.json(
      {
        error: "Too many requests. Please wait a bit.",
        retryAfter: Math.ceil(rejRes.msBeforeNext / 1000),
      },
      { status: 429 },
    );
  }

  await connectDB();

  const { question, fileId } = await req.json();

  console.log("question for", fileId, "is", question);
  if (!fileId) {
    return Response.json({ error: "Missing file" }, { status: 400 });
  }
  // 1. Get embedding
  const emb = await embeddingModel.embedContent({
    content: {
      role: "user",
      parts: [{ text: question }],
    },
  });
  const queryEmb = emb.embedding.values;
  console.log("query embedding length:", queryEmb.length);

  // 2. Vector search (DB handles similarity)
  const results = await Chunk.aggregate([
    {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector: queryEmb,
        numCandidates: 100,
        limit: 3,
        filter: {
          fileId: fileId,
        },
      },
    },
  ]);

  // 3. Build context
  const context = results.map((r) => r.text).join("\n");
  console.log("results length:", results.length);
  console.log("results:", context);

  //   return Response.json({
  //     length: results.length,
  //     context: context,
  //   });

  // 4. Ask AI
  const res = await chatModel.generateContent(`
You are a friendly and helpful PDF assistant.

Rules:
- Answer ONLY using the provided PDF context.
- If the answer is not in the context, say: "I couldn't find that in the uploaded PDF."
- Do NOT make up answers.
- Keep responses clear and concise.

Conversation behavior:
- Only greet if the user's message is clearly a greeting (like "hi", "hello", "hey").
- Do NOT greet in every response.
- If greeted, respond once and guide the user to ask about the PDF.
- For non-PDF questions, politely say you only answer based on the uploaded PDF.

Context:
${context}

User Question:
${question}
`);

  return Response.json({
    answer: res.response.text(),
  });
}

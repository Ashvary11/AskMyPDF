import { connectDB } from "@/lib/db";
import Chunk from "@/models/Chunk";
import pdf from "pdf-parse";
import { embeddingModel } from "@/lib/gemini";
import crypto from "crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  await connectDB();

  const form = await req.formData();
  const file = form.get("file") as File;

  if (!file) {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }

  if (file.type !== "application/pdf") {
    return Response.json({ error: "Only PDF allowed" }, { status: 400 });
  }

  if (file.size > 5 * 1024 * 1024) {
    return Response.json({ error: "Max 5MB allowed" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await pdf(buffer);

    if (!data.text?.trim()) {
      return Response.json({ error: "No text found in PDF" }, { status: 400 });
    }
  
    const fileId = crypto.randomBytes(4).toString("hex"); // 8 chars
    const expiryTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    const chunks: string[] = data.text.match(/(.|[\r\n]){1,500}/g) || [];

    //   parallel processing (faster)
    await Promise.all(
      chunks.map(async (chunk: string) => {
        if (!chunk.trim()) return;

        const emb = await embeddingModel.embedContent(chunk);

        return Chunk.create({
          fileId,
          fileName: file.name,
          text: chunk,
          embedding: emb.embedding.values,
          expiresAt: expiryTime,
        });
      }),
    );

    return Response.json({
      message: "Uploaded & processed",
      fileId,
      fileName: file.name,
      expiresAt: expiryTime,
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}

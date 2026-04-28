import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

export const embeddingModel = genAI.getGenerativeModel({
  model: "gemini-embedding-2-preview",
});

export const chatModel = genAI.getGenerativeModel({
  model: "gemini-3.1-flash-lite-preview",
});
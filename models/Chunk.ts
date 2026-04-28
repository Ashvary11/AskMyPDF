import mongoose, { Schema, Document } from "mongoose";

export interface IChunk extends Document {
  fileId: string;
  text: string;
  embedding: number[];
  fileName: string;
  createdAt: Date;
  expiresAt: Date;
}

const chunkSchema: Schema = new Schema({
  fileId: {
    type: String,
    required: true,
    index: true,
  },
  text: {
    type: String,
    required: true,
  },

  embedding: {
    type: [Number],
    required: true,
  },

  fileName: {
    type: String,
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 60 * 60 * 1000), // +1 hour
    index: { expires: 0 }, // TTL index
  },
});

export default mongoose.models.Chunk ||
  mongoose.model<IChunk>("Chunk", chunkSchema);

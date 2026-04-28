"use client";

import { useState, useEffect, useRef } from "react";

type Message = {
  role: "user" | "ai";
  text: string;
};

type UploadedPdf = {
  fileId: string;
  fileName: string;
  expiresAt: string;
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdf | null>(null);
  const lastMessageRef = useRef<HTMLDivElement | null>(null);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("uploadedPdf");
    if (saved) {
      setUploadedPdf(JSON.parse(saved));
    }
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > 5 * 1024 * 1024) {
      alert("File must be less than 5MB");
      return;
    }

    setFile(selected);
  };

  // Upload PDF
  const upload = async () => {
    if (!file) return alert("Select a PDF first");

    const fd = new FormData();
    fd.append("file", file);

    try {
      setUploading(true);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });

      if (!res.ok) throw new Error();

      const data = await res.json();

      const pdfData = {
        fileId: data.fileId,
        fileName: data.fileName,
        expiresAt: data.expiresAt,
      };

      localStorage.setItem("uploadedPdf", JSON.stringify(pdfData));
      setUploadedPdf(pdfData);
      setFile(null);

      alert("PDF uploaded successfully (auto delete in 1 hour)");
    } catch {
      alert("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const ask = async () => {
    if (!question.trim()) return;
    if (asking) return; //    prevents double trigger
    const userQuestion = question;

    setMessages((prev) => [...prev, { role: "user", text: userQuestion }]);
    setQuestion("");

    try {
      setAsking(true);

      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userQuestion,
          fileId: uploadedPdf?.fileId,
        }),
      });
      console.log("uploadedPdf", uploadedPdf);

      if (!res.ok) {
        if (res.status === 429) {
          const data = await res.json();
          setMessages((prev) => [
            ...prev,
            {
              role: "ai",
              text: `Rate limit hit. Try again in ${data.retryAfter}s`,
            },
          ]);
          return;
        }

        if (res.status === 503) {
          setMessages((prev) => [
            ...prev,
            {
              role: "ai",
              text: "This model is currently experiencing high demand. Please try again later.",
            },
          ]);
          return;
        }

        throw new Error("Request failed");
      }

      const data = await res.json(); 
      
      setMessages((prev) => [...prev, { role: "ai", text: data.answer }]);
      
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Error getting answer" },
      ]);
    } finally {
      setAsking(false);
    }
  };

  useEffect(() => {
    lastMessageRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
    if (!asking) {
      inputRef.current?.focus();
    }
  }, [messages]);
  return (
    <div className="min-h-screen bg-linear-to-br from-gray-100 to-gray-200 flex items-center justify-center p-4">
      <div className="w-full max-w-lg backdrop-blur-xl bg-white/70 border border-gray-200 rounded-3xl shadow-xl p-6 flex flex-col gap-4">
        {/* Title */}
        <h1 className="text-2xl font-semibold text-center tracking-tight text-black">
          AskMyPDF
        </h1>

        {/* Uploaded PDF */}
        {uploadedPdf && (
          <div className="bg-white border rounded-xl p-3 text-sm shadow-sm">
            <p className="font-medium text-gray-700">Uploaded PDF</p>
            <p className="truncate text-gray-900">{uploadedPdf.fileName}</p>

            {uploadedPdf.expiresAt && (
              <p className="text-xs text-gray-500 mt-1">
                Expires:{" "}
                {new Date(uploadedPdf.expiresAt).toLocaleString("en-IN", {
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                  day: "2-digit",
                  month: "short",
                })}
              </p>
            )}
          </div>
        )}

        {/* File Upload */}
        <label className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer hover:bg-gray-50 transition">
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFile}
            className="hidden"
          />
          <p className="text-sm text-gray-600">Click to upload PDF</p>
        </label>

        {/* Selected file */}
        {file && (
          <div className="bg-gray-50 border rounded-xl p-3 text-sm text-black">
            <p className="font-medium">{file.name}</p>
            <p className="text-xs text-gray-500">
              {(file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={upload}
          disabled={uploading}
          className={`w-full bg-black text-white py-2.5 rounded-xl text-sm font-medium hover:opacity-90 active:scale-[0.98] transition disabled:opacity-50 ${uploading ? "cursor-progress" : "cursor-pointer"}`}
        >
          {uploading ? "Uploading..." : "Upload PDF"}
        </button>

        {/* Chat Section */}
        <div className="flex flex-col h-[350px] border rounded-xl bg-gray-50 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-xs text-gray-400 text-center mt-10">
                Ask questions about your PDF
              </p>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                ref={i === messages.length - 1 ? lastMessageRef : null}
                className={`max-w-[80%] text-sm px-3 py-2 rounded-2xl ${
                  msg.role === "user"
                    ? "ml-auto bg-black text-white"
                    : "bg-white border text-gray-800"
                }`}
              >
                {msg.text}
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="border-t p-2 flex gap-2 bg-white">
            <input
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !asking && question.trim()) {
                  e.preventDefault();
                  ask();
                }
              }}
              disabled={asking}
              placeholder={
                asking ? "Waiting for response..." : "Ask something..."
              }
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/20 text-gray-900"
            />

            <button
              onClick={ask}
              disabled={asking}
              className="bg-green-600 text-white px-4 rounded-lg text-sm font-medium hover:bg-green-700 active:scale-95 transition disabled:opacity-50"
            >
              {asking ? "..." : "Ask"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

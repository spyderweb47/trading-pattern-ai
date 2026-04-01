"use client";

import { useState, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { parseOHLC } from "@/lib/csv/parseOHLC";
import { resampleOHLC } from "@/lib/csv/resampleOHLC";

export function FileUpload() {
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addDataset = useStore((s) => s.addDataset);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".csv")) {
        setError("Please upload a CSV file");
        return;
      }

      setProcessing(true);
      setError(null);

      try {
        const text = await file.text();
        const { data: rawData, metadata } = parseOHLC(text);
        const chartData = resampleOHLC(rawData);

        const dataset = {
          id: crypto.randomUUID(),
          name: file.name,
          metadata: {
            rows: metadata.rows,
            startDate: metadata.startDate,
            endDate: metadata.endDate,
          },
        };

        addDataset(dataset, chartData, rawData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Processing failed");
      } finally {
        setProcessing(false);
      }
    },
    [addDataset]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`rounded border-2 border-dashed p-4 text-center text-xs transition-colors ${
        dragging
          ? "border-slate-400 bg-slate-50"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      {processing ? (
        <p className="text-slate-400">Processing...</p>
      ) : (
        <>
          <p className="text-slate-400 mb-1">Drop CSV here or</p>
          <label className="cursor-pointer text-slate-600 font-medium hover:text-slate-900 underline underline-offset-2">
            browse
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleChange}
            />
          </label>
        </>
      )}
      {error && <p className="mt-1 text-red-500">{error}</p>}
    </div>
  );
}

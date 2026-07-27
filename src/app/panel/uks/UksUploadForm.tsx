"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadUks } from "./actions";

/** Formularz wgrania podpisanego UKS (skan/PDF). */
export function UksUploadForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          setError(null); setDone(false);
          const res = await uploadUks(fd);
          if (!res.ok) { setError(res.error); return; }
          setDone(true); setFileName(null);
          if (fileRef.current) fileRef.current.value = "";
          router.refresh();
        })
      }
      className="space-y-3"
    >
      <label className="block border border-dashed border-border hover:border-lime rounded-[14px] px-4 py-6 text-center cursor-pointer transition-colors">
        <input
          ref={fileRef}
          type="file"
          name="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.heic"
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
        <div className="text-[13px] font-medium">{fileName ?? "Kliknij, żeby wybrać plik"}</div>
        <div className="mt-1 text-[11px] text-text-mute">PDF, PNG lub JPG · max 10 MB</div>
      </label>
      <button
        type="submit"
        disabled={!fileName || pending}
        className="btn-primary h-10 px-4 text-[13px] w-full disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {pending ? "Wgrywam…" : "Wgraj UKS"}
      </button>
      {error && <div className="text-[12px] text-coral">{error}</div>}
      {done && <div className="text-[12px] text-mint">UKS wgrany — jest na liście poniżej.</div>}
    </form>
  );
}

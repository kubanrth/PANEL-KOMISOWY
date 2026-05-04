"use client";

import { useRef, useState } from "react";
import type { Photo } from "@/lib/types";
import {
  uploadProductPhoto,
  deleteProductPhoto,
  ACCEPTED_IMAGE_MIME,
  MAX_PHOTOS_PER_PRODUCT,
} from "@/lib/upload";

type Props = {
  photos: Photo[];
  onChange: (photos: Photo[]) => void;
  folderHint: string; // e.g. "draft-{timestamp}"
  max?: number;
};

export function PhotoDropzone({ photos, onChange, folderHint, max = MAX_PHOTOS_PER_PRODUCT }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const remaining = Math.max(0, max - photos.length);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList).slice(0, remaining);
    if (files.length === 0) {
      setErrors([`Maksymalnie ${max} zdjęć na produkt.`]);
      return;
    }
    setErrors([]);
    setUploading(true);

    const newPhotos: Photo[] = [];
    const newErrors: string[] = [];
    for (const file of files) {
      const res = await uploadProductPhoto(file, folderHint);
      if (res.ok) {
        newPhotos.push(res.photo);
      } else {
        newErrors.push(res.error);
      }
    }

    if (newPhotos.length > 0) onChange([...photos, ...newPhotos]);
    if (newErrors.length > 0) setErrors(newErrors);

    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function removePhoto(idx: number) {
    const photo = photos[idx];
    onChange(photos.filter((_, i) => i !== idx));
    void deleteProductPhoto(photo.url); // fire-and-forget
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_MIME.join(",") + ",image/*"}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
        {photos.map((p, i) => (
          <div
            key={p.url}
            className="aspect-square rounded-[12px] overflow-hidden relative group border border-border"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.name} className="absolute inset-0 w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removePhoto(i)}
              className="absolute top-1 right-1 h-7 w-7 rounded-full bg-bg/80 backdrop-blur-sm border border-border flex items-center justify-center text-text-soft hover:text-coral hover:border-coral transition-colors opacity-0 group-hover:opacity-100"
              title="Usuń zdjęcie"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        {photos.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer?.files ?? null);
            }}
            disabled={uploading}
            className={`aspect-square rounded-[12px] border-2 border-dashed flex flex-col items-center justify-center gap-2 text-text-soft transition-all ${
              dragOver
                ? "border-blue bg-blue/5 text-blue"
                : "border-border hover:border-blue hover:text-blue"
            } ${uploading ? "opacity-60" : ""}`}
          >
            {uploading ? (
              <>
                <Spinner />
                <span className="text-[11px] font-medium">Wysyłanie…</span>
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                <span className="text-[11px] font-medium leading-tight text-center px-1">
                  Dodaj zdjęcia
                </span>
                <span className="text-[10px] text-text-mute">
                  {photos.length}/{max}
                </span>
              </>
            )}
          </button>
        )}
      </div>

      {errors.length > 0 && (
        <ul className="mt-3 space-y-1">
          {errors.map((e, i) => (
            <li key={i} className="text-[12px] text-coral">{e}</li>
          ))}
        </ul>
      )}

      <div className="mt-3 text-[11px] text-text-mute">
        Akceptujemy JPG, PNG, WEBP, HEIC do 5 MB. Maksymalnie {max} zdjęć na produkt. Pierwsze zdjęcie używamy jako miniaturę.
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" className="animate-spin" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

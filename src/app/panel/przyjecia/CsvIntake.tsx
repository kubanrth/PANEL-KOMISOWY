"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseOfferCsv, templateCsv } from "@/lib/offer-csv";
import { plural } from "@/lib/format";

/* Główna funkcja Przyjęć: komisant wgrywa CSV z nowymi pozycjami.
   Parsujemy tutaj, pozycje jadą przez sessionStorage do /start
   (formularz Nowej oferty przejmuje flow: zdjęcia → potwierdzenie). */

export function CsvIntake() {
  const router = useRouter();
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function downloadTemplate() {
    const blob = new Blob([templateCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "formatka-kickback.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    const { products, errors: errs } = parseOfferCsv(await file.text());
    if (products.length) {
      sessionStorage.setItem("kb-csv-import", JSON.stringify(products));
      router.push("/start");
      return;
    }
    setErrors(errs.length ? errs : ["Plik nie zawierał żadnych produktów."]);
    setBusy(false);
  }

  return (
    <div className="card-gradient-dark p-8 lg:p-10 relative overflow-hidden">
      <div className="glow-blob" aria-hidden />
      <div className="relative flex flex-wrap items-center justify-between gap-6">
        <div className="max-w-[52ch]">
          <div className="label !text-mint/80">Dodaj nowe pozycje</div>
          <h2 className="mt-2 font-light text-[24px] lg:text-[30px] leading-[1.1] tracking-[-0.02em]">
            Wgraj plik z towarem.
          </h2>
          <p className="mt-3 text-text-soft text-[14px] leading-[1.6]">
            Pobierz formatkę, uzupełnij w Excelu (zapisz jako CSV) i wgraj — pozycje
            wskoczą do formularza Nowej oferty, gdzie dodasz zdjęcia i potwierdzisz.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={downloadTemplate} className="btn-ghost h-11 px-5 text-[13px]">
            Pobierz formatkę (CSV)
          </button>
          <label className={`btn-primary h-11 px-5 text-[13px] inline-flex items-center cursor-pointer ${busy ? "opacity-60 pointer-events-none" : ""}`}>
            {busy ? "Wczytuję…" : "Wgraj plik"}
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }}
            />
          </label>
        </div>
      </div>
      {errors.length > 0 && (
        <ul className="relative mt-4 text-[12px] text-coral list-disc pl-4">
          {errors.slice(0, 5).map((e) => <li key={e}>{e}</li>)}
          {errors.length > 5 && <li>…i {errors.length - 5} {plural(errors.length - 5, ["kolejny", "kolejne", "kolejnych"])}.</li>}
        </ul>
      )}
    </div>
  );
}

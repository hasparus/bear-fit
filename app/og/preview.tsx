import { createRoot } from "react-dom/client";

import { OgCard, type OgCardProps } from "./OgCard";
import "../styles.css";

const range = (from: string, to: string) => {
  const days: Date[] = [];
  for (
    let d = new Date(from);
    d <= new Date(to);
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    days.push(new Date(d));
  }
  return days;
};

/** Dev-only gallery of link-preview designs: `pnpm dev`, then /og-preview.html. */
const EXAMPLES: Record<string, OgCardProps> = {
  card: { dates: "Nov 6 – Dec 10, 2026", name: "Wyjazd w góry" },
  "card-rolling": { dates: "Next 14 days", name: "Board games night" },
  bare: {
    dates: "Nov 6 – Dec 10, 2026",
    layout: "bare",
    name: "Wyjazd w góry",
  },
  "card-light": {
    dark: false,
    dates: "Dec 6 – 19, 2026",
    days: range("2026-12-06", "2026-12-19"),
    name: "Wyjazd w góry",
  },
  "card-long": {
    dates: "Nov 6 – Dec 10, 2026",
    name: "Wyjazd w góry z ekipą z liceum — kto kiedy może, bo trzeba rezerwować domek",
  },
  "card-month": {
    dates: "Dec 6 – 19, 2026",
    days: range("2026-12-06", "2026-12-19"),
    name: "Wyjazd w góry",
  },
  "card-month-long": {
    dates: "Dec 1 – 31, 2026",
    days: range("2026-12-01", "2026-12-31"),
    name: "Wigilia klasowa — kto kiedy może przyjść?",
  },
};

function Gallery() {
  return (
    <div className="flex flex-col items-start gap-8 p-8">
      {Object.entries(EXAMPLES).map(([id, props]) => (
        <section id={id} key={id}>
          <p className="mb-2 font-mono text-sm">{id}</p>
          <OgCard {...props} />
        </section>
      ))}
    </div>
  );
}

createRoot(document.getElementById("app")!).render(<Gallery />);

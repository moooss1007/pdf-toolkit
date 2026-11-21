import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "pdf-toolkit",
  name: "PDF Toolkit",
  description:
    "Merge, split, reorder, number, watermark and convert PDFs, with each member's results kept privately for two hours.",
  resources: {
    d1: ["DB"],
    r2: ["files"],
  },
});

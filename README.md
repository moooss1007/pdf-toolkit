# PDF Toolkit

Merge, split, reorder, number, watermark and convert PDFs in the browser. Each member's results are kept privately for two hours, then deleted.

Inspired by https://ilovepdf.es

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Merge up to 25 PDFs and JPG/PNG images (100 MB in total) into one PDF, in the order you set.
- Split a PDF by custom ranges, by chosen pages, or into parts of a fixed number of pages.
- Reorder, rotate, remove and insert pages, add pages from another PDF, and save a new PDF.
- Add page numbers with a position, format, first number, font size and page range.
- Add a text or image watermark with position or tiling, opacity, rotation, page range and layer.
- Turn JPG and PNG images into one PDF with a page size, orientation and margin.
- Save the pages of a PDF as JPG images, at normal or high quality.
- Find your results in a private library for two hours, download or delete them, and start a tool from one; admins see storage per member and can purge expired files.

Left out: accounts and sign-in, which your Gateway handles; compression, repair, OCR and Office conversions; AI tools; editing, signing and security tools; mobile and desktop apps; a developer API and paid plans.

## Setup

- Install: `pnpm install`.
- Run locally: `pnpm dev`, then open the printed address.
- Test: `pnpm test` for the unit tests; `checks/` holds the release suites (behavior, authorization, persistence), which run against a packaged release in the oss.new runtime.
- Deploy: `pnpm run deploy` to your EveryApp Gateway. Your Cloudflare account must have R2 enabled.

There are no secrets or settings to set. The app uses a D1 database for the list of results, an R2 bucket for the files, and a cron every five minutes that removes expired results.

## Limitations

- The tools run in the browser, so very large PDFs need a computer with enough memory.
- Password-protected PDFs are refused.
- Results are deleted two hours after they are made; download what you want to keep.
- Real deployment was not exercised here: the checks run against a local copy of the release.

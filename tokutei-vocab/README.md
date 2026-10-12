# TOKUTEI – Flashcard & Quiz từ vựng theo bài

- `apps-script/Code.gs`: dán vào Apps Script của Google Sheet list từ vựng (sheet `Từ vựng`) → menu **🎴 Flashcard & Quiz** → xuất 2 file .xlsx/bài vào folder Drive, link ghi ở sheet `Xuất file`.
- `exports/flashcard/`, `exports/quiz/`: file đã xuất sẵn cho Bài 1–15.
- Chạy lại offline: `node tools/gen.cjs > out.json && python3 tools/write_xlsx.py out.json` (dữ liệu: `data/vocab.tsv`).

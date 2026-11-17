# RLR

RLR turns a plain-language clinical note into three South African ICD-10 codes from the NDoH Master Industry Table (2021), with CMS PMB flags where the listing is specific.

The coding runs in the browser. There is no server and no API key.

## GitHub Pages

The static site lives in `/docs` and is published by `.github/workflows/pages.yml`.

https://sasa021.github.io/rlr/

Open the page, type a note, and press **Suggest codes**. Confirm stores the choice in `localStorage` on this browser.

## Data

`docs/codes.json` is the suggestable MIT (code, description, and a PMB code when one is specific). Rebuild it from the committed workbooks:

```bash
python3 -m pip install -r requirements.txt
python3 scripts/export_pages_json.py
```

That writes `data/mit.sqlite` and then `docs/codes.json`.

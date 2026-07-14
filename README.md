# Camp Ledger

A mobile-first campsite map, personalized rating portal, and camping diary built from the existing **Camp Site Reviews.xlsx** workbook.

## What is included

- Leaflet map with all 28 imported campsite coordinates
- Personalized marker scores based on the selected preference profile
- Editable weights for months and physical campsite qualities
- Dated camping diary with automatic night calculation
- Previous physical ratings prefilled when logging another stay
- Separate options to record a stay-only observation or update the campsite's current profile
- Preserved legacy stay counts where the spreadsheet did not contain dates
- Cloudflare Pages Functions and D1 schema
- Browser-storage fallback, so the interface works before D1 is configured

## Local preview

```bash
npm install
npm run dev
```

Vite will provide a local URL. In this mode the app uses browser storage if the Cloudflare API is unavailable.

## Connect Cloudflare D1

1. Authenticate Wrangler:

```bash
npx wrangler login
```

2. Create the database:

```bash
npm run db:create
```

3. Copy the database ID returned by Wrangler into `wrangler.jsonc`, replacing:

```text
00000000-0000-0000-0000-000000000000
```

4. Apply the schema and imported campsite seed data:

```bash
npm run db:migrate:remote
```

For a local D1 database instead:

```bash
npm run db:migrate:local
```

5. Build and run the Pages project locally:

```bash
npm run preview:cloudflare
```

## GitHub and Cloudflare Pages deployment

Push this folder to a GitHub repository. In Cloudflare Pages, import the repository and use:

- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `dist`

Add a D1 binding named **DB** to the Pages project, selecting the `campsite-diary` database. Redeploy after adding the binding.

## Map tiles

The demo defaults to OpenStreetMap's standard tile endpoint. It includes attribution and is appropriate for light personal testing. For a larger public deployment, configure a dedicated tile provider with these environment variables:

```text
VITE_TILE_URL=https://your-provider/{z}/{x}/{y}.png
VITE_TILE_ATTRIBUTION=Your required attribution
```

## Data model

- `sites`: the current reusable campsite profile
- `site_facts`: current levelness, cell service, privacy, tree cover, and similar information
- `site_fact_history`: records changes to the physical site profile
- `site_seasonal_ratings`: campsite suitability by month
- `stays`: dated diary entries
- `stay_observations`: what was observed on one specific trip
- `preference_profiles`: different people or camping styles
- `profile_criterion_weights`: importance of physical qualities
- `profile_month_weights`: importance of each month

## Important behavior

A value of `0` is a real poor rating. An unknown or unreviewed item is omitted entirely and does not affect the score.

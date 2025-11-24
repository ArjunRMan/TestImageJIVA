# TestImageJIVA

A Next.js application for uploading images, applying grayscale/contrast adjustments, cropping, and sending the processed image through a chained pair of APIs.

## Features

- Upload images via drag-and-drop or file selection
- Inline editor with manual crop, grayscale toggle, and contrast/intensity sliders
- Sends the edited file to the tmpfiles upload API
- Automatically forwards the resulting URL to the Growth Card convert API and previews the response

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:  
Create or update `.env.local` with values similar to:
```
# Upload API (defaults to https://parse.jivalearningsystem.com/api/upload-to-tmpfiles)
NEXT_PUBLIC_UPLOAD_API_URL=https://parse.jivalearningsystem.com/api/upload-to-tmpfiles

# Growth Card convert API
NEXT_PUBLIC_CONVERT_API_URL=https://jiva-backend-five.vercel.app/api/v1/growth-card/convert-image
NEXT_PUBLIC_CONVERT_API_TOKEN=your-long-lived-bearer-token
NEXT_PUBLIC_CONVERT_ENTITY_TYPE=dkn_report
NEXT_PUBLIC_CONVERT_ENTITY_ID=0
NEXT_PUBLIC_CONVERT_CLASS_ID=132
NEXT_PUBLIC_CONVERT_SCHOOL_ID=215
NEXT_PUBLIC_CONVERT_ACADEMIC_YEAR=2025-2026
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## API Flow

1. The app sends POST requests to `NEXT_PUBLIC_UPLOAD_API_URL` (defaults to `https://parse.jivalearningsystem.com/api/upload-to-tmpfiles`) with the edited file and expects:
```json
{
  "status": "success",
  "filename": "1_preview.png",
  "url": "https://tmpfiles.org/dl/11038191/1_preview.png"
}
```

2. The returned `url` is immediately forwarded to `${NEXT_PUBLIC_CONVERT_API_URL}` with the configured metadata fields to generate the final Growth Card asset. The raw response plus any returned URL are displayed in the UI.

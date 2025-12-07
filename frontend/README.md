# Bible Image Generator - Frontend

React + TypeScript frontend application for the Bible Image Generator.

## Structure

```
frontend/
├── src/
│   ├── components/          # React components
│   │   ├── GeneratorForm.tsx    # Form for generating images
│   │   ├── ImageDisplay.tsx     # Display generated images
│   │   ├── DailyVerse.tsx       # Daily verse component
│   │   ├── Gallery.tsx          # User's generation history
│   │   ├── ShareModal.tsx       # Share modal with options
│   │   └── index.ts             # Component exports
│   ├── context/             # React Context
│   │   └── AppContext.tsx       # Global state management
│   ├── App.tsx              # Main application component
│   ├── main.tsx             # Application entry point
│   └── index.css            # Global styles with Tailwind
├── index.html               # HTML entry point
├── tsconfig.json            # TypeScript configuration
└── tsconfig.node.json       # TypeScript config for build tools
```

## Features

- **GeneratorForm**: Input form for verse reference, style preset, and custom prompt
- **ImageDisplay**: Display generated images with download and share buttons
- **DailyVerse**: Homepage component showing the daily verse image
- **Gallery**: Grid view of user's generation history with filtering
- **ShareModal**: Modal with WhatsApp sharing, Web Share API, and copy link
- **AppContext**: Global state management using React Context

## Technologies

- React 18
- TypeScript
- Tailwind CSS
- Vite

## Development

```bash
# Start development server
npm run dev:frontend

# Build for production
npm run build:frontend

# Type check
npx tsc --project frontend/tsconfig.json --noEmit
```

## State Management

The application uses React Context (`AppContext`) to manage:
- Current generated image
- Daily verse data
- Generation history
- Loading states
- Error messages

## Styling

Tailwind CSS is configured with:
- Dark mode support
- Responsive design (mobile-first)
- Custom color schemes
- Utility-first approach

## API Integration

The frontend expects the following API endpoints:

- `POST /api/generate` - Generate new image
- `GET /api/daily-verse` - Fetch daily verse
- `GET /api/images/:imageId` - Get specific image
- `GET /api/images/:imageId/share` - Get share link

## Browser Support

- Modern browsers with ES2020 support
- Web Share API (optional, with fallback)
- Clipboard API for copy functionality

# React Router 7 Data Mode with Custom SSR (Express)

This is a React Router 7 Data Mode application with custom server-side rendering using Express.

## Features

- Custom SSR implementation using `createStaticHandler` and `createStaticRouter`
- Express server for handling requests
- Client-side hydration
- Same UI and functionality as the data mode version

## Getting Started

### Install Dependencies

```bash
npm install
# or
pnpm install
```

### Development

For development, you can run Vite in dev mode:

```bash
npm run dev
```

### Build and Production

Build the application:

```bash
npm run build
```

Start the Express server:

```bash
npm start
```

The server will run on `http://localhost:3000`

## How It Works

1. **Routes Configuration**: Routes are defined in `app/routes.ts`
2. **Server**: Express server in `server/index.ts` uses `createStaticHandler` to handle requests
3. **SSR**: Server renders React components using `renderToString` and `StaticRouterProvider`
4. **Hydration**: Client-side entry point (`src/entry.client.tsx`) hydrates the app with `createBrowserRouter` and hydration data

## Project Structure

```
app/
  ├── routes.ts          # Route configuration
  ├── root.tsx           # Root layout component
  ├── components/        # React components
  ├── contexts/          # React contexts
  └── routes/            # Route components

server/
  └── index.ts           # Express server with SSR

src/
  └── entry.client.tsx   # Client-side hydration entry point
```


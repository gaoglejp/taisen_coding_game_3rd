// Socket.io is served via the custom server (server.ts), not via Next.js API routes.
// This file exists only to document the WebSocket endpoint.
// The Socket.io server is mounted at /api/socket by the custom Express-like server.

export async function GET() {
  return new Response(
    JSON.stringify({ message: "Socket.io is served via custom server at /api/socket" }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}

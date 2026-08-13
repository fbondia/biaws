import http from "node:http";

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

export function createHealthRequestHandler({ status, telemetry }) {
  return (request, response) => {
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Method not allowed" });
      return;
    }
    if (request.url === "/health/live") {
      const current = status();
      sendJson(response, current.live ? 200 : 503, current);
      return;
    }
    if (request.url === "/health/ready") {
      const current = status();
      sendJson(response, current.ready ? 200 : 503, current);
      return;
    }
    if (request.url === "/metrics") {
      response.writeHead(200, {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      });
      response.end(telemetry.prometheus());
      return;
    }
    sendJson(response, 404, { error: "Not found" });
  };
}

export function createHealthServer({ host, port, status, telemetry }) {
  const server = http.createServer(
    createHealthRequestHandler({ status, telemetry }),
  );
  return {
    async start() {
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, resolve);
      });
      return server.address();
    },
    async stop() {
      if (!server.listening) return;
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

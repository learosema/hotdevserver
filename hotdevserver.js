#!/usr/bin/env node

import EventEmitter from "node:events";
import { readFile, existsSync } from "node:fs";
import { watch } from "node:fs/promises";
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

function getMime(path) {
  if (/\.html?$/.test(path)) return "text/html";
  if (/\.css$/.test(path)) return "text/css";
  if (/\.gif$/.test(path)) return "image/gif";
  if (/\.png$/.test(path)) return "image/png";
  if (/\.webp$/.test(path)) return "image/webp";
  if (/\.jpe?g$/.test(path)) return "image/jpeg";
  if (/\.svg$/.test(path)) return "image/svg+xml";
  if (/\.xml$/.test(path)) return "text/xml";
  if (/\.js$/.test(path)) return "text/javascript";
  if (/\.json$/.test(path)) return "application/json";
  if (/\.midi?$/.test(path)) return "audio/midi";
  if (/\.ico$/.test(path)) return "image/vnd.microsoft.icon";
  if (/\.txt$/.test(path)) return "text/plain";
  if (/\.md$/.test(path)) return "text/plain";
  return "application/octet-stream";
}

const DEVSERVER_JS = `
const eventSource = new EventSource('/_dev-events');
window.addEventListener('beforeunload', () => eventSource.close(), false);
eventSource.addEventListener('message', (e) => {
  const events = JSON.parse(e.data);
  for (const event of events) {    
    document.location.reload();
  }
});
`;

function sendFactory(req, res) {
  const send = (code, content, mimetype = "text/html") => {
    console.log(`[http]\t (${code}) ${req.method} ${req.url}`);
    res.writeHead(code, {
      "Content-Type": mimetype,
      "Cache-Control": "no-cache",
    });
    res.end(content);
  };
  const sendError = (code, message) => send(code, `${code} ${message}`);
  return { send, sendError };
}

/**
 * Server-sent Events endpoint from the dev server.
 * Notifies the browser about file changes
 *
 * @param {ServerResponse<IncomingMessage>} res
 * @param {EventEmitter} eventEmitter
 */
function serverSentEvents(req, res, eventEmitter) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const watchListener = (...payload) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  eventEmitter.on("watch-event", watchListener);
  req.on("close", () => {
    eventEmitter.off("watch-event", watchListener);
    res.end();
  });
}

function serve(wwwRoot, eventEmitter = null, listenOptions) {
  return new Promise((resolve) => {
    const host = listenOptions?.host ?? process.env.HOST ?? "localhost";
    const port =
      listenOptions?.port ?? parseInt(process.env.PORT ?? "8080", 10);
    const server = createServer((req, res) => {
      const url = new URL(
        `http://${host}${port !== 80 ? `:${port}` : ""}${req.url}`
      );
      const { send, sendError } = sendFactory(req, res);
      if (eventEmitter && url.pathname === "/_dev-events") {
        serverSentEvents(req, res, eventEmitter);
        return;
      }
      if (url.pathname === "/_dev-events.js") {
        send(200, DEVSERVER_JS, "text/javascript");
        return;
      }
      const dir = path.resolve(process.cwd(), wwwRoot);
      const resourcePath = path.normalize(
        url.pathname + (url.pathname.endsWith("/") ? "index.html" : "")
      );
      if (resourcePath.split("/").includes("..")) {
        sendError(404, "Not Found");
        return;
      }
      const filePath = path.join(dir, path.normalize(resourcePath));
      if (!filePath.startsWith(dir)) {
        sendError(404, "Not Found");
        return;
      }
      readFile(filePath, (err, data) => {
        if (err) {
          sendError(404, "Not Found");
          return;
        }
        const mime = getMime(resourcePath);
        if (data && mime === "text/html") {
          send(
            200,
            data
              .toString()
              .replace(
                "</body>",
                '<script src="/_dev-events.js"></script></body>'
              ),
            mime
          );
          return;
        }
        send(200, data, mime);
      });
    });
    server.listen({ port, host, ...(listenOptions ?? {}) }, () => {
      console.log(`[http]\tServer listening on http://${host}:${port}/`);
      resolve(server);
    });
  });
}

async function watchFolder(
  inputDir,
  eventEmitter = null,
  watchOptions = null,
  ignoreList = []
) {
  const watchFileDelta = 100;
  const lastExec = new Map();
  const options = { recursive: true };
  if (watchOptions) {
    Object.assign(options, watchOptions);
  }
  inputDir = path.normalize(inputDir);
  const ignores = [".git", "node_modules", ...ignoreList];
  if (!existsSync(inputDir)) {
    throw new Error(`Input directory Not found: ${inputDir}`);
  }
  console.info(`[watch]\tWatching ${inputDir}`);
  try {
    const watcher = watch(inputDir, options);
    for await (const event of watcher) {
      if (lastExec.has(event.filename)) {
        const delta = performance.now() - lastExec.get(event.filename);
        if (delta < watchFileDelta) {
          continue;
        }
      }
      const info = path.parse(event.filename);
      if (ignores.find((d) => info.dir.startsWith(path.normalize(d)))) {
        continue;
      }
      lastExec.set(event.filename, performance.now());
      console.log(`[${event.eventType}] ${event.filename}`);
      // eventEmitter.emit(event.eventType, event.filename)
      eventEmitter.emit("watch-event", {
        eventType: "change",
        filename: event.filename,
      });
    }
  } catch (err) {
    if (err.name === "AbortError") return;
    throw err;
  }
}

const eventEmitter = new EventEmitter();

const folder =
  process.argv.length > 2 ? process.argv.slice(-1).pop() : "public";

serve(folder, eventEmitter);
watchFolder(folder, eventEmitter);

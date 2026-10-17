import { createServer, type Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";

const PING_INTERVAL_MS = 30_000;
const MAX_PAYLOAD_BYTES = 1_048_576;

interface SignalingMessage {
  type?: unknown;
  topic?: unknown;
  topics?: unknown;
  data?: unknown;
  clients?: unknown;
}

export class SignalingServer {
  private httpServer: Server | null = null;
  private wss: WebSocketServer | null = null;
  private readonly topics = new Map<string, Set<WebSocket>>();
  private readonly timers = new Map<WebSocket, NodeJS.Timeout>();
  private readonly lastPong = new Map<WebSocket, boolean>();

  start(port = 0): Promise<number> {
    if (this.httpServer) {
      throw new Error("Signaling server already running");
    }
    const httpServer = createServer((_request, response) => {
      response.writeHead(200, { "Content-Type": "text/plain" });
      response.end("pagegrove signaling");
    });
    const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD_BYTES });
    wss.on("connection", (socket) => this.onConnection(socket));

    httpServer.on("upgrade", (request, socket, head) => {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    });

    this.httpServer = httpServer;
    this.wss = wss;

    return new Promise((resolve, reject) => {
      httpServer.once("error", reject);
      httpServer.listen(port, "0.0.0.0", () => {
        const address = httpServer.address();
        if (address === null || typeof address === "string") {
          reject(new Error("Could not determine signaling port"));
          return;
        }
        resolve(address.port);
      });
    });
  }

  stop(): Promise<void> {
    const wss = this.wss;
    const httpServer = this.httpServer;
    this.wss = null;
    this.httpServer = null;
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
    this.lastPong.clear();
    this.topics.clear();
    const closeSockets = (): Promise<void> =>
      new Promise((resolve) => {
        if (!wss) {
          resolve();
          return;
        }
        for (const client of wss.clients) {
          try {
            client.terminate();
          } catch {
            // already gone
          }
        }
        wss.close(() => resolve());
      });
    return closeSockets().then(
      () =>
        new Promise((resolve) => {
          if (!httpServer) {
            resolve();
            return;
          }
          httpServer.close(() => resolve());
        }),
    );
  }

  private onConnection(socket: WebSocket): void {
    const subscribed = new Set<string>();
    const pingTimer = setInterval(() => {
      if (this.lastPong.get(socket) === false) {
        clearInterval(pingTimer);
        this.timers.delete(socket);
        try {
          socket.terminate();
        } catch {
          // already gone
        }
        return;
      }
      this.lastPong.set(socket, false);
      try {
        socket.ping();
      } catch {
        // socket closing
      }
    }, PING_INTERVAL_MS);
    this.timers.set(socket, pingTimer);
    this.lastPong.set(socket, true);

    socket.on("pong", () => {
      this.lastPong.set(socket, true);
    });

    socket.on("message", (raw) => {
      let message: SignalingMessage;
      try {
        message = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf8")) as SignalingMessage;
      } catch {
        return;
      }
      if (message === null || typeof message !== "object" || typeof message.type !== "string") {
        return;
      }
      switch (message.type) {
        case "subscribe": {
          const topics = Array.isArray(message.topics) ? message.topics : [];
          for (const topic of topics) {
            if (typeof topic !== "string" || topic.length === 0 || topic.length > 256) {
              continue;
            }
            const subscribers = this.topics.get(topic) ?? new Set<WebSocket>();
            subscribers.add(socket);
            this.topics.set(topic, subscribers);
            subscribed.add(topic);
          }
          break;
        }
        case "unsubscribe": {
          const topics = Array.isArray(message.topics) ? message.topics : [];
          for (const topic of topics) {
            if (typeof topic === "string") {
              this.dropSubscription(socket, topic);
              subscribed.delete(topic);
            }
          }
          break;
        }
        case "publish": {
          if (typeof message.topic !== "string") {
            return;
          }
          const receivers = this.topics.get(message.topic);
          if (!receivers) {
            return;
          }
          const payload: SignalingMessage = { ...message, clients: receivers.size };
          let encoded: string;
          try {
            encoded = JSON.stringify(payload);
          } catch {
            return;
          }
          for (const receiver of receivers) {
            this.send(receiver, encoded);
          }
          break;
        }
        case "ping": {
          this.send(socket, JSON.stringify({ type: "pong" }));
          break;
        }
        default:
          return;
      }
    });

    const cleanup = (): void => {
      const timer = this.timers.get(socket);
      if (timer) {
        clearInterval(timer);
        this.timers.delete(socket);
      }
      this.lastPong.delete(socket);
      for (const topic of subscribed) {
        this.dropSubscription(socket, topic);
      }
      subscribed.clear();
    };
    socket.on("close", cleanup);
    socket.on("error", cleanup);
  }

  private dropSubscription(socket: WebSocket, topic: string): void {
    const subscribers = this.topics.get(topic);
    if (!subscribers) {
      return;
    }
    subscribers.delete(socket);
    if (subscribers.size === 0) {
      this.topics.delete(topic);
    }
  }

  private send(socket: WebSocket, encoded: string): void {
    if (socket.readyState !== socket.OPEN && socket.readyState !== socket.CONNECTING) {
      try {
        socket.close();
      } catch {
        // already gone
      }
      return;
    }
    try {
      socket.send(encoded);
    } catch {
      try {
        socket.close();
      } catch {
        // already gone
      }
    }
  }
}

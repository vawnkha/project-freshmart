import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect() {
    if (this.socket) return this.socket;

    this.socket = io(SOCKET_URL, {
      transports: ["websocket"],
      withCredentials: true,
      auth: (callback) => {
        callback({ token: localStorage.getItem("accessToken") || "" });
      },
    });

    return this.socket;
  }

  joinAdminRoom() {
    return this.connect();
  }

  onAdminNotification(callback) {
    if (!this.socket) this.connect();
    this.socket.on("admin:notification", callback);
  }

  offAdminNotification(callback) {
    if (!this.socket) return;
    this.socket.off("admin:notification", callback);
  }

  disconnect() {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket = null;
  }
}

export default new SocketService();

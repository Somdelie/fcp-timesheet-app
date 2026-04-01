import { useEffect, useRef, useState } from "react";

export function useWebSocket(url: string) {
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      setLastMessage(event);
    };

    socket.onclose = () => {
      setIsConnected(false);
    };

    const reconnect = () => {
      console.warn("Attempting to reconnect...");
      setTimeout(() => {
        if (socketRef.current?.readyState !== WebSocket.OPEN) {
          socketRef.current = new WebSocket(url);
        }
      }, 5000); // Retry after 5 seconds
    };

    socket.onerror = (event) => {
      console.error("WebSocket error:", {
        event,
        readyState: socket.readyState,
        url,
      });
      reconnect();
    };

    return () => {
      socket.close();
    };
  }, [url]);

  const sendMessage = (message: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(message);
    } else {
      console.warn("WebSocket is not connected.");
    }
  };

  return { sendMessage, lastMessage, isConnected };
}

import { createContext } from 'react';
import io from 'socket.io-client';

// Подключаемся напрямую к бэкенду (3001), минуя прокси Vite
const socketUrl = 'http://localhost:3001';

const socket = io(socketUrl, {
  transports: ['websocket'],
  upgrade: false,
  reconnection: true
});

const SocketContext = createContext(socket);

export { SocketContext, socket };
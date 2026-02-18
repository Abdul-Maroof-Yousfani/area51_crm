import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// Singleton socket instance to prevent multiple connections
let socket;

export const useSocket = (url = 'http://localhost:3006') => {
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        if (!socket) {
            socket = io(url, {
                withCredentials: true,
                transports: ['websocket', 'polling'],
                autoConnect: true,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
            });
        }

        const onConnect = () => {
            console.log('✅ Connected to Socket.IO server at', url);
            setIsConnected(true);
        };

        const onDisconnect = (reason) => {
            console.log('❌ Disconnected from Socket.IO server:', reason);
            setIsConnected(false);
        };

        const onConnectError = (err) => {
            console.error('⚠️ Socket connection error:', err.message);
        };

        if (socket.connected) {
            setIsConnected(true);
        }

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('connect_error', onConnectError);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('connect_error', onConnectError);
        };
    }, [url]);

    return { socket, isConnected };
};

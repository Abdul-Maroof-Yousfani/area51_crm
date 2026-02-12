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
                transports: ['websocket', 'polling']
            });
        }

        const onConnect = () => {
            console.log('✅ Connected to Socket.IO server');
            setIsConnected(true);
        };
        const onDisconnect = () => {
            console.log('❌ Disconnected from Socket.IO server');
            setIsConnected(false);
        };
        const onConnectError = (err) => {
            console.error('⚠️ Socket connection error:', err);
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('connect_error', onConnectError);

        // Initial state
        if (socket.connected) {
            console.log('✅ Socket already connected');
            setIsConnected(true);
        }

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
        };
    }, [url]);

    return { socket, isConnected };
};

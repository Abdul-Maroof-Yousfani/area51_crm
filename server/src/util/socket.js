
import { Server } from 'socket.io';

let io;

export const initSocket = (httpServer) => {
    io = new Server(httpServer, {
        cors: {
            origin: ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'], // Verify clients origin
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    io.on('connection', (socket) => {
        console.log('✅ Client connected to Socket.IO:', socket.id);

        socket.on('disconnect', () => {
            console.log('❌ Client disconnected from Socket.IO:', socket.id);
        });
    });

    console.log('🔌 Socket.IO initialized');
    return io;
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.io not initialized!');
    }
    return io;
};

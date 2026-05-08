import dotenv from "dotenv";
dotenv.config();
import app from "./src/app";
import connectDB from "./src/config/db";
import http from "http";
import { Server } from "socket.io";
import { setIo } from "./src/socket";

connectDB();

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

setIo(io);

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("joinBus", (busId: string) => {
    socket.join(busId);
    console.log(`User joined bus room: ${busId}`);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const app = require("./config/server").app;
const server = require("./config/server").server;
const io = require("./config/server").io;
const port = process.env.PORT || 3000;
const expressStatusMonitor = require("express-status-monitor");
const bodyParser = require("body-parser");
const router = require("./routes/router");

server.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(expressStatusMonitor({ websocket: io, port: app.get("port") }));
app.use(router);

// Array de mensagens passadas provisório => será substituido pelas mensagens no drive
let previousMessagesArray = [];
let rooms = {};

let globalRoomSockets = [];

const broadCastGlobal = message => {
  globalRoomSockets
    .map(el => el.socket)
    .forEach(socket => writeGlobalMessage(socket, message));
};

const writeGlobalMessage = (socket, message) => {
  socket.emit("globalMessage", JSON.stringify(message));
};

// Eventos do socket quando este é iniciado
io.on("connection", socketClient => {
  socketClient.on("userConnectedToRoom", roomConnectionData => {
    let { sender, receiver, room } = roomConnectionData;

    // Sender conectado na sala
    socketClient.join(room);

    console.log(`${sender} joined ${room} as sender to ${receiver}`);

    rooms[room] = { users: [] };
    rooms[room].users[socketClient.id] = sender;
  });

  socketClient.on("connectToGlobal", params => {
    let { sender } = params;
    let userSocket = { user: sender, socket: socketClient };

    usersConnecteds = globalRoomSockets.map(el => el.user);

    console.log("usersConnecteds", usersConnecteds);

    if (!usersConnecteds.includes(userSocket.user)) {
      console.log(`${sender} joined global room`, params);
      globalRoomSockets.push(userSocket);
    }
  });

  socketClient.on("sendMessageGlobal", data => {
    console.log("client trying to send global message", data);
    let { message } = data;
    broadCastGlobal(message);
  });

  socketClient.on("sendMessage", data => {
    let { author, message, room } = data;
    previousMessagesArray.push({ author, message, room }); // vai sumir depois pra virar persistencia no drive
    socketClient.to(room).broadcast.emit("receivedMessage", data);
  });

  socketClient.emit("previousMessages", previousMessagesArray);

  socketClient.on("disconnect", () => {
    console.info(`Client disconnected: ${socketClient.id}`);
    // TODO: chamar lastSeenController e mudar pro instante corrente
  });
});
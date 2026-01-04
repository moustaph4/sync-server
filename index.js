const http = require("http");
const { Server } = require("socket.io");
const express = require("express");

const app = express();
const httpServer = http.createServer(app);

app.get("/", (req, res) => res.send("✅ SyncFhams USER-SYSTEM SERVER ACTIVE"));

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// Odaları ve Şifreleri Tutan Hafıza
// Yapı: { "odaAdi": { pass: "123", users: [] } }
const rooms = {}; 

console.log("🚀 Sunucu Başlatıldı...");

io.on("connection", (socket) => {
  socket.currentRoom = null;
  socket.username = null;

  // --- ODA OLUŞTURMA ---
  socket.on("CREATE_ROOM", ({ roomName, password, username }) => {
    if (rooms[roomName]) {
      socket.emit("JOIN_ERROR", "⚠️ Bu isimde bir oda zaten var! Katılmayı deneyin.");
    } else {
      // Odayı kur
      rooms[roomName] = { pass: password, users: [] };
      joinRoomLogic(socket, roomName, username);
      socket.emit("JOIN_SUCCESS", "Oda başarıyla oluşturuldu.");
    }
  });

  // --- ODAYA KATILMA ---
  socket.on("JOIN_ROOM", ({ roomName, password, username }) => {
    if (!rooms[roomName]) {
      socket.emit("JOIN_ERROR", "❌ Böyle bir oda bulunamadı.");
    } else if (rooms[roomName].pass !== password) {
      socket.emit("JOIN_ERROR", "🔒 Şifre hatalı!");
    } else {
      joinRoomLogic(socket, roomName, username);
      socket.emit("JOIN_SUCCESS", "Giriş başarılı.");
    }
  });

  // Ortak Giriş Mantığı
  function joinRoomLogic(socket, roomName, username) {
    socket.join(roomName);
    socket.currentRoom = roomName;
    socket.username = username;

    // Kullanıcıyı listeye ekle
    if(rooms[roomName]) {
        rooms[roomName].users.push(username);
    }

    // Odadaki herkese güncel listeyi gönder
    io.to(roomName).emit("UPDATE_USER_LIST", rooms[roomName].users);
  }

  // --- AKSİYONLAR ---
  socket.on("ACTION", (data) => {
    if (socket.currentRoom) {
      socket.to(socket.currentRoom).emit("SYNC_ACTION", data);
    }
  });

  // --- KOPMA VE LİSTE GÜNCELLEME ---
  socket.on("disconnect", () => {
    const roomName = socket.currentRoom;
    if (roomName && rooms[roomName]) {
      // Kullanıcıyı listeden sil
      rooms[roomName].users = rooms[roomName].users.filter(u => u !== socket.username);
      
      // Kalanlara yeni listeyi gönder
      io.to(roomName).emit("UPDATE_USER_LIST", rooms[roomName].users);

      // Oda boşaldıysa sil
      if (rooms[roomName].users.length === 0) {
        delete rooms[roomName];
        console.log(`🗑️ Oda silindi: ${roomName}`);
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`Sunucu ${PORT} portunda.`));
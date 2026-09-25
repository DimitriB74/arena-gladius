// ============================================================================
//  ARENA GLADIUS — server/index.js
//
//  Point d'entrée du serveur :
//  - Express sert les fichiers du jeu (dossiers client/ et shared/)
//  - Socket.IO gère la communication en temps réel avec les navigateurs
//  - le lobby (server/lobby.js) gère joueurs, défis et combats
//  Lancement : npm start   (ou : node server/index.js)
// ============================================================================

import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Server } from 'socket.io';
import { JEU } from '../shared/data.js';
import { Lobby } from './lobby.js';

const dossier = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.static(path.join(dossier, '..', 'client')));
app.use('/shared', express.static(path.join(dossier, '..', 'shared')));

// Petite route de contrôle (utile pour vérifier que Render a bien démarré)
app.get('/sante', (req, res) => res.json({ ok: true, jeu: JEU.nom }));

const serveurHttp = createServer(app);
// Messages limités à 20 Ko : les navigateurs n'envoient que de petites intentions
const io = new Server(serveurHttp, { maxHttpBufferSize: 20000 });
const lobby = new Lobby(io);

function diffuserInfo() {
  io.emit('serveur:info', { connectes: io.engine.clientsCount });
}

io.on('connection', (socket) => {
  lobby.connexion(socket);
  diffuserInfo();
  socket.on('disconnect', diffuserInfo);
});

// Render (et la plupart des hébergeurs) imposent le port via process.env.PORT
const PORT = process.env.PORT || 3000;
serveurHttp.listen(PORT, () => {
  console.log(`${JEU.nom} est en ligne : http://localhost:${PORT}`);
});

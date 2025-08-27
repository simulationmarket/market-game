const express = require('express');
const router = express.Router();

let players = {}; // Aquí podrías exportar/usar un servicio de jugadores si se complica más

router.get('/players', (req, res) => {
    res.json(Object.values(players));
});

router.get('/players/:name', (req, res) => {
    const player = players[req.params.name];
    if (player) {
        res.json(player);
    } else {
        res.status(404).send('Jugador no encontrado');
    }
});

module.exports = { router, players };

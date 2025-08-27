-- CreateTable
CREATE TABLE "Decision" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jugadorId" TEXT NOT NULL,
    "partidaId" TEXT NOT NULL,
    "rondaId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    CONSTRAINT "Decision_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "Jugador" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Decision_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "Partida" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Decision_rondaId_fkey" FOREIGN KEY ("rondaId") REFERENCES "Ronda" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Decision_partidaId_rondaId_jugadorId_idx" ON "Decision"("partidaId", "rondaId", "jugadorId");

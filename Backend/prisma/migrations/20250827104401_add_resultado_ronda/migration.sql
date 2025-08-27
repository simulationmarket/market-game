-- CreateTable
CREATE TABLE "ResultadoRonda" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partidaId" TEXT NOT NULL,
    "rondaId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    CONSTRAINT "ResultadoRonda_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "Partida" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResultadoRonda_rondaId_fkey" FOREIGN KEY ("rondaId") REFERENCES "Ronda" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ResultadoRonda_partidaId_rondaId_key" ON "ResultadoRonda"("partidaId", "rondaId");

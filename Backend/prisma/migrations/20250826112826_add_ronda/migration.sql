-- CreateTable
CREATE TABLE "Ronda" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "numero" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partidaId" TEXT NOT NULL,
    CONSTRAINT "Ronda_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "Partida" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Ronda_partidaId_numero_key" ON "Ronda"("partidaId", "numero");

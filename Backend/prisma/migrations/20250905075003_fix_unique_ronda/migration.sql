/*
  Warnings:

  - The primary key for the `Decision` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `Decision` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `jugadorId` on the `Decision` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `partidaId` on the `Decision` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `rondaId` on the `Decision` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - The primary key for the `Jugador` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `budget` on the `Jugador` table. The data in that column could be lost. The data in that column will be cast from `Float` to `BigInt`.
  - You are about to alter the column `id` on the `Jugador` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `partidaId` on the `Jugador` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - The primary key for the `Partida` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `Partida` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - The primary key for the `ResultadoRonda` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `ResultadoRonda` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `partidaId` on the `ResultadoRonda` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `rondaId` on the `ResultadoRonda` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - The primary key for the `Ronda` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `Ronda` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.
  - You are about to alter the column `partidaId` on the `Ronda` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Decision" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "data" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jugadorId" INTEGER NOT NULL,
    "partidaId" INTEGER NOT NULL,
    "rondaId" INTEGER NOT NULL,
    CONSTRAINT "Decision_jugadorId_fkey" FOREIGN KEY ("jugadorId") REFERENCES "Jugador" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Decision_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "Partida" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Decision_rondaId_fkey" FOREIGN KEY ("rondaId") REFERENCES "Ronda" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Decision" ("createdAt", "data", "id", "jugadorId", "partidaId", "rondaId") SELECT "createdAt", "data", "id", "jugadorId", "partidaId", "rondaId" FROM "Decision";
DROP TABLE "Decision";
ALTER TABLE "new_Decision" RENAME TO "Decision";
CREATE INDEX "Decision_partidaId_idx" ON "Decision"("partidaId");
CREATE INDEX "Decision_rondaId_idx" ON "Decision"("rondaId");
CREATE INDEX "Decision_jugadorId_idx" ON "Decision"("jugadorId");
CREATE TABLE "new_Jugador" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nombre" TEXT NOT NULL,
    "esBot" BOOLEAN NOT NULL DEFAULT false,
    "budget" BIGINT NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partidaId" INTEGER NOT NULL,
    CONSTRAINT "Jugador_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "Partida" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Jugador" ("budget", "createdAt", "esBot", "id", "nombre", "partidaId") SELECT "budget", "createdAt", "esBot", "id", "nombre", "partidaId" FROM "Jugador";
DROP TABLE "Jugador";
ALTER TABLE "new_Jugador" RENAME TO "Jugador";
CREATE INDEX "Jugador_partidaId_idx" ON "Jugador"("partidaId");
CREATE UNIQUE INDEX "Jugador_partidaId_nombre_key" ON "Jugador"("partidaId", "nombre");
CREATE TABLE "new_Partida" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "codigo" TEXT NOT NULL,
    "estado" TEXT NOT NULL,
    "rondaActual" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Partida" ("codigo", "createdAt", "estado", "id", "rondaActual") SELECT "codigo", "createdAt", "estado", "id", "rondaActual" FROM "Partida";
DROP TABLE "Partida";
ALTER TABLE "new_Partida" RENAME TO "Partida";
CREATE UNIQUE INDEX "Partida_codigo_key" ON "Partida"("codigo");
CREATE TABLE "new_ResultadoRonda" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "data" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partidaId" INTEGER NOT NULL,
    "rondaId" INTEGER NOT NULL,
    CONSTRAINT "ResultadoRonda_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "Partida" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ResultadoRonda_rondaId_fkey" FOREIGN KEY ("rondaId") REFERENCES "Ronda" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ResultadoRonda" ("createdAt", "data", "id", "partidaId", "rondaId") SELECT "createdAt", "data", "id", "partidaId", "rondaId" FROM "ResultadoRonda";
DROP TABLE "ResultadoRonda";
ALTER TABLE "new_ResultadoRonda" RENAME TO "ResultadoRonda";
CREATE UNIQUE INDEX "ResultadoRonda_rondaId_key" ON "ResultadoRonda"("rondaId");
CREATE INDEX "ResultadoRonda_partidaId_idx" ON "ResultadoRonda"("partidaId");
CREATE INDEX "ResultadoRonda_rondaId_idx" ON "ResultadoRonda"("rondaId");
CREATE UNIQUE INDEX "ResultadoRonda_partidaId_rondaId_key" ON "ResultadoRonda"("partidaId", "rondaId");
CREATE TABLE "new_Ronda" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "numero" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "partidaId" INTEGER NOT NULL,
    CONSTRAINT "Ronda_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "Partida" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Ronda" ("createdAt", "id", "numero", "partidaId") SELECT "createdAt", "id", "numero", "partidaId" FROM "Ronda";
DROP TABLE "Ronda";
ALTER TABLE "new_Ronda" RENAME TO "Ronda";
CREATE INDEX "Ronda_partidaId_idx" ON "Ronda"("partidaId");
CREATE UNIQUE INDEX "Ronda_partidaId_numero_key" ON "Ronda"("partidaId", "numero");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

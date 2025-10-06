-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionEvent" (
    "id" SERIAL NOT NULL,
    "level" INTEGER NOT NULL,
    "time" TEXT NOT NULL,
    "pid" INTEGER NOT NULL,
    "hostname" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source_channel" TEXT,
    "source_number" TEXT,
    "queue" TEXT,
    "dest_channel" TEXT,
    "dest_number" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "duration" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "incommingfileUrl" TEXT,
    "outgoingfileUrl" TEXT,
    "msg" TEXT NOT NULL,
    "transcription" JSONB,
    "explanation" TEXT,
    "category" TEXT,
    "topic" JSONB,
    "emotion" TEXT,
    "keyWords" TEXT[],
    "routinCheckStart" TEXT,
    "routinCheckEnd" TEXT,
    "forbiddenWords" JSONB,

    CONSTRAINT "SessionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

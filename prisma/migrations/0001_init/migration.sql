-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TipoTarifa" AS ENUM ('POR_PAQUETE', 'POR_DIA', 'FIJO_MAS_VARIABLE');

-- CreateEnum
CREATE TYPE "EstadoMes" AS ENUM ('ABIERTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "EstadoRegistro" AS ENUM ('ok', 'dudoso', 'error');

-- CreateEnum
CREATE TYPE "EstadoImportacion" AS ENUM ('PENDIENTE', 'PROCESADA', 'ERROR');

-- CreateTable
CREATE TABLE "empresas" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "remitente_dueno" TEXT,
    "dias_laborables" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5, 6]::INTEGER[],
    "creada_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repartidores" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "alias_whatsapp" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tipo_tarifa" "TipoTarifa" NOT NULL DEFAULT 'POR_PAQUETE',
    "tarifa_paquete" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "tarifa_dia" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "tarifa_fija" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "repartidores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meses" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "anio_mes" TEXT NOT NULL,
    "estado" "EstadoMes" NOT NULL DEFAULT 'ABIERTO',

    CONSTRAINT "meses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registros_dia" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "repartidor_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "salida" INTEGER,
    "vuelta" INTEGER,
    "estado" "EstadoRegistro" NOT NULL DEFAULT 'ok',
    "nota_ia" TEXT,
    "mensaje_original" TEXT,
    "editado_manual" BOOLEAN NOT NULL DEFAULT false,
    "revisado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "registros_dia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ajustes" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "repartidor_id" INTEGER NOT NULL,
    "mes_id" INTEGER NOT NULL,
    "concepto" TEXT NOT NULL,
    "importe" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ajustes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importaciones" (
    "id" SERIAL NOT NULL,
    "empresa_id" INTEGER NOT NULL,
    "repartidor_id" INTEGER,
    "nombre_archivo" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repartidor_detectado" TEXT,
    "estado" "EstadoImportacion" NOT NULL DEFAULT 'PENDIENTE',
    "error" TEXT,

    CONSTRAINT "importaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "repartidores_empresa_id_idx" ON "repartidores"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "meses_empresa_id_anio_mes_key" ON "meses"("empresa_id", "anio_mes");

-- CreateIndex
CREATE INDEX "registros_dia_empresa_id_idx" ON "registros_dia"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "registros_dia_repartidor_id_fecha_key" ON "registros_dia"("repartidor_id", "fecha");

-- CreateIndex
CREATE INDEX "ajustes_empresa_id_idx" ON "ajustes"("empresa_id");

-- CreateIndex
CREATE INDEX "importaciones_empresa_id_idx" ON "importaciones"("empresa_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repartidores" ADD CONSTRAINT "repartidores_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meses" ADD CONSTRAINT "meses_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registros_dia" ADD CONSTRAINT "registros_dia_repartidor_id_fkey" FOREIGN KEY ("repartidor_id") REFERENCES "repartidores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes" ADD CONSTRAINT "ajustes_repartidor_id_fkey" FOREIGN KEY ("repartidor_id") REFERENCES "repartidores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ajustes" ADD CONSTRAINT "ajustes_mes_id_fkey" FOREIGN KEY ("mes_id") REFERENCES "meses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importaciones" ADD CONSTRAINT "importaciones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importaciones" ADD CONSTRAINT "importaciones_repartidor_id_fkey" FOREIGN KEY ("repartidor_id") REFERENCES "repartidores"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- AlterTable
ALTER TABLE "registros_dia" ADD COLUMN     "entregados" INTEGER,
ADD COLUMN     "motivos" TEXT[] DEFAULT ARRAY[]::TEXT[];

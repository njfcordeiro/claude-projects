-- CreateTable
CREATE TABLE "nucleo_areas" (
    "nucleo_id" INTEGER NOT NULL,
    "area_id" INTEGER NOT NULL,

    CONSTRAINT "nucleo_areas_pkey" PRIMARY KEY ("nucleo_id","area_id")
);

-- AddForeignKey
ALTER TABLE "nucleo_areas" ADD CONSTRAINT "nucleo_areas_nucleo_id_fkey" FOREIGN KEY ("nucleo_id") REFERENCES "nucleos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "nucleo_areas" ADD CONSTRAINT "nucleo_areas_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

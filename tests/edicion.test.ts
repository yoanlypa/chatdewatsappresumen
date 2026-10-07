import { describe, expect, it } from "vitest";
import { recalcularEdicion } from "@/validacion/edicion";

const d = (salida: number | null, vuelta: number | null, entregados: number | null) => ({ salida, vuelta, entregados });

describe("recalcularEdicion", () => {
  it("al editar la vuelta con salida presente, recalcula los entregados", () => {
    expect(recalcularEdicion(d(120, 10, 112), "vuelta")).toMatchObject({ entregados: 110, estado: "ok", motivos: [] });
  });
  it("al editar la salida con vuelta presente, recalcula los entregados", () => {
    expect(recalcularEdicion(d(130, 8, 112), "salida")).toMatchObject({ entregados: 122, estado: "ok" });
  });
  it("al editar los entregados se respetan, aunque no cuadren con salida − vuelta", () => {
    expect(recalcularEdicion(d(120, 8, 100), "entregados")).toMatchObject({ entregados: 100, estado: "ok" });
  });
  it("vuelta mayor que salida → error y sin entregados", () => {
    const r = recalcularEdicion(d(10, 50, null), "vuelta");
    expect(r).toMatchObject({ entregados: null, estado: "error" });
    expect(r.motivos[0]).toMatch(/mayor que la salida/);
  });
  it("entregados mayores que la salida → error", () => {
    expect(recalcularEdicion(d(10, null, 15), "entregados").estado).toBe("error");
  });
  it("sin entregados ni forma de calcularlos → dudoso", () => {
    expect(recalcularEdicion(d(20, null, null), "salida")).toMatchObject({ estado: "dudoso", entregados: null });
  });
  it("solo entregados (sin salida ni vuelta) → ok", () => {
    expect(recalcularEdicion(d(null, null, 27), "entregados")).toMatchObject({ estado: "ok", entregados: 27 });
  });
  it("una edición manual resuelve un día dudoso", () => {
    expect(recalcularEdicion(d(15, 4, null), "vuelta")).toMatchObject({ estado: "ok", entregados: 11 });
  });
});

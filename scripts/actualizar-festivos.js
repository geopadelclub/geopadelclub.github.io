const { createClient } = require("@supabase/supabase-js");

const INE_GRANADA = "18087";
const anoActual = new Date().getFullYear();
const ANOS_A_SINCRONIZAR = [anoActual, anoActual + 1];

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Faltan las variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function obtenerFestivosDeFestivosIo(ano) {
  const url = `https://festivos.io/v1/${ano}/municipio/${INE_GRANADA}.json`;
  console.log(`Obteniendo festivos de ${ano} desde ${url}`);

  const respuesta = await fetch(url);
  if (!respuesta.ok) {
    throw new Error(
      `Error al descargar festivos de ${ano}: ${respuesta.status} ${respuesta.statusText}`,
    );
  }
  const datos = await respuesta.json();

  const listaFestivos = Array.isArray(datos)
    ? datos
    : datos.holidays || datos.festivos || [];

  if (!Array.isArray(listaFestivos) || listaFestivos.length === 0) {
    console.warn(`No se encontraron festivos en la respuesta para ${ano}.`);
    return [];
  }

  return listaFestivos.map((f) => ({
    fecha: f.date,
    nombre: f.name || f.nombre || "Festivo",
    ambito: f.scope || f.ambito || null,
    trasladado: f.transferred || f.trasladado || false,
  }));
}

async function sincronizarFestivos() {
  let todosLosFestivos = [];
  let anosConExito = 0;

  for (const ano of ANOS_A_SINCRONIZAR) {
    try {
      const festivosDelAno = await obtenerFestivosDeFestivosIo(ano);
      if (festivosDelAno.length > 0) {
        console.log(`${festivosDelAno.length} festivos obtenidos para ${ano}`);
        todosLosFestivos = todosLosFestivos.concat(festivosDelAno);
        anosConExito++;
      }
    } catch (error) {
      console.warn(`No se pudo obtener ${ano} (se omite): ${error.message}`);
    }
  }

  if (anosConExito === 0) {
    console.error("No se pudo obtener ningún año. Abortando.");
    process.exit(1);
  }

  console.log(`Subiendo ${todosLosFestivos.length} festivos a Supabase...`);

  const { error } = await supabase
    .from("dias_festivos")
    .upsert(todosLosFestivos, {
      onConflict: "fecha",
      ignoreDuplicates: false,
    });

  if (error) {
    console.error("Error al hacer upsert en Supabase:", error);
    process.exit(1);
  }

  console.log(
    `Sincronización completada: ${todosLosFestivos.length} festivos guardados.`,
  );
}

sincronizarFestivos().catch((error) => {
  console.error("Error inesperado en el script:", error);
  process.exit(1);
});

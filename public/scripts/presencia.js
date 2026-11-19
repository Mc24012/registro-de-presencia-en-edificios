import {
    INTERVALO_PRESENCIA,
    INTERVALO_TABLA
} from "./config.js";
import { solicitarAPI } from "./api.js";
import { mostrarMensaje } from "./mensajes.js";

import { personaId as personaIdActual } from "./estado.js";
import { actualizarTablaPersonas } from "./tabla.js";

let intervaloPresencia = null;
let intervaloActualizacion = null;
let actualizandoPresencia = false;

export async function actualizarPresencia() {
    const personaId = personaIdActual;

    if (personaId === null || actualizandoPresencia) return;

    actualizandoPresencia = true;

    try {
        const persona = await solicitarAPI(
            `/people/${encodeURIComponent(personaId)}`
        );

        if (!persona || persona.id == null) {
            throw new Error("No se encontró el registro actual.");
        }

        const personaActualizada = { lastSeen: new Date().toISOString() };

        await solicitarAPI(
            `/people/${encodeURIComponent(personaId)}`,
            {
                method: "PATCH",
                body: JSON.stringify(personaActualizada)
            }
        );
    } catch (error) {
        mostrarMensaje(
            "No se pudo actualizar la presencia: " + error.message,
            "error"
        );
    } finally {
        actualizandoPresencia = false;
    }
}

export function iniciarActualizaciones() {
    // Latido: solo si no está corriendo (actualizarPresencia ya sale sola si no hay personaId)
    if (intervaloPresencia === null) {
        intervaloPresencia = setInterval(
            actualizarPresencia,
            INTERVALO_PRESENCIA
        );
    }

    // Recarga de tabla: para todos los visitantes, registrados o no
    if (intervaloActualizacion === null) {
        intervaloActualizacion = setInterval(() => {
            actualizarTablaPersonas().catch(() => {});
        }, INTERVALO_TABLA);
    }
}

// Detiene solo el latido; la tabla sigue actualizándose.
export function detenerActualizaciones() {
    if (intervaloPresencia !== null) {
        clearInterval(intervaloPresencia);
        intervaloPresencia = null;
    }
}


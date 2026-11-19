import { obtenerEdificiosLocales, personaId } from './estado.js';
import { edificioPersona } from './dom.js';
import { solicitarAPI } from './api.js';
import { mostrarMensaje } from './mensajes.js';
import { actualizarTablaPersonas } from './tabla.js';
import { mostrarUbicacionPersona, limpiarUbicacionPersona } from './mapa.js';

// Ajustar según el tamaño real de los edificios. No equivale a sus límites físicos.
const RADIO_EDIFICIO_METROS = 25;
const PRECISION_MAXIMA_METROS = 35;
let observador = null;
let ultimaUbicacion = null;
let guardando = false;
let ultimoEdificioGuardado = null;

function distanciaMetros(lat1, lon1, lat2, lon2) {
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function detectarEdificio(posicion) {
    if (posicion.coords.accuracy > PRECISION_MAXIMA_METROS) return undefined;
    const { latitude, longitude } = posicion.coords;
    let cercano = null;
    let distanciaMinima = RADIO_EDIFICIO_METROS;
    for (const edificio of obtenerEdificiosLocales()) {
        const lat = Number(edificio.lat);
        const lng = Number(edificio.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const distancia = distanciaMetros(latitude, longitude, lat, lng);
        if (distancia <= distanciaMinima) {
            cercano = edificio;
            distanciaMinima = distancia;
        }
    }
    return cercano; // null = fuera de edificios; undefined = precisión insuficiente
}

async function procesarPosicion(posicion) {
    ultimaUbicacion = posicion;
    const edificio = detectarEdificio(posicion);
    mostrarUbicacionPersona(posicion.coords.latitude, posicion.coords.longitude, posicion.coords.accuracy);
    if (edificio === undefined) return;
    edificioPersona.value = edificio ? String(edificio.id) : '';
    if (personaId === null || guardando) return;
    const nuevoId = edificio ? String(edificio.id) : null;
    if (nuevoId === ultimoEdificioGuardado) return;
    guardando = true;
    try {
        await solicitarAPI(`/people/${encodeURIComponent(personaId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ buildingId: nuevoId, lastSeen: new Date().toISOString() })
        });
        ultimoEdificioGuardado = nuevoId;
        await actualizarTablaPersonas();
        mostrarMensaje(edificio ? `Ubicación detectada: ${edificio.name}` : 'Estás fuera de los edificios registrados.');
    } catch (error) {
        mostrarMensaje(`No se pudo actualizar el edificio: ${error.message}`, 'error');
    } finally {
        guardando = false;
    }
}

export function iniciarUbicacion() {
    if (observador !== null) return;
    if (!navigator.geolocation) {
        mostrarMensaje('Este navegador no admite geolocalización.', 'error');
        return;
    }
    observador = navigator.geolocation.watchPosition(
        posicion => { procesarPosicion(posicion).catch(console.error); },
        error => mostrarMensaje(`No se pudo detectar la ubicación: ${error.message}`, 'error'),
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );
}

export function detenerUbicacion() {
    if (observador !== null) navigator.geolocation.clearWatch(observador);
    observador = null;
    ultimaUbicacion = null;
    ultimoEdificioGuardado = null;
    limpiarUbicacionPersona();
}

export function establecerEdificioActual(id) {
    ultimoEdificioGuardado = id == null ? null : String(id);
}

export function obtenerEdificioDetectado() {
    if (!ultimaUbicacion) return undefined;
    return detectarEdificio(ultimaUbicacion);
}

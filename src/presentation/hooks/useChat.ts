import { useState, useEffect, useCallback, useRef } from "react";
import { ChatUseCase } from "@/src/domain/useCases/Chat/ChatUseCase";
import { Mensaje } from "@/src/domain/models/Mensaje";

const chatUseCase = new ChatUseCase();

export const useChat = () => {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [usuariosEscribiendo, setUsuariosEscribiendo] = useState<string[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout>(); // ⚠️ CAMBIO 1: Agregué 'useRef' a la importación y a la declaración si faltaba en tu snippet.


  // Cargar mensajes históricos
  const cargarMensajes = useCallback(async () => {
    setCargando(true);
    const mensajesObtenidos = await chatUseCase.obtenerMensajes();
    setMensajes(mensajesObtenidos);
    setCargando(false);
  }, []);

  // Enviar mensaje
  const enviarMensaje = useCallback(async (contenido: string) => {
    if (!contenido.trim()) return { success: false, error: "El mensaje está vacío" };

    setEnviando(true);
    const resultado = await chatUseCase.enviarMensaje(contenido);
    setEnviando(false);

    return resultado;
  }, []);

  // Eliminar mensaje
  const eliminarMensaje = useCallback(async (mensajeId: string) => {
    const resultado = await chatUseCase.eliminarMensaje(mensajeId);
    if (resultado.success) {
      setMensajes(prev => prev.filter(m => m.id !== mensajeId));
    }
    return resultado;
  }, []);

  // ⭐️ CAMBIO 2: Se movió la función `notificarEscribiendo` fuera del `useEffect` para que sea un `useCallback` de nivel superior.
  const notificarEscribiendo = useCallback(() => {
    chatUseCase.actualizarEstadoEscritura(true);

    // Limpiar timeout anterior
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Después de 2 segundos sin escribir, marcar como no escribiendo
    typingTimeoutRef.current = setTimeout(() => {
      chatUseCase.actualizarEstadoEscritura(false);
    }, 2000);
  }, []); // Dependencias vacías.

  // ⭐️ CAMBIO 3: Se eliminó el primer `useEffect` mal cerrado y se mantuvo solo este, que maneja las suscripciones en tiempo real.
  useEffect(() => {
    cargarMensajes();

    const desuscribirMensajes = chatUseCase.suscribirseAMensajes((nuevoMensaje) => {
      setMensajes(prev => {
        if (prev.some(m => m.id === nuevoMensaje.id)) {
          return prev;
        }
        return [...prev, nuevoMensaje];
      });
    });

    // Suscribirse a typing status
    const desuscribirTyping = chatUseCase.suscribirseATypingStatus((usuarios) => {
      setUsuariosEscribiendo(usuarios);
    });

    // Limpiar al desmontar
    return () => {
      desuscribirMensajes();
      desuscribirTyping();
      chatUseCase.actualizarEstadoEscritura(false); // Marcar como no escribiendo
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [cargarMensajes] // Dependencia: para cargar mensajes iniciales
);

  return {
    mensajes,
    cargando,
    enviando,
    enviarMensaje,
    eliminarMensaje,
    recargarMensajes: cargarMensajes,
    usuariosEscribiendo,
    notificarEscribiendo,
  }

}
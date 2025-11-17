import { supabase } from "@/src/data/services/supabaseClient";
import { Mensaje } from "../../models/Mensaje";
import { RealtimeChannel } from "@supabase/supabase-js";


export class ChatUseCase {
  private channel: RealtimeChannel | null = null;
  private typingChannel: RealtimeChannel | null = null; 

  // Obtener mensajes históricos
  async obtenerMensajes(limite: number = 50): Promise<Mensaje[]> {
    try {
      const { data, error } = await supabase
        .from("mensajes")
        .select(`
          *,
          usuarios!fk_usuario(email, rol)
        `)
        .order("created_at", { ascending: false })
        .limit(limite);

      if (error) {
        console.error("Error al obtener mensajes:", error);
        throw error;
      }

      // Mapear la respuesta para que tenga la estructura correcta
      const mensajesFormateados = (data || []).map((msg: any) => ({
        ...msg,
        usuario: msg.usuarios // Renombrar usuarios a usuario
      }));

      // Invertir el orden para mostrar del más antiguo al más reciente
      return mensajesFormateados.reverse() as Mensaje[];
    } catch (error) {
      console.error("Error al obtener mensajes:", error);
      return [];
    }
  }

  // Enviar un nuevo mensaje
  async enviarMensaje(contenido: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: "Usuario no autenticado" };
      }

      const { error } = await supabase
        .from("mensajes")
        .insert({
          contenido,
          usuario_id: user.id,
        });

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error("Error al enviar mensaje:", error);
      return { success: false, error: error.message };
    }
  }

  // Suscribirse a nuevos mensajes en tiempo real
  suscribirseAMensajes(callback: (mensaje: Mensaje) => void) {
    // Crear canal único para esta suscripción
    this.channel = supabase.channel('mensajes-channel');

    this.channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensajes'
        },
        async (payload) => {
          console.log('📨 Nuevo mensaje recibido!', payload.new);

          try {
            // Obtener información completa del mensaje con el usuario
            const { data, error } = await supabase
              .from("mensajes")
              .select(`
                *,
                usuarios!fk_usuario(email, rol)
              `)
              .eq('id', payload.new.id)
              .single();

            if (error) {
              console.error('⚠️ Error al obtener mensaje completo:', error);

              // Fallback: usar los datos del payload si falla el JOIN
              const mensajeFallback: Mensaje = {
                id: payload.new.id,
                contenido: payload.new.contenido,
                usuario_id: payload.new.usuario_id,
                created_at: payload.new.created_at,
                usuario: {
                  email: 'Desconocido',
                  rol: 'usuario'
                }
              };

              console.log('🔄 Usando mensaje fallback');
              callback(mensajeFallback);
              return;
            }

            if (data) {
              // Formatear el mensaje
              const mensajeFormateado: Mensaje = {
                id: data.id,
                contenido: data.contenido,
                usuario_id: data.usuario_id,
                created_at: data.created_at,
                usuario: data.usuarios || { email: 'Desconocido', rol: 'usuario' }
              };

              callback(mensajeFormateado);
            }
          } catch (err) {
            console.error('❌ Error inesperado:', err);

            // Fallback final
            const mensajeFallback: Mensaje = {
              id: payload.new.id,
              contenido: payload.new.contenido,
              usuario_id: payload.new.usuario_id,
              created_at: payload.new.created_at,
              usuario: {
                email: 'Desconocido',
                rol: 'usuario'
              }
            };

            callback(mensajeFallback);
          }
        }
      )
      .subscribe((status) => {
        console.log('Estado de suscripción:', status);
      });

    // Retornar función para desuscribirse
    return () => {
      if (this.channel) {
        supabase.removeChannel(this.channel);
        this.channel = null;
      }
    };
  }

  // Eliminar un mensaje (opcional)
  async eliminarMensaje(mensajeId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from("mensajes")
        .delete()
        .eq('id', mensajeId);

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error("Error al eliminar mensaje:", error);
      return { success: false, error: error.message };
    }
  }

  async actualizarEstadoEscritura(isTyping: boolean): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Obtener email del usuario
      const { data: userData } = await supabase
        .from('usuarios')
        .select('email')
        .eq('id', user.id)
        .single();

      // Upsert en typing_status
      await supabase
        .from('typing_status')
        .upsert({
          usuario_id: user.id,
          usuario_email: userData?.email || 'Usuario',
          is_typing: isTyping,
          updated_at: new Date().toISOString(),
        });

    } catch (error) {
      console.error('Error al actualizar estado de escritura:', error);
    }
  }

  // NUEVO: Suscribirse a cambios en typing status
  suscribirseATypingStatus(callback: (usuarios: string[]) => void) {
    this.typingChannel = supabase.channel('typing-status-channel');

    this.typingChannel
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'typing_status'
        },
        async () => {
          // Obtener todos los usuarios que están escribiendo
          const { data } = await supabase
            .from('typing_status')
            .select('usuario_email, usuario_id')
            .eq('is_typing', true);

          // Filtrar al usuario actual
          const { data: { user } } = await supabase.auth.getUser();
          const usuariosEscribiendo = (data || [])
            .filter(u => u.usuario_id !== user?.id)
            .map(u => u.usuario_email.split('@')[0]); // Solo nombre

          callback(usuariosEscribiendo);
        }
      )
      .subscribe();

    return () => {
      if (this.typingChannel) {
        supabase.removeChannel(this.typingChannel);
        this.typingChannel = null;
      }
    };
  }

}

import React, { useState, useRef, useEffect, useCallback } from "react";
import { // ⚠️ CAMBIO 1: Agregado 'useCallback' a las importaciones si es necesario
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useChat } from "@/src/presentation/hooks/useChat";
import { useAuth } from "@/src/presentation/hooks/useAuth";
import { Mensaje } from "@/src/domain/models/Mensaje";

export default function ChatScreen() {
  const {
    mensajes,
    cargando,
    enviando,
    enviarMensaje,
    usuariosEscribiendo,
    notificarEscribiendo // Función para actualizar el estado de escritura
  } = useChat();
  const { usuario } = useAuth();
  const [textoMensaje, setTextoMensaje] = useState("");
  const flatListRef = useRef<FlatList>(null);


  // Auto-scroll al final cuando llegan nuevos mensajes o se carga
  useEffect(() => {
    if (mensajes.length > 0) {
      // Usamos setTimeout para asegurar que el scroll se ejecute después del render
      // cuando los mensajes son cargados o actualizados.
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [mensajes]);

  // ⭐️ CAMBIO 2: Definición de handleTextoChange para gestionar el input y el estado de escritura.
  const handleTextoChange = useCallback((nuevoTexto) => {
    setTextoMensaje(nuevoTexto);
    notificarEscribiendo(); // Llamar al hook para indicar que el usuario está escribiendo
  }, [notificarEscribiendo]);

  const handleEnviar = async () => {
    if (!textoMensaje.trim() || enviando) return;

    const mensaje = textoMensaje;
    setTextoMensaje(""); // Limpiar input inmediatamente
    // Opcional: Llamar notificarEscribiendo(false) si quieres detener el estado inmediatamente

    const resultado = await enviarMensaje(mensaje);

    if (!resultado.success) {
      alert("Error: " + resultado.error);
      setTextoMensaje(mensaje); // Restaurar mensaje si falló
    }
  };

  const renderMensaje = ({ item }: { item: Mensaje }) => {
    // Nota: Es mejor acceder a `usuario` de forma segura,
    // pero se mantiene el código original aquí para no desviarnos del tema.
    const esMio = item.usuario_id === usuario?.id;
    const emailUsuario = item.usuario?.email || "Usuario desconocido";
    const rolUsuario = item.usuario?.rol || "usuario";

    // Extraer solo el nombre del email (antes del @)
    const nombreCorto = emailUsuario.split('@')[0];

    return (
      <View
        style={[
          styles.mensajeContainer,
          esMio ? styles.mensajeMio : styles.mensajeOtro,
        ]}
      >
        <View style={styles.headerMensaje}>
          <Text style={[
            styles.nombreUsuario,
            esMio && styles.nombreUsuarioMio
          ]}>
            {esMio ? 'Tú' : nombreCorto}
          </Text>

          {/* Badge del rol */}
          <View style={[
            styles.rolBadge,
            rolUsuario === 'admin' && styles.rolBadgeAdmin
          ]}>
            <Text style={styles.rolTexto}>{rolUsuario}</Text>
          </View>
        </View>

        <Text style={[
          styles.contenidoMensaje,
          esMio && styles.contenidoMensajeMio
        ]}>
          {item.contenido}
        </Text>

        <Text style={[
          styles.horaMensaje,
          esMio && styles.horaMensajeMio
        ]}>
          {new Date(item.created_at).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
      </View>
    );
  };

  // ⭐️ CAMBIO 3: Función para filtrar los usuarios que escriben, excluyendo al usuario actual.
  const usuariosEscribiendoFiltrados = usuariosEscribiendo.filter(
    (userId) => userId !== usuario?.id
  );


  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.textoCargando}>Cargando mensajes...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0} // Ajuste el offset
    >
      <FlatList
        ref={flatListRef}
        data={mensajes}
        renderItem={renderMensaje}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        // Se recomienda eliminar onContentSizeChange si usas useEffect para evitar doble scroll innecesario
        // onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      {/* ⭐️ CAMBIO 4: Usar la lista filtrada para el indicador */}
      {usuariosEscribiendoFiltrados.length > 0 && (
        <View style={styles.typingIndicator}>
          <View style={styles.typingDots}>
            {/* Nota: Las animaciones CSS (dot1, dot2, dot3) no funcionan nativamente en React Native.
                Deberías usar Animated API para esto, pero por ahora se mantienen como estilos normales. */}
            <View style={[styles.dot]} />
            <View style={[styles.dot]} />
            <View style={[styles.dot]} />
          </View>
          <Text style={styles.typingText}>
            {usuariosEscribiendoFiltrados.length === 1
              ? `${usuariosEscribiendoFiltrados[0]} está escribiendo...`
              : `${usuariosEscribiendoFiltrados.length} personas están escribiendo...`}
          </Text>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={textoMensaje}
          onChangeText={handleTextoChange} // Ahora usa la función definida
          placeholder="Escribe un mensaje..."
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.botonEnviar,
            (!textoMensaje.trim() || enviando) && styles.botonDeshabilitado,
          ]}
          onPress={handleEnviar}
          disabled={!textoMensaje.trim() || enviando}
        >
          <Text style={styles.textoBotonEnviar}>
            {enviando ? "..." : "Enviar"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ... Los estilos permanecen igual, excepto por la eliminación de las propiedades de animación CSS ...

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  centrado: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  textoCargando: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  listContainer: {
    padding: 16,
  },
  mensajeContainer: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  mensajeMio: {
    alignSelf: "flex-end",
    backgroundColor: "#007AFF",
  },
  mensajeOtro: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  nombreUsuario: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
    marginBottom: 4,
  },
  nombreUsuarioMio: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  contenidoMensaje: {
    fontSize: 16,
    color: "#000",
  },
  contenidoMensajeMio: {
    color: "#FFF",
  },
  horaMensaje: {
    fontSize: 10,
    color: "#999",
    marginTop: 4,
    alignSelf: "flex-end",
  },
  horaMensajeMio: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F5F5F5",
    borderRadius: 20,
    fontSize: 16,
  },
  botonEnviar: {
    marginLeft: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#007AFF",
    borderRadius: 20,
    justifyContent: "center",
  },
  botonDeshabilitado: {
    backgroundColor: "#CCC",
  },
  textoBotonEnviar: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 16,
  },
  headerMensaje: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  rolBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
  },
  rolBadgeAdmin: {
    backgroundColor: '#FFF3E0',
  },
  rolTexto: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4CAF50',
    textTransform: 'uppercase',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F9F9F9',
    gap: 8,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#999',
  },
  // ⚠️ Los estilos de animación dot1, dot2, dot3 se eliminan porque no funcionan en RN
  typingText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
});
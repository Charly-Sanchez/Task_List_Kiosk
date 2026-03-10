# Task List Kiosk

Bienvenido a la aplicación Kiosk, diseñada con una estética futurista (Cyberpunk / Neón) para proyectarse en pantallas de TV a través de *Fully Kiosk Browser* u otros navegadores web, y ser controlada en tiempo real desde un móvil o PC.

## 🚀 ¿Cómo funciona?

Esta aplicación **no requiere una base de datos ni un backend (servidor)**. Todo funciona gracias a la tecnología **WebRTC (PeerJS)**, que permite una conexión **Peer-to-Peer (P2P)**.

1. **La Pantalla (TV)** ingresa a la aplicación web (Modo Pantalla) y genera un ID de conexión único de 4 dígitos (Ej. `TV-1234`) y un código QR.
2. **El Control (Móvil/PC)** ingresa a la aplicación (Modo Control) y digita ese ID o escanea el QR.
3. ¡Boom! Ambos dispositivos se conectan de forma directa, y cada cambio en el panel de control se refleja en la TV instantáneamente.

Al no haber base de datos, si la TV se recarga, perderá los datos. Sin embargo, **el Control Remoto guarda tus tareas en tu navegador (LocalStorage)**. Apenas vuelvas a conectar el control con la TV, la lista de tareas se sincronizará automáticamente a la pantalla.

## 📁 Archivos Principales

- `index.html`: Página principal para elegir el modo de uso.
- `display.html`: Interfaz a pantalla completa diseñada para la TV.
- `controller.html`: Control remoto optimizado para teléfonos móviles.
- `css/styles.css`: Todos los estilos visuales en un solo archivo con variables CSS personalizables.
- `js/display.js`: Código del receptor (TV) para interactuar con PeerJS y modificar el texto/tareas.
- `js/controller.js`: Código del generador de eventos (Control) e interfaz de configuración.

## 💻 Despliegue (Github Pages)

Ya que son puros archivos estáticos (HTML, CSS y JS puro):
1. Sube estos archivos a tu repositorio de GitHub `Charly-Sanchez/Task_List_Kiosk`.
2. En tu repositorio, ve a `Settings` > `Pages`.
3. Selecciona la rama `main` (o `master`) y guarda.
4. Tu Kiosk estará en vivo en: `https://charly-sanchez.github.io/Task_List_Kiosk/`
5. Configura tu TV con ese enlace y disfrútalo.

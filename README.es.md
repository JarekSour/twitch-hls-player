# Twitch HLS Player

[English](README.md) | **Español**

Extensión para navegadores basados en Chromium, como Chrome, Edge y Brave (Manifest V3), que reemplaza el reproductor de Twitch por uno propio basado en [hls.js](https://github.com/video-dev/hls.js) y filtra de la playlist los segmentos de anuncio.

Twitch inserta los anuncios dentro del propio stream, por lo que bloquear dominios no sirve. Esta extensión elimina esos segmentos antes de que lleguen al reproductor.

## Funciones

- Reproduce los canales en directo con hls.js.
- Filtra los segmentos de anuncio de la playlist.
- Selector de calidad, con opción automática.
- Controles al estilo de Twitch: reproducir, volumen, clip, calidad, modo cine y pantalla completa.
- Recuerda la calidad y el volumen entre canales.

## Instalación

1. Descarga o clona este repositorio.
2. Abre la página de extensiones de tu navegador: `chrome://extensions`, `edge://extensions` o `brave://extensions`.
3. Activa el **Modo de desarrollador**.
4. Pulsa **Cargar descomprimida** y elige la carpeta del proyecto.

## Limitaciones

- **La espera del anuncio puede seguir:** no se ve ni se escucha, pero al abrir un canal puede aparecer una pantalla de espera, y los anuncios a mitad de stream congelan el video hasta que acaban.
- **Sin sesión de Twitch:** el stream se pide de forma anónima, así que los canales solo para suscriptores usan el reproductor original, con sus anuncios.
- **Solo directos:** los videos grabados y los clips usan el reproductor original.
- **Clips y modo cine:** dependen del reproductor original de Twitch y pueden fallar o, en el caso de los clips, tomar un momento incorrecto.
- **Fragilidad:** los cambios de Twitch en su reproductor o en sus playlists pueden romper la extensión.

## Privacidad

La extensión no tiene servidor propio ni usa analíticas. Solo se comunica con Twitch, y la calidad y el volumen elegidos se guardan en el navegador.

## Aviso

Proyecto personal sin relación con Twitch ni con Amazon. Twitch es una marca de sus respectivos propietarios. Evitar anuncios puede ir en contra de los términos de uso de la plataforma: úsalo bajo tu propia responsabilidad.

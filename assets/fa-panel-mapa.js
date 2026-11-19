/* Panel del equipo · catálogo humano de las fotos y videos del sitio (única fuente de los textos que ve el equipo).
   Cubre los 34 ids de assets/fa-slots.js. Las páginas van en el mismo orden que el menú público.
   Cada zona: id, pagina, seccion, nombre, donde (frase exacta de dónde se ve), tambien (otro lugar donde se ve la misma foto),
   forma (horizontal / vertical / casi cuadrada / panorámica y proporción real), personas (la foto muestra a una persona),
   aviso (recomendación breve), thumb (original del sitio), pos (encuadre que usa el sitio: object-position). */
(function (root) {
  const Z = (id, seccion, nombre, donde, forma, thumb, pos, extra) => Object.assign({ id, seccion, nombre, donde, forma, thumb, pos: pos || "50% 50%", personas: false, tambien: "", aviso: "" }, extra);
  const H = "Horizontal 16:9", P = "Panorámica 3:1";
  const ZONAS = [
    Z("inicio-portada-foto", "Portada", "Foto de portada", "Primera pantalla de la página de inicio; se ve mientras carga el video y si el video no se puede reproducir", H, "i1-hero-poster-960.webp", "62% 30%", { personas: true, aviso: "Que la persona quede a la derecha y sin nada que le tape la cara." }),
    Z("inicio-portada-video", "Portada", "Video de bienvenida", "Primera pantalla del inicio, sin sonido, al abrir la página", H, "i1-hero-poster-960.webp", "62% 30%", { personas: true, aviso: "Se reproduce sin sonido al abrir la página.", video: "v1-hero-intro" }),
    Z("inicio-curso", "Cursos", "Foto del curso", "Bloque del curso en el inicio (vertical en computador, cuadrada en celular)", "Casi cuadrada 19:20", "i4-curso-v-960.webp", "50% 45%", { aviso: "Deja el centro de la foto despejado: es lo que más se ve." }),
    Z("inicio-taller", "Taller", "Foto del taller", "Bloque del taller en el inicio", "Casi cuadrada 8:7", "i6-taller-d-960.webp", "50% 30%", { personas: true }),
    Z("inicio-final", "Cierre", "Foto de fondo del cierre", "Fondo del último bloque del inicio", H, "i9-cta-960.webp", "60% 50%", { aviso: "Es un fondo: elige una foto con una zona despejada a la izquierda para el texto." }),
    Z("taller-portada", "Portada", "Foto de portada", "Fondo de la parte superior de la página Taller", P, "t1-phead-d-1600.webp", "60% 35%", { personas: true, aviso: "Foto ancha: se recorta arriba y abajo." }),
    Z("taller-servicio-mantencion", "Servicios", "Foto del servicio de carga", "Junto al servicio «Cargas de refrigerante»", H, "p8-servicio-mantencion-ac-960.webp"),
    Z("taller-servicio-diagnostico", "Servicios", "Foto del servicio de diagnóstico", "Junto al servicio «Diagnósticos y mantenimientos»", H, "p9-servicio-diagnostico-960.webp", "50% 50%", { personas: true }),
    Z("taller-foto-principal", "Servicios", "Foto vertical del técnico con la camioneta", "Foto grande a la derecha de la lista de servicios", "Vertical 4:5", "t2-gpic-960.webp", "50% 30%", { personas: true, aviso: "Foto vertical: se ve completa en computador." }),
    Z("taller-nosotros", "Un taller real, con oficio", "Foto ancha del técnico frente a la camioneta", "Foto ancha bajo el título «Un taller real, con oficio»", H, "p2-nosotros-960.webp", "50% 40%", { personas: true }),
    Z("taller-galeria-5", "Un taller real, con oficio › Galería", "Camioneta con mangueras de servicio", "Primera foto de la galería", "Vertical 9:16", "p11-galeria-1-960.webp", "50% 50%", { galeria: 1 }),
    Z("taller-galeria-6", "Un taller real, con oficio › Galería", "Camioneta con manómetros y cilindro", "Segunda foto de la galería", "Vertical 9:16", "p12-galeria-2-960.webp", "50% 50%", { galeria: 2 }),
    Z("taller-galeria-1", "Un taller real, con oficio › Galería", "Conexión al puerto de alta presión", "Tercera foto de la galería (foto grande)", "Horizontal 7:5", "t3-gal-alta-960.webp", "55% 50%", { galeria: 3 }),
    Z("taller-galeria-2", "Un taller real, con oficio › Galería", "Técnico mostrando el manifold", "Cuarta foto de la galería (vertical)", "Vertical 7:10", "t4-gal-vertical-960.webp", "50% 40%", { personas: true, galeria: 4 }),
    Z("taller-galeria-3", "Un taller real, con oficio › Galería", "Acople rápido", "Quinta foto de la galería", "Horizontal 3:2", "t5-gal-acople-960.webp", "50% 45%", { galeria: 5 }),
    Z("taller-galeria-4", "Un taller real, con oficio › Galería", "Lectura de presiones", "Sexta foto de la galería", "Horizontal 3:2", "t6-gal-presiones-960.webp", "50% 40%", { galeria: 6 }),
    Z("taller-equipo", "Nuestro equipo", "Foto del equipo frente al taller", "Foto ancha de la sección «Nuestro equipo»", H, "t7-equipo-960.webp", "50% 50%", { personas: true, aviso: "Que se vean todas las personas completas." }),
    Z("cursos-portada", "Portada", "Foto de portada", "Fondo de la parte superior de la página Cursos", P, "c1-phead-d-1600.webp", "70% 40%", { aviso: "Foto ancha: se recorta arriba y abajo." }),
    Z("cursos-video", "Curso principal", "Video de presentación del curso", "Bloque principal del curso, con botón de reproducir", H, "v2-curso-poster-960.webp", "50% 30%", { personas: true, video: "v2-curso-ac", aviso: "Se reproduce al tocar el botón." }),
    Z("cursos-video-poster", "Curso principal", "Imagen previa del video", "Se ve antes de dar «reproducir»", H, "v2-curso-poster-960.webp", "50% 30%", { personas: true }),
    Z("cursos-puerto-servicio", "Fotos de prácticas del curso", "Puerto de servicio", "Tira de cuatro fotos bajo el curso principal (primera)", H, "p4-curso-puerto-servicio-960.webp"),
    Z("cursos-lectura-presiones", "Fotos de prácticas del curso", "Lectura de presiones", "Tira de cuatro fotos bajo el curso principal (segunda)", H, "p5-curso-lectura-presiones-960.webp"),
    Z("cursos-scanner", "Fotos de prácticas del curso", "Escáner", "Tira de cuatro fotos bajo el curso principal (tercera)", H, "p6-curso-scanner-960.webp"),
    Z("cursos-manguera", "Fotos de prácticas del curso", "Mangueras", "Tira de cuatro fotos bajo el curso principal (cuarta)", H, "p7-curso-manguera-960.webp"),
    Z("cursos-parte2", "Curso profesional", "Foto del curso profesional", "Tarjeta del curso profesional", H, "c3-parte2-960.webp"),
    Z("cursos-manifold", "Qué vas a lograr", "Mangueras del manifold", "Primera de las dos fotos de «Qué vas a lograr»", "Horizontal 4:3", "c4-manifold-960.webp", "50% 50%", { tambien: "Esta foto también se ve en la página Gratis" }),
    Z("cursos-boton-ac", "Qué vas a lograr", "Activación del A/C en el tablero", "Segunda de las dos fotos de «Qué vas a lograr»", "Horizontal 4:3", "c4-boton-ac-960.webp"),
    Z("comunidad-portada", "Portada", "Foto de portada", "Fondo de la parte superior de la página Comunidad", P, "m1-phead-d-1600.webp", "70% 35%", { personas: true, aviso: "Foto ancha: se recorta arriba y abajo." }),
    Z("comunidad-reel-1", "Reels desde el taller", "Reel: técnico trabajando con manómetros", "Primera de las cuatro fotos de «Reels desde el taller»", "Vertical 9:16", "m2-reel-960.webp", "50% 35%", { personas: true }),
    Z("comunidad-reel-2", "Reels desde el taller", "Reel: técnico señalando el manifold", "Segunda de las cuatro fotos de «Reels desde el taller»", "Vertical 9:16", "m3-reel-960.webp", "50% 35%", { personas: true }),
    Z("comunidad-reel-3", "Reels desde el taller", "Reel: técnico con pulgares arriba", "Tercera de las cuatro fotos de «Reels desde el taller»", "Vertical 9:16", "m4-reel-960.webp", "50% 35%", { personas: true }),
    Z("comunidad-reel-4", "Reels desde el taller", "Reel: técnico frente a la camioneta", "Cuarta de las cuatro fotos de «Reels desde el taller»", "Vertical 9:16", "m5-reel-960.webp", "50% 35%", { personas: true }),
    Z("gratis-portada", "Portada", "Foto de portada", "Fondo de la parte superior de la página Gratis", P, "g1-phead-d-1600.webp", "65% 30%", { personas: true, aviso: "Foto ancha: se recorta arriba y abajo." }),
    Z("planes-portada", "Portada", "Foto de portada", "Fondo de la parte superior de la página Suscripción", P, "p1-phead-d-1600.webp", "65% 30%", { personas: true, aviso: "Foto ancha: se recorta arriba y abajo." }),
  ];
  const by = Object.fromEntries(ZONAS.map((z) => [z.id, z]));

  /* Páginas en el orden del menú público, con sus secciones tal como se leen en el sitio. */
  const S = (titulo, ids, extra) => Object.assign({ titulo, ids }, extra);
  const PAGINAS = [
    { slug: "inicio", nombre: "Inicio", href: "index.html", secciones: [
      S("Portada", ["inicio-portada-foto", "inicio-portada-video"], { texto: "«Domina el aire acondicionado automotriz»" }),
      S("Cursos", ["inicio-curso"], { texto: "«Aprende A/C automotriz desde el taller»" }),
      S("Taller", ["inicio-taller"], { texto: "«¿Tu A/C no enfría? Lo dejamos helado.»" }),
      S("Cierre", ["inicio-final"], { texto: "«¿Listo para dominar el A/C automotriz?»" })] },
    { slug: "cursos", nombre: "Cursos", href: "cursos.html", secciones: [
      S("Portada", ["cursos-portada"], { texto: "«Aprende A/C automotriz desde el taller»" }),
      S("Curso principal", ["cursos-video", "cursos-video-poster"], { texto: "«Formación en Aire Acondicionado Automotriz»" }),
      S("Fotos de prácticas del curso", ["cursos-puerto-servicio", "cursos-lectura-presiones", "cursos-scanner", "cursos-manguera"]),
      S("Curso profesional", ["cursos-parte2"]),
      S("Qué vas a lograr", ["cursos-manifold", "cursos-boton-ac"])] },
    { slug: "gratis", nombre: "Gratis", href: "gratis.html", secciones: [
      S("Portada", ["gratis-portada"], { texto: "«Recursos gratis para tu próximo diagnóstico»" }),
      S("Videos gratis", [], { recursos: "videos" }),
      S("Documentos gratis", [], { recursos: "documentos" })] },
    { slug: "taller", nombre: "Taller", href: "taller.html", secciones: [
      S("Portada", ["taller-portada"], { texto: "«Ven sin reserva. Por orden de llegada.»" }),
      S("Servicios", ["taller-servicio-mantencion", "taller-servicio-diagnostico", "taller-foto-principal"]),
      S("Un taller real, con oficio", ["taller-nosotros", "taller-galeria-5", "taller-galeria-6", "taller-galeria-1", "taller-galeria-2", "taller-galeria-3", "taller-galeria-4"], { texto: "Incluye la galería de seis fotos" }),
      S("Nuestro equipo", ["taller-equipo"], { texto: "«Las personas detrás de cada trabajo»" })] },
    { slug: "comunidad", nombre: "Comunidad", href: "comunidad.html", secciones: [
      S("Portada", ["comunidad-portada"], { texto: "«Contenido educativo desde el taller»" }),
      S("Reels desde el taller", ["comunidad-reel-1", "comunidad-reel-2", "comunidad-reel-3", "comunidad-reel-4"])] },
    { slug: "suscripcion", nombre: "Suscripción", href: "planes.html", secciones: [
      S("Portada", ["planes-portada"], { texto: "«Suscríbete para preguntar»" })] },
  ];
  PAGINAS.forEach((p) => { p.ids = p.secciones.flatMap((s) => s.ids); p.ids.forEach((id) => { by[id].pagina = p.slug; }); });

  /* Palabras que el equipo nunca debe ver en pantalla. */
  const PROHIBIDAS = new RegExp("\\b(espacio|slot|bucket|path|token|url firmada|webhook|api|evento|endpoint|storage|json|mrr|hot" + "tok|published|uuid)\\b|PURCHASE_|SUBSCRIPTION_|hot" + "mart", "i");

  const api = { ZONAS, PAGINAS, por: (id) => by[id] || null, pagina: (slug) => PAGINAS.find((p) => p.slug === slug) || null, PROHIBIDAS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FA_PANEL_MAPA = api;
})(typeof window !== "undefined" ? window : globalThis);

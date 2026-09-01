# DESARROLLO Y RECONSTRUCCIÓN DE APLICACIÓN WEB

Quiero que desarrolles y dejes completamente funcional una aplicación web profesional a partir del proyecto/archivo ZIP que te proporcioné.

IMPORTANTE:

El proyecto contiene archivos HTML, JavaScript, recursos y carpetas que se encuentran DISPERSOS en diferentes ubicaciones.

NO debes interpretar los archivos dispersos como proyectos independientes.

TODOS LOS ARCHIVOS FORMAN PARTE DE UNA MISMA APLICACIÓN WEB.

Las carpetas, rutas, HTML, JavaScript, imágenes y demás recursos están relacionados entre sí y deben mantenerse conectados correctamente.

==================================================
# 1. ESTRUCTURA REAL DEL PROYECTO
==================================================

La aplicación tiene ÚNICAMENTE DOS SECCIONES PRINCIPALES:

1. SCFI
2. ASEA

Ambas pertenecen a la MISMA APLICACIÓN.

SCFI y ASEA comparten algunas páginas, componentes, estructuras y funcionalidades.

Sin embargo, cada sección puede tener:

- HTML específicos;
- HTML compartidos;
- funcionalidades particulares;
- diferentes rutas;
- diferentes datos;
- diferentes opciones de navegación.

IMPORTANTE:

NO dupliques innecesariamente funcionalidades o componentes que ya puedan reutilizarse.

Debes identificar qué pertenece a:

SCFI

y qué pertenece a:

ASEA

También debes identificar qué elementos son compartidos entre ambas.

==================================================
# 2. ARCHIVOS DISPERSOS Y RELACIONES
==================================================

Los archivos pueden encontrarse dentro de diferentes carpetas y subcarpetas.

Algunos HTML pueden:

- enlazar a otros HTML;
- abrir otras páginas;
- depender de JavaScript ubicado en otra carpeta;
- utilizar imágenes ubicadas en otra ruta;
- utilizar CSS/Tailwind compartido;
- cargar componentes o recursos externos;
- formar parte de una navegación jerárquica.

IMPORTANTE:

NO muevas archivos únicamente porque estén dispersos.

NO reorganices carpetas sin necesidad.

NO cambies rutas existentes arbitrariamente.

Primero debes comprender las relaciones entre los archivos.

Debes analizar:

- rutas relativas;
- enlaces `<a>`;
- `href`;
- `src`;
- imports;
- scripts;
- formularios;
- navegación;
- referencias entre páginas;
- recursos compartidos.

Si un HTML "vive dentro" de otro flujo de navegación, debes preservar esa relación.

La estructura de carpetas representa parte de la arquitectura funcional del sistema.

==================================================
# 3. RELACIÓN ENTRE HTML
==================================================

Algunos HTML pueden funcionar como páginas principales y otros como páginas secundarias.

Ejemplo conceptual:

SCFI
│
├── dashboard
│   ├── inspecciones
│   ├── solicitudes
│   ├── reportes
│   └── detalle
│
└── otras páginas

ASEA
│
├── dashboard
│   ├── inspecciones
│   ├── solicitudes
│   ├── reportes
│   └── detalle
│
└── otras páginas

ESTO ES SOLO UN EJEMPLO.

Debes descubrir la estructura REAL a partir de los archivos proporcionados.

No inventes rutas.

No inventes páginas.

No asumas que dos HTML con nombres similares son exactamente iguales.

Analiza sus diferencias antes de modificarlos.

==================================================
# 4. HTML COMPARTIDOS ENTRE SCFI Y ASEA
==================================================

Puede haber HTML que existan en ambas secciones.

Si dos páginas son similares:

- compara ambas;
- identifica diferencias;
- determina qué lógica es específica de SCFI;
- determina qué lógica es específica de ASEA;
- determina qué elementos pueden reutilizarse.

NO sobrescribas automáticamente una versión con la otra.

NO elimines una página porque parezca duplicada.

Puede tratarse de una página específica de una sección.

==================================================
# 5. OBJETIVO PRINCIPAL
==================================================

Construye una versión:

- profesional;
- moderna;
- funcional;
- responsive;
- interactiva;
- consistente;
- mantenible.

NO quiero únicamente un rediseño visual.

Quiero que la aplicación tenga FUNCIONALIDAD REAL.

Debes:

- analizar todos los HTML;
- identificar páginas;
- identificar navegación;
- identificar botones;
- identificar formularios;
- identificar tablas;
- identificar gráficas;
- identificar filtros;
- identificar modales;
- identificar componentes;
- identificar JavaScript existente;
- implementar funcionalidades faltantes.

==================================================
# 6. NO ROMPER LA ARQUITECTURA
==================================================

Antes de modificar:

ENTIENDE.

No hagas cambios masivos sin comprender cómo están conectados los archivos.

NO:

- muevas carpetas;
- cambies rutas;
- renombres HTML;
- elimines archivos;
- dupliques páginas;
- cambies arquitectura;

sin una razón técnica clara.

Si una página depende de otra:

mantén esa relación.

Si un JavaScript es compartido:

mantén esa relación.

Si un recurso es utilizado por varias páginas:

no lo dupliques innecesariamente.

==================================================
# 7. TAILWIND CSS
==================================================

El proyecto utiliza TAILWIND CSS.

Tailwind debe ser el sistema principal de estilos.

NO utilices:

- Bootstrap;
- Materialize;
- Bulma;
- otros frameworks CSS.

Si ya existe una configuración de Tailwind:

RESPÉTALA.

No reemplaces la configuración existente innecesariamente.

Prioriza:

- utility classes;
- responsive design;
- transitions;
- animations;
- hover;
- focus;
- active states;
- componentes reutilizables.

==================================================
# 8. JAVASCRIPT
==================================================

Implementa las funcionalidades necesarias utilizando JavaScript moderno.

Utiliza:

- ES6+;
- const / let;
- arrow functions;
- async / await;
- destructuring;
- optional chaining;
- módulos cuando corresponda;
- event listeners;
- funciones reutilizables.

Evita:

- código duplicado;
- funciones innecesariamente grandes;
- lógica repetida;
- listeners duplicados.

Los botones deben funcionar.

Los formularios deben funcionar.

Los filtros deben funcionar.

Los buscadores deben funcionar.

Los modales deben funcionar.

Los dropdowns deben funcionar.

Las tablas deben funcionar.

Las gráficas deben funcionar.

NO dejes botones solamente decorativos.

==================================================
# 9. SCFI Y ASEA
==================================================

Debes mantener claramente separadas las dos secciones:

SCFI

y

ASEA.

Cada sección debe conservar:

- sus páginas;
- su navegación;
- sus funcionalidades;
- sus datos;
- sus diferencias visuales o funcionales cuando existan.

Pero ambas deben sentirse parte de:

UNA MISMA APLICACIÓN.

Si existe funcionalidad compartida:

reutilízala.

Si existe funcionalidad específica:

mantén su comportamiento independiente.

NO mezcles datos de SCFI con ASEA.

NO hagas que una sección dependa innecesariamente de la otra.

==================================================
# 10. DASHBOARDS
==================================================

Los dashboards deben tener apariencia de sistema empresarial profesional.

Utiliza:

- KPI cards;
- métricas;
- gráficas;
- filtros;
- tablas;
- badges;
- indicadores;
- acciones rápidas.

Las tarjetas deben tener:

- jerarquía visual;
- iconos;
- números destacados;
- subtítulos;
- estados;
- hover;
- transiciones.

==================================================
# 11. GRÁFICAS
==================================================

Las gráficas deben tener animaciones profesionales.

Al cargar:

- fade-in;
- crecimiento progresivo;
- animación de líneas;
- animación de barras;
- transición suave.

Al interactuar:

- hover;
- tooltips;
- resaltado;
- transiciones.

Las gráficas deben ser:

- responsive;
- claras;
- profesionales;
- consistentes.

Si ya existe una librería de gráficas:

UTILÍZALA.

No reemplaces una librería existente sin necesidad.

NO exageres las animaciones.

Debe parecer software empresarial, no una página experimental.

==================================================
# 12. ANIMACIONES
==================================================

Agrega microinteracciones profesionales.

Utiliza animaciones para:

- páginas;
- cards;
- botones;
- sidebar;
- modales;
- dropdowns;
- tablas;
- gráficas;
- notificaciones.

Prioriza:

- opacity;
- transform;
- translate;
- scale;
- transition;
- ease-in-out.

Las animaciones deben ser rápidas y elegantes.

==================================================
# 13. SIDEBAR Y NAVEGACIÓN
==================================================

La navegación debe reflejar correctamente:

SCFI

y

ASEA.

Debe existir:

- estado activo;
- hover;
- iconos;
- submenús;
- navegación clara;
- responsive behavior.

Desktop:

→ sidebar visible.

Mobile:

→ sidebar colapsable.

No rompas las rutas existentes.

==================================================
# 14. RESPONSIVE
==================================================

La aplicación debe funcionar en:

- Desktop;
- Laptop;
- Tablet;
- Mobile.

Utiliza Tailwind responsive:

sm:
md:
lg:
xl:
2xl:

Evita:

- overflow horizontal;
- botones fuera de pantalla;
- textos cortados;
- gráficas deformadas;
- tablas inutilizables.

==================================================
# 15. FORMULARIOS
==================================================

Implementa:

- validación;
- estados de error;
- estados de éxito;
- loading;
- disabled;
- feedback visual.

Evita `alert()` cuando exista una alternativa mejor.

Prefiere:

- toast;
- modal;
- mensajes inline.

==================================================
# 16. TABLAS
==================================================

Las tablas deben ser profesionales.

Cuando corresponda:

- búsqueda;
- filtros;
- ordenamiento;
- paginación;
- estados;
- badges;
- acciones;
- hover.

En móvil:

permitir desplazamiento horizontal cuando sea necesario.

==================================================
# 17. MODALES
==================================================

Los modales deben:

- abrir;
- cerrar;
- tener X;
- cerrar con ESC cuando corresponda;
- tener backdrop;
- tener animación;
- bloquear correctamente el fondo.

==================================================
# 18. LOADING
==================================================

Implementa:

- skeleton loaders;
- spinners;
- estados disabled;
- indicadores de carga.

Ejemplo:

Guardar

durante proceso:

Guardando...

==================================================
# 19. NOTIFICACIONES
==================================================

Implementa notificaciones:

- success;
- error;
- warning;
- info.

Con:

- animación;
- iconos;
- cierre manual;
- responsive.

==================================================
# 20. DATOS
==================================================

Si no existe backend:

utiliza datos mock realistas.

No utilices:

- lorem ipsum;
- datos absurdos;
- valores repetidos sin sentido.

Organiza los datos de manera que posteriormente puedan conectarse a una API.

==================================================
# 21. CALIDAD DE CÓDIGO
==================================================

Código:

- limpio;
- modular;
- reutilizable;
- mantenible.

Evita:

- funciones gigantes;
- duplicación;
- código muerto;
- variables sin sentido;
- listeners duplicados.

==================================================
# 22. SEGURIDAD
==================================================

No expongas:

- contraseñas;
- API keys;
- tokens;
- secrets.

No coloques credenciales reales en JavaScript.

==================================================
# 23. CAMBIOS MÍNIMOS
==================================================

No reescribas todo el proyecto.

Modifica únicamente lo necesario.

Si un cambio puede realizarse en 10 líneas:

NO cambies 100.

Preserva el código existente.

NO hagas refactors generales sin autorización.

==================================================
# 24. NO ELIMINAR FUNCIONALIDADES
==================================================

Antes de reemplazar cualquier código:

comprende qué hace.

Si algo funciona:

PRESÉRVALO.

No elimines funcionalidades simplemente porque quieras implementar una versión visualmente diferente.

==================================================
# 25. VERIFICACIÓN
==================================================

Antes de terminar verifica:

[ ] SCFI funciona.

[ ] ASEA funciona.

[ ] La navegación entre páginas funciona.

[ ] Las rutas relativas funcionan.

[ ] Los HTML relacionados siguen conectados.

[ ] Los recursos cargan correctamente.

[ ] Los scripts cargan correctamente.

[ ] Los botones funcionan.

[ ] Los formularios funcionan.

[ ] Los filtros funcionan.

[ ] Las tablas funcionan.

[ ] Los modales funcionan.

[ ] Los dropdowns funcionan.

[ ] Las gráficas funcionan.

[ ] Las gráficas tienen animaciones.

[ ] Responsive funciona.

[ ] No existen errores JavaScript importantes.

[ ] No existen referencias rotas.

[ ] No existen imports inexistentes.

[ ] Tailwind funciona correctamente.

[ ] No se rompieron las diferencias entre SCFI y ASEA.

==================================================
# 26. REGLA CRÍTICA SOBRE EL ZIP
==================================================

El ZIP es la FUENTE DE VERDAD del proyecto.

NO inventes una arquitectura diferente.

NO inventes páginas.

NO inventes rutas.

NO elimines páginas porque parezcan repetidas.

NO asumas que archivos con nombres similares son iguales.

Primero analiza las relaciones reales entre los archivos.

La estructura dispersa del ZIP ES INTENCIONAL.

Los archivos pueden estar separados físicamente pero conectados funcionalmente.

==================================================
# 27. FLUJO DE TRABAJO
==================================================

FASE 1:
Analiza el ZIP completo.

FASE 2:
Identifica todas las carpetas.

FASE 3:
Identifica todos los HTML.

FASE 4:
Identifica los archivos JS.

FASE 5:
Identifica recursos y dependencias.

FASE 6:
Mapea la estructura:

SCFI
ASEA
COMPARTIDO

FASE 7:
Identifica las relaciones entre páginas.

FASE 8:
Identifica funcionalidades existentes.

FASE 9:
Implementa funcionalidades faltantes.

FASE 10:
Mejora la interfaz con Tailwind.

FASE 11:
Agrega animaciones.

FASE 12:
Mejora gráficas.

FASE 13:
Mejora responsive.

FASE 14:
Verifica navegación.

FASE 15:
Verifica SCFI.

FASE 16:
Verifica ASEA.

FASE 17:
Corrige errores.

==================================================
# 28. RESULTADO FINAL
==================================================

El resultado debe sentirse como:

UNA SOLA APLICACIÓN WEB EMPRESARIAL PROFESIONAL

con dos grandes secciones:

SCFI

y

ASEA.

Debe existir coherencia visual y funcional entre ambas.

Los archivos pueden continuar físicamente dispersos en sus respectivas carpetas, pero deben funcionar correctamente como una aplicación integrada.

NO quiero simplemente:

"HTML bonito".

Quiero:

"una aplicación web funcional, moderna, profesional, responsive, interactiva y correctamente conectada".

==================================================
# 29. REGLA FINAL
==================================================

ANALIZA.

ENTIENDE.

CONECTA.

IMPLEMENTA.

MEJORA.

ANIMA.

VERIFICA.

NO HAGAS TRABAJO EXTRA.

NO REESCRIBAS TODO.

NO CAMBIES LA ARQUITECTURA SIN NECESIDAD.

NO ROMPAS LAS RUTAS.

NO MEZCLES SCFI Y ASEA.

NO ELIMINES FUNCIONALIDADES.

NO DEJES BOTONES DECORATIVOS.

NO DEJES FUNCIONES INCOMPLETAS.

NO INVENTES ESTRUCTURAS.

EL ZIP ES LA FUENTE DE VERDAD DEL PROYECTO.
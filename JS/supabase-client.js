(() => {
    'use strict';
    if (window.DB) return;

    // ------------------------------------------------------------------
    // Configuración del proyecto
    // ------------------------------------------------------------------
    const SUPABASE_URL = 'https://vlbyjoqessxcmkejcujp.supabase.co';
    // Supabase → Project Settings → API Keys → "anon public" (o "publishable").
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsYnlqb3Flc3N4Y21rZWpjdWpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMjMzODcsImV4cCI6MjEwMTY5OTM4N30.T8rODqxRoj5HhDmvvDy9LtBBJS-fQZJRFLV3Mn10b_4';
    const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';

    const PERFILES = {
        administrador: 'Administrador',
        gerente: 'Gerente',
        tecnico_verificador: 'Técnico Verificador',
    };

    // Raíz del sitio, calculada desde la ubicación de este archivo (JS/ está un nivel abajo)
    const thisScript = document.currentScript || document.querySelector('script[src*="supabase-client.js"]');
    const ROOT = new URL('../', thisScript ? thisScript.src : window.location.href).href;
    const LOGIN_URL = `${ROOT}login.html`;
    const ES_LOGIN = /\/login\.html$/i.test(window.location.pathname);

    let sb = null;
    let perfil = null;

    // ------------------------------------------------------------------
    // Utilidades
    // ------------------------------------------------------------------
    function cargarSDK() {
        if (window.supabase?.createClient) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = SDK_URL;
            s.onload = resolve;
            s.onerror = () => reject(new Error('No se pudo cargar la librería de Supabase. Revisa tu conexión.'));
            document.head.appendChild(s);
        });
    }

    function irAlLogin(motivo) {
        const actual = window.location.href.startsWith(ROOT) ? window.location.href.slice(ROOT.length) : '';
        const params = new URLSearchParams();
        if (actual && !/^login\.html/i.test(actual)) params.set('next', actual);
        if (motivo) params.set('motivo', motivo);
        const qs = params.toString();
        window.location.replace(qs ? `${LOGIN_URL}?${qs}` : LOGIN_URL);
    }

    function iniciales(texto = '') {
        return texto.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'SU';
    }

    function mensajeError(err) {
        if (!err) return 'Error desconocido.';
        const code = err.code || '';
        if (code === '23505') return 'Ya existe un registro con esos datos (clave, folio o RFC repetido).';
        if (code === '23503') return 'No se puede completar: el registro está ligado a otros datos.';
        if (code === '42501' || /row-level security/i.test(err.message || '')) return 'No tienes permiso para hacer este cambio.';
        if (code === 'PGRST116') return 'No se encontró el registro.';
        if (/Failed to fetch|NetworkError/i.test(err.message || '')) return 'Sin conexión con el servidor. Intenta de nuevo.';
        return err.message || String(err);
    }

    function lanzar(error) {
        const e = new Error(mensajeError(error));
        e.original = error;
        throw e;
    }

    // Pone nombre, iniciales y perfil del usuario en el bloque del sidebar
    function pintarPerfil(p) {
        if (!p) return;
        const nombre = p.nombre_completo || p.nombre || p.correo;
        document.querySelectorAll('[data-profile-trigger]').forEach((el) => {
            const avatar = el.querySelector('.w-10.h-10');
            const nombreEl = el.querySelector('p.text-sm');
            const rolEl = el.querySelector('p.text-xs span:last-child');
            if (avatar) avatar.textContent = iniciales(nombre);
            if (nombreEl) nombreEl.textContent = nombre;
            if (rolEl) rolEl.textContent = PERFILES[p.perfil] || p.perfil;
        });
    }

    // "Mantener la sesión" desmarcado → la sesión muere al cerrar el navegador
    function sesionExpiradaPorNavegador() {
        try {
            return localStorage.getItem('sudi-recordar') === '0' && !sessionStorage.getItem('sudi-sesion-viva');
        } catch (_) {
            return false;
        }
    }

    // ------------------------------------------------------------------
    // Arranque: cliente + guardia de sesión
    // ------------------------------------------------------------------
    const listo = (async () => {
        await cargarSDK();
        sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: { persistSession: true, autoRefreshToken: true, storageKey: 'sudi-auth' },
        });

        if (ES_LOGIN) return null;

        const { data: { session } } = await sb.auth.getSession();
        if (!session || sesionExpiradaPorNavegador()) {
            if (session) await sb.auth.signOut();
            irAlLogin();
            return new Promise(() => {}); // la página se va; no seguimos
        }

        const { data, error } = await sb
            .from('sudi_usuarios')
            .select('*')
            .eq('auth_id', session.user.id)
            .eq('activo', true)
            .maybeSingle();

        if (error) lanzar(error);
        if (!data) {
            await sb.auth.signOut();
            irAlLogin('sin_acceso');
            return new Promise(() => {});
        }

        perfil = data;
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => pintarPerfil(perfil), { once: true });
        } else {
            pintarPerfil(perfil);
        }

        // Si la sesión se cierra en otra pestaña, salir también aquí
        sb.auth.onAuthStateChange((evento) => {
            if (evento === 'SIGNED_OUT') irAlLogin();
        });
        return perfil;
    })();

    listo.catch((err) => {
        console.error('[SUDI] Conexión con Supabase:', err);
        const msg = `No se pudo conectar con la base de datos: ${err.message}`;
        if (window.App?.toast) window.App.toast(msg, 'error', 8000);
    });

    // Cerrar sesión: cualquier enlace a login.html cierra la sesión primero
    if (!ES_LOGIN) {
        document.addEventListener('click', async (e) => {
            const link = e.target.closest('a[href]');
            if (!link || !/login\.html(\?|#|$)/i.test(link.getAttribute('href'))) return;
            e.preventDefault();
            try { await sb?.auth.signOut(); } catch (_) { /* sin red: igual salimos */ }
            try { sessionStorage.removeItem('sudi-sesion-viva'); } catch (_) {}
            window.location.href = LOGIN_URL;
        }, true);
    }

    // ------------------------------------------------------------------
    // API de datos
    // ------------------------------------------------------------------
    async function cliente() {
        await listo;
        return sb;
    }

    /**
     * listar(tabla, opciones)
     *   select:   columnas o relaciones ('*, cliente:sudi_clientes(nombre_comercial)')
     *   filtros:  { columna: valor }  (arreglo → "in")
     *   orden:    'columna' | ['col1', 'col2'];  asc: true/false
     *   limite:   número máximo de filas
     *   consulta: (q) => q.ilike('nombre', '%x%')  para filtros extra
     */
    async function listar(tabla, { select = '*', filtros = {}, orden, asc = true, limite, consulta } = {}) {
        const c = await cliente();
        let q = c.from(tabla).select(select);
        Object.entries(filtros).forEach(([col, val]) => {
            if (val === undefined) return;
            if (Array.isArray(val)) q = q.in(col, val);
            else if (val === null) q = q.is(col, null);
            else q = q.eq(col, val);
        });
        [].concat(orden || []).forEach((col) => { q = q.order(col, { ascending: asc }); });
        if (limite) q = q.limit(limite);
        if (typeof consulta === 'function') q = consulta(q);
        const { data, error } = await q;
        if (error) lanzar(error);
        return data || [];
    }

    async function obtener(tabla, id, select = '*') {
        const c = await cliente();
        const { data, error } = await c.from(tabla).select(select).eq('id', id).single();
        if (error) lanzar(error);
        return data;
    }

    async function crear(tabla, datos) {
        const c = await cliente();
        const multiple = Array.isArray(datos);
        const q = c.from(tabla).insert(datos).select();
        const { data, error } = multiple ? await q : await q.single();
        if (error) lanzar(error);
        return data;
    }

    async function actualizar(tabla, id, cambios) {
        const c = await cliente();
        const { data, error } = await c.from(tabla).update(cambios).eq('id', id).select().single();
        if (error) lanzar(error);
        return data;
    }

    async function eliminar(tabla, id) {
        const c = await cliente();
        const { error, count } = await c.from(tabla).delete({ count: 'exact' }).eq('id', id);
        if (error) lanzar(error);
        if (count === 0) lanzar({ code: '42501' });
        return true;
    }

    async function rpc(funcion, args = {}) {
        const c = await cliente();
        const { data, error } = await c.rpc(funcion, args);
        if (error) lanzar(error);
        return data;
    }

    // Archivos privados (bucket sudi-archivos): devuelve la ruta guardada
    async function subirArchivo(carpeta, archivo) {
        const c = await cliente();
        const limpio = archivo.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '_');
        const ruta = `${carpeta}/${Date.now()}_${limpio}`;
        const { error } = await c.storage.from('sudi-archivos').upload(ruta, archivo, { upsert: false });
        if (error) lanzar(error);
        return ruta;
    }

    async function urlArchivo(ruta, segundos = 3600) {
        const c = await cliente();
        const { data, error } = await c.storage.from('sudi-archivos').createSignedUrl(ruta, segundos);
        if (error) lanzar(error);
        return data.signedUrl;
    }

    const comentarios = {
        listar: (tabla, registroId) => listar('sudi_comentarios', {
            select: 'id, texto, created_at, autor_id, autor:sudi_usuarios(nombre_completo)',
            filtros: { tabla, registro_id: registroId },
            orden: 'created_at',
            asc: false,
        }),
        crear: (tabla, registroId, texto) => crear('sudi_comentarios', {
            tabla, registro_id: registroId, texto, autor_id: perfil?.id,
        }),
        eliminar: (id) => eliminar('sudi_comentarios', id),
    };

    window.DB = {
        listo,
        ROOT,
        get sb() { return sb; },
        get perfil() { return perfil; },
        puedeEditar: () => ['administrador', 'gerente'].includes(perfil?.perfil),
        esAdmin: () => perfil?.perfil === 'administrador',
        cliente,
        listar,
        obtener,
        crear,
        actualizar,
        eliminar,
        rpc,
        siguienteFolio: (serie) => rpc('sudi_siguiente_folio', { p_serie: serie }),
        subirArchivo,
        urlArchivo,
        comentarios,
        mensajeError,
    };

    document.dispatchEvent(new CustomEvent('sudi:db-cargado'));
})();

/**
 * hologramas.js — Pantallas de SCFI → Hologramas conectadas a Supabase.
 *
 * Lo usan las 6 páginas de SCFI/hologramas/:
 *   distintivos.html, flexogramas.html, precintos.html          → SUDIHolo.catalogo({ tipo })
 *   asignar_distintivos.html, asignar_flexogramas.html, asignar_precintos.html → SUDIHolo.asignar({ tipo })
 *
 * Tablas / funciones (supabase/0004_sudi_hologramas.sql):
 *   sudi_scfi_hologramas (un renglón por folio), sudi_scfi_holograma_compras,
 *   vistas sudi_v_hologramas_tipo_estado / sudi_v_hologramas_inspector_tipo,
 *   rpc sudi_scfi_alta_hologramas, _asignar_hologramas, _asignar_rango, _devolver_rango, _eliminar_rango.
 */
(() => {
    'use strict';

    const TIPOS = {
        distintivo: { titulo: 'Distintivos', singular: 'distintivo', icono: 'ph-image', prefijo: '' },
        flexograma: { titulo: 'Flexogramas', singular: 'flexograma', icono: 'ph-seal-check', prefijo: 'U', serie: true },
        inicial:    { titulo: 'Flexogramas iniciales', singular: 'flexograma inicial', icono: 'ph-seal-check', prefijo: 'U', serie: true },
        precinto:   { titulo: 'Precintos', singular: 'precinto', icono: 'ph-lock-key', prefijo: '' },
    };
    const ESTADOS = {
        disponible: { label: 'Disponible', clase: 'text-emerald-400', chip: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
        asignado:   { label: 'Asignado',   clase: 'text-blue-400',    chip: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
        usado:      { label: 'Usado',      clase: 'text-gray-400',    chip: 'bg-gray-500/10 text-gray-300 border-gray-500/30' },
        alto_flujo: { label: 'Alto flujo', clase: 'text-purple-400',  chip: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
        danado:     { label: 'Dañado',     clase: 'text-red-400',     chip: 'bg-red-500/10 text-red-400 border-red-500/30' },
    };
    const HOLO_COLS = 'id, tipo, folio, estado, inspector_id, asignado_en, usado_en, dictamen_ref, fecha_dictamen, notas, nota_adicional, par_folio, compra_id, inspector:sudi_usuarios(nombre_completo)';

    // ---------------------------------------------------------------
    // Utilidades
    // ---------------------------------------------------------------
    const $ = (id) => document.getElementById(id);
    const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const toast = (m, tipo = 'success') => (window.App?.toast ? App.toast(m, tipo) : alert(m));
    const fmtNum = (n) => Number(n || 0).toLocaleString('es-MX');
    const fmtFecha = (v) => (v ? new Date(String(v).length === 10 ? `${v}T12:00:00` : v).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
    const hoy = () => new Date().toISOString().slice(0, 10);

    function fmtFolio(tipo, folio) {
        if (folio === null || folio === undefined || folio === '') return '—';
        return `${TIPOS[tipo]?.prefijo || ''}${String(folio).padStart(5, '0')}`;
    }
    // "U20260220048831", "20260220048831", " 00045 " → número; null si no es válido
    function leerFolio(txt) {
        const d = String(txt ?? '').replace(/\D/g, '');
        if (!d) return null;
        const n = Number(d);
        return Number.isSafeInteger(n) ? n : null;
    }
    // [1,2,3,7,8] → [{del:1, al:3}, {del:7, al:8}]
    function rangos(folios) {
        const out = [];
        [...folios].sort((a, b) => a - b).forEach((f) => {
            const u = out[out.length - 1];
            if (u && f === u.al + 1) u.al = f; else out.push({ del: f, al: f });
        });
        return out;
    }
    function descargarCSV(nombre, encabezados, filas) {
        const celda = (v) => {
            const s = String(v ?? '');
            return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        };
        const csv = [encabezados, ...filas].map((r) => r.map(celda).join(',')).join('\r\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = nombre;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    }

    const IN = 'w-full px-3 py-2 text-sm bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-brand-yellow transition-colors disabled:opacity-60';
    const LB = 'block text-xs text-gray-400 mb-1';
    const BTN = 'px-4 py-2 text-sm rounded-lg font-semibold transition-colors flex items-center gap-2 disabled:opacity-50';

    // Inserta los modales en la página (antes de que app.js los inicialice)
    function modal(id, titulo, icono, cuerpo, ancho = 'max-w-md') {
        const div = document.createElement('div');
        div.innerHTML = `
        <div id="${id}" data-modal="" class="hidden fixed inset-0 z-50 flex items-center justify-center px-4">
            <div class="modal-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
            <div class="modal-panel relative bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full ${ancho} p-6 max-h-[90vh] overflow-y-auto">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-white font-bold text-lg flex items-center gap-2"><i class="ph ${icono} text-brand-yellow"></i> <span data-titulo>${titulo}</span></h3>
                    <button type="button" data-modal-close="" class="text-gray-500 hover:text-white transition-colors"><i class="ph ph-x text-xl"></i></button>
                </div>
                ${cuerpo}
            </div>
        </div>`;
        document.body.appendChild(div.firstElementChild);
    }

    function cargando(el, texto = 'Cargando...') {
        el.innerHTML = `<div class="col-span-full py-16 text-center text-gray-500 text-sm"><i class="ph ph-spinner animate-spin text-lg align-middle"></i> ${esc(texto)}</div>`;
    }

    async function inspectores(DB) {
        let lista = await DB.listar('sudi_usuarios', { select: 'id, nombre_completo, es_inspector', filtros: { activo: true }, orden: 'nombre_completo' });
        const solo = lista.filter((u) => u.es_inspector);
        return solo.length ? solo : lista;
    }

    function selectorSerie(tipo, onCambio) {
        if (!TIPOS[tipo].serie) return '';
        setTimeout(() => {
            document.querySelectorAll('[data-serie]').forEach((b) => b.addEventListener('click', () => onCambio(b.dataset.serie)));
        });
        return `
            <div class="inline-flex bg-dark-800 border border-dark-700 rounded-lg p-1 text-xs font-semibold">
                <button type="button" data-serie="flexograma" class="px-3 py-1.5 rounded-md">Normales</button>
                <button type="button" data-serie="inicial" class="px-3 py-1.5 rounded-md">Iniciales</button>
            </div>`;
    }
    function marcarSerie(tipo) {
        document.querySelectorAll('[data-serie]').forEach((b) => {
            const on = b.dataset.serie === tipo;
            b.classList.toggle('bg-brand-yellow', on);
            b.classList.toggle('text-dark-900', on);
            b.classList.toggle('text-gray-400', !on);
        });
    }

    // ===============================================================
    // 1. CATÁLOGO: distintivos.html / flexogramas.html / precintos.html
    // ===============================================================
    function catalogo({ tipo: tipoInicial, mount = '#holo-app' }) {
        let tipo = tipoInicial;
        const raiz = document.querySelector(mount);
        const POR_PAGINA = 60;
        let DB = null;
        let pagina = 1;
        let total = 0;
        let filtroEstado = '';
        let busqueda = '';
        let filas = [];
        let actual = null;
        let listaInspectores = [];

        raiz.innerHTML = `
            <div class="mb-6 fade-in flex flex-wrap items-center justify-between gap-4">
                <h2 class="text-xl text-gray-300 font-medium"><span id="holo-titulo"></span> con <span id="holo-total" class="text-white font-bold">…</span> registros</h2>
                ${selectorSerie(tipo, (t) => { tipo = t; pagina = 1; filtroEstado = ''; marcarSerie(tipo); recargarTodo(); })}
            </div>
            <div id="holo-chips" class="flex flex-wrap gap-2 mb-6"></div>
            <div id="holo-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3"></div>
            <div class="flex items-center justify-center gap-2 mt-8">
                <button type="button" id="holo-first" class="${BTN} bg-dark-800 border border-dark-700 text-gray-300 hover:bg-dark-700"><i class="ph ph-caret-double-left"></i></button>
                <button type="button" id="holo-prev" class="${BTN} bg-dark-800 border border-dark-700 text-gray-300 hover:bg-dark-700"><i class="ph ph-caret-left"></i></button>
                <span id="holo-pagina" class="text-sm text-gray-400 px-3"></span>
                <button type="button" id="holo-next" class="${BTN} bg-dark-800 border border-dark-700 text-gray-300 hover:bg-dark-700"><i class="ph ph-caret-right"></i></button>
                <button type="button" id="holo-last" class="${BTN} bg-dark-800 border border-dark-700 text-gray-300 hover:bg-dark-700"><i class="ph ph-caret-double-right"></i></button>
            </div>`;

        // ---- Modales ----
        modal('modal-holo-detalle', 'Detalle de folio', TIPOS[tipo].icono, `
            <div id="det-info" class="space-y-2 text-sm mb-4"></div>
            <form id="det-form" class="space-y-3 hidden">
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="${LB}">Estado</label>
                        <select id="det-estado" class="${IN}">${Object.entries(ESTADOS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></div>
                    <div><label class="${LB}">Inspector</label><select id="det-inspector" class="${IN}"></select></div>
                    <div><label class="${LB}">Dictamen</label><input id="det-dictamen" class="${IN}" placeholder="DI-CAL-26-03-582"></div>
                    <div><label class="${LB}">Fecha de dictamen</label><input id="det-fecha-dict" type="date" class="${IN}"></div>
                </div>
                <div><label class="${LB}">Notas</label><textarea id="det-notas" rows="2" class="${IN}"></textarea></div>
                <div class="flex justify-between gap-3 pt-2">
                    <button type="button" id="det-eliminar" class="${BTN} text-red-400 hover:bg-red-500/10"><i class="ph ph-trash"></i> Eliminar</button>
                    <button type="submit" id="det-guardar" class="${BTN} bg-brand-yellow text-dark-900 hover:bg-yellow-400"><i class="ph ph-floppy-disk"></i> Guardar</button>
                </div>
            </form>`);

        modal('modal-holo-alta', 'Alta de folios', 'ph-plus-circle', `
            <form id="alta-form" class="space-y-3">
                <div class="grid grid-cols-2 gap-3">
                    <div id="alta-del-wrap"><label class="${LB}" id="alta-del-label">Folio inicial *</label><input id="alta-del" class="${IN} font-mono" required></div>
                    <div id="alta-al-wrap"><label class="${LB}">Folio final *</label><input id="alta-al" class="${IN} font-mono"></div>
                    <div><label class="${LB}">Fecha de compra</label><input id="alta-fecha" type="date" class="${IN}"></div>
                    <div><label class="${LB}">Factura interna SUDI</label><input id="alta-factura" class="${IN}"></div>
                    <div class="col-span-2"><label class="${LB}">Periodo</label><input id="alta-periodo" class="${IN}" placeholder="2do periodo 2026"></div>
                </div>
                <div><label class="${LB}">Notas (faltantes, dañados, acuse EMA…)</label><textarea id="alta-notas" rows="2" class="${IN}"></textarea></div>
                <p id="alta-resumen" class="text-xs text-brand-yellow"></p>
                <div class="flex justify-end gap-3 pt-2">
                    <button type="button" data-modal-close="" class="${BTN} text-gray-300 hover:bg-dark-700">Cancelar</button>
                    <button type="submit" id="alta-guardar" class="${BTN} bg-brand-yellow text-dark-900 hover:bg-yellow-400"><i class="ph ph-floppy-disk"></i> Dar de alta</button>
                </div>
            </form>`);

        modal('modal-holo-eliminar', 'Eliminar por rango', 'ph-trash', `
            <form id="elim-form" class="space-y-4">
                <p class="text-xs text-gray-400">Solo se eliminan folios <b class="text-emerald-400">disponibles</b>. Los asignados, usados, de alto flujo o dañados no se tocan.</p>
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="${LB}">Folio inicial *</label><input id="elim-del" class="${IN} font-mono" required></div>
                    <div><label class="${LB}">Folio final *</label><input id="elim-al" class="${IN} font-mono" required></div>
                </div>
                <div class="flex justify-end gap-3 pt-2">
                    <button type="button" data-modal-close="" class="${BTN} text-gray-300 hover:bg-dark-700">Cancelar</button>
                    <button type="submit" id="elim-guardar" class="${BTN} text-white bg-red-500 hover:bg-red-600"><i class="ph ph-trash"></i> Eliminar</button>
                </div>
            </form>`);

        // ---- Datos ----
        async function pintarConteos() {
            const conteos = await DB.listar('sudi_v_hologramas_tipo_estado', { filtros: { tipo } });
            const por = Object.fromEntries(conteos.map((c) => [c.estado, c.total]));
            const todos = conteos.reduce((s, c) => s + c.total, 0);
            $('holo-titulo').textContent = `Catálogo de ${TIPOS[tipo].titulo.toLowerCase()}`;
            $('holo-total').textContent = fmtNum(todos);
            const chip = (k, label, n, cls) => `
                <button type="button" data-estado="${k}" class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${filtroEstado === k ? 'ring-2 ring-brand-yellow ' : ''}${cls}">
                    ${label} <span class="opacity-80">(${fmtNum(n)})</span></button>`;
            $('holo-chips').innerHTML = chip('', 'Todos', todos, 'bg-dark-800 text-gray-300 border-dark-700')
                + Object.entries(ESTADOS).map(([k, v]) => chip(k, v.label, por[k] || 0, v.chip)).join('');
        }

        async function idsPorNombre(texto) {
            const { data, error } = await DB.sb.from('sudi_usuarios').select('id').ilike('nombre_completo', `%${texto}%`).limit(50);
            if (error) throw new Error(DB.mensajeError(error));
            return data.map((u) => u.id);
        }

        function consulta(q) {
            q = q.eq('tipo', tipo);
            if (filtroEstado) q = q.eq('estado', filtroEstado);
            return q;
        }

        // OJO: los query builders de Supabase son "thenables"; nunca se regresan desde una
        // función async (se ejecutarían solos). Primero se resuelve el filtro y luego se aplica.
        async function filtroBusqueda() {
            const t = busqueda.trim();
            if (!t) return null;
            const dig = t.replace(/\D/g, '');
            if (dig && /^[uU]?[\d\s-]+$/.test(t)) return { folio: dig };
            return { ids: await idsPorNombre(t.replace(/[%,()]/g, ' ')) };
        }
        function aplicarBusqueda(q, fb) {
            if (!fb) return q;
            if (fb.folio) return q.like('folio_txt', `%${fb.folio}%`);
            return fb.ids.length ? q.in('inspector_id', fb.ids) : q.eq('id', '00000000-0000-0000-0000-000000000000');
        }

        async function cargarPagina() {
            const grid = $('holo-grid');
            cargando(grid, 'Cargando folios...');
            try {
                const fb = await filtroBusqueda();
                const q = aplicarBusqueda(consulta(DB.sb.from('sudi_scfi_hologramas').select(HOLO_COLS, { count: 'exact' })), fb);
                const desde = (pagina - 1) * POR_PAGINA;
                const { data, error, count } = await q.order('folio').range(desde, desde + POR_PAGINA - 1);
                if (error) throw new Error(DB.mensajeError(error));
                filas = data;
                total = count || 0;
                const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
                if (pagina > paginas) { pagina = paginas; return cargarPagina(); }
                grid.innerHTML = filas.length ? filas.map((h, i) => {
                    const e = ESTADOS[h.estado] || ESTADOS.disponible;
                    const quien = h.inspector?.nombre_completo;
                    return `
                    <button type="button" data-i="${i}" class="text-left bg-dark-800 border border-dark-700 rounded-xl p-3 hover:border-brand-yellow/60 transition-colors">
                        <p class="font-mono font-bold text-white text-sm truncate">${esc(fmtFolio(tipo, h.folio))}</p>
                        <p class="text-[11px] ${e.clase} font-semibold mt-1">${e.label}</p>
                        <p class="text-[11px] text-gray-500 truncate">${esc(quien || (h.estado === 'disponible' ? 'En almacén' : '—'))}</p>
                    </button>`;
                }).join('') : `<div class="col-span-full py-16 text-center text-gray-500 text-sm bg-dark-800 border border-dashed border-dark-700 rounded-xl">
                        ${busqueda || filtroEstado ? 'No hay folios con ese filtro.' : `Aún no hay ${TIPOS[tipo].titulo.toLowerCase()} registrados. Usa "Por rango" para darlos de alta.`}</div>`;
                $('holo-pagina').textContent = `Pág. ${pagina} de ${paginas} · ${fmtNum(total)} folios`;
                $('holo-first').disabled = $('holo-prev').disabled = pagina <= 1;
                $('holo-next').disabled = $('holo-last').disabled = pagina >= paginas;
            } catch (err) {
                grid.innerHTML = `<div class="col-span-full py-10 text-center text-red-400 text-sm">${esc(err.message)}</div>`;
            }
        }

        async function recargarTodo() {
            try { await pintarConteos(); } catch (err) { toast(err.message, 'error'); }
            await cargarPagina();
        }

        // ---- Detalle ----
        function abrirDetalle(h) {
            actual = h;
            const e = ESTADOS[h.estado] || ESTADOS.disponible;
            const fila = (k, v) => `<div class="flex justify-between gap-4 bg-dark-900 border border-dark-700 rounded-lg px-4 py-2.5"><span class="text-gray-400">${k}</span><span class="text-white text-right">${v}</span></div>`;
            $('det-info').innerHTML = [
                fila('Folio', `<span class="font-mono font-bold">${esc(fmtFolio(tipo, h.folio))}</span>`),
                fila('Estado', `<span class="${e.clase} font-bold">${e.label}</span>`),
                fila('Inspector', esc(h.inspector?.nombre_completo || '—')),
                fila('Asignado', fmtFecha(h.asignado_en)),
                fila('Dictamen', esc(h.dictamen_ref || '—')),
                fila('Fecha de dictamen', fmtFecha(h.fecha_dictamen)),
                h.par_folio ? fila(tipo === 'distintivo' ? 'Flexograma pareja' : 'Distintivo pareja', `<span class="font-mono">${esc(fmtFolio(tipo === 'distintivo' ? 'flexograma' : 'distintivo', h.par_folio))}</span>`) : '',
                h.notas ? fila('Notas', esc(h.notas)) : '',
            ].join('');
            const edita = DB.puedeEditar();
            $('det-form').classList.toggle('hidden', !edita);
            if (edita) {
                $('det-estado').value = h.estado;
                $('det-inspector').innerHTML = '<option value="">— Sin inspector —</option>' + listaInspectores.map((u) => `<option value="${u.id}">${esc(u.nombre_completo)}</option>`).join('');
                $('det-inspector').value = h.inspector_id || '';
                $('det-dictamen').value = h.dictamen_ref || '';
                $('det-fecha-dict').value = h.fecha_dictamen || '';
                $('det-notas').value = h.notas || '';
                $('det-eliminar').classList.toggle('hidden', h.estado !== 'disponible');
            }
            App.openModal('modal-holo-detalle');
        }

        $('det-form').addEventListener('submit', async (ev) => {
            ev.preventDefault();
            if (!actual) return;
            const estado = $('det-estado').value;
            const inspector = $('det-inspector').value || null;
            if (estado === 'asignado' && !inspector) { toast('Un folio asignado necesita inspector.', 'error'); return; }
            const cambios = {
                estado,
                inspector_id: estado === 'disponible' ? null : inspector,
                dictamen_ref: $('det-dictamen').value.trim() || null,
                fecha_dictamen: $('det-fecha-dict').value || null,
                notas: $('det-notas').value.trim() || null,
            };
            if (estado === 'disponible') cambios.asignado_en = null;
            else if (inspector && inspector !== actual.inspector_id) cambios.asignado_en = new Date().toISOString();
            if (['usado', 'alto_flujo'].includes(estado) && !actual.usado_en) cambios.usado_en = new Date().toISOString();
            if (!['usado', 'alto_flujo'].includes(estado)) cambios.usado_en = null;
            const btn = $('det-guardar');
            btn.disabled = true;
            try {
                await DB.actualizar('sudi_scfi_hologramas', actual.id, cambios);
                App.closeModal('modal-holo-detalle');
                toast(`Folio ${fmtFolio(tipo, actual.folio)} actualizado.`);
                recargarTodo();
            } catch (err) { toast(err.message, 'error'); } finally { btn.disabled = false; }
        });

        $('det-eliminar').addEventListener('click', () => {
            if (!actual) return;
            App.confirmAction({
                title: 'Eliminar folio',
                message: `¿Eliminar el folio ${fmtFolio(tipo, actual.folio)}? Solo se recomienda si se dio de alta por error.`,
                confirmLabel: 'Eliminar',
                onConfirm: async () => {
                    try {
                        await DB.eliminar('sudi_scfi_hologramas', actual.id);
                        App.closeModal('modal-holo-detalle');
                        toast('Folio eliminado.');
                        recargarTodo();
                    } catch (err) { toast(err.message, 'error'); }
                },
            });
        });

        // ---- Alta individual / por rango ----
        let altaRango = true;
        function abrirAlta(rango) {
            altaRango = rango;
            document.querySelector('#modal-holo-alta [data-titulo]').textContent = rango ? `Alta por rango · ${TIPOS[tipo].titulo}` : `Alta individual · ${TIPOS[tipo].titulo}`;
            $('alta-al-wrap').classList.toggle('hidden', !rango);
            $('alta-del-label').textContent = rango ? 'Folio inicial *' : 'Folio *';
            $('alta-form').reset();
            $('alta-fecha').value = hoy();
            $('alta-resumen').textContent = '';
            App.openModal('modal-holo-alta');
        }
        const resumenAlta = () => {
            const del = leerFolio($('alta-del').value);
            const al = altaRango ? leerFolio($('alta-al').value) : del;
            $('alta-resumen').textContent = del !== null && al !== null && al >= del ? `${fmtNum(al - del + 1)} folio(s): ${fmtFolio(tipo, del)} al ${fmtFolio(tipo, al)}` : '';
        };
        $('alta-del').addEventListener('input', resumenAlta);
        $('alta-al').addEventListener('input', resumenAlta);
        $('alta-form').addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const del = leerFolio($('alta-del').value);
            const al = altaRango ? leerFolio($('alta-al').value) : del;
            if (del === null || al === null) { toast('Escribe folios válidos (solo números; la U del flexograma es opcional).', 'error'); return; }
            if (al < del) { toast('El folio final debe ser mayor o igual al inicial.', 'error'); return; }
            const btn = $('alta-guardar');
            btn.disabled = true;
            try {
                const nuevos = await DB.rpc('sudi_scfi_alta_hologramas', {
                    p_tipo: tipo, p_del: del, p_al: al,
                    p_fecha: $('alta-fecha').value || hoy(),
                    p_factura: $('alta-factura').value.trim() || null,
                    p_periodo: $('alta-periodo').value.trim() || null,
                    p_notas: $('alta-notas').value.trim() || null,
                });
                const pedidos = al - del + 1;
                App.closeModal('modal-holo-alta');
                toast(nuevos === pedidos ? `${fmtNum(nuevos)} folio(s) dados de alta.`
                    : `${fmtNum(nuevos)} folio(s) nuevos; ${fmtNum(pedidos - nuevos)} ya existían y no se tocaron.`, nuevos ? 'success' : 'warning');
                recargarTodo();
            } catch (err) { toast(err.message, 'error'); } finally { btn.disabled = false; }
        });

        // ---- Eliminar por rango ----
        $('elim-form').addEventListener('submit', (ev) => {
            ev.preventDefault();
            const del = leerFolio($('elim-del').value);
            const al = leerFolio($('elim-al').value);
            if (del === null || al === null || al < del) { toast('Revisa el rango de folios.', 'error'); return; }
            App.confirmAction({
                title: 'Eliminar rango',
                message: `Se eliminarán los folios disponibles del ${fmtFolio(tipo, del)} al ${fmtFolio(tipo, al)}. ¿Continuar?`,
                confirmLabel: 'Eliminar',
                onConfirm: async () => {
                    try {
                        const n = await DB.rpc('sudi_scfi_eliminar_rango', { p_tipo: tipo, p_del: del, p_al: al });
                        App.closeModal('modal-holo-eliminar');
                        toast(n ? `${fmtNum(n)} folio(s) eliminados.` : 'No había folios disponibles en ese rango.', n ? 'success' : 'warning');
                        recargarTodo();
                    } catch (err) { toast(err.message, 'error'); }
                },
            });
        });

        // ---- Reporte (CSV del filtro actual) ----
        async function reporte(btn) {
            btn.disabled = true;
            try {
                const todas = [];
                const fb = await filtroBusqueda();
                for (let desde = 0; ; desde += 1000) {
                    const q = aplicarBusqueda(consulta(DB.sb.from('sudi_scfi_hologramas').select(HOLO_COLS)), fb);
                    const { data, error } = await q.order('folio').range(desde, desde + 999);
                    if (error) throw new Error(DB.mensajeError(error));
                    todas.push(...data);
                    if (data.length < 1000) break;
                }
                if (!todas.length) { toast('No hay folios para el reporte.', 'warning'); return; }
                descargarCSV(`${tipo}_${filtroEstado || 'todos'}_${hoy()}.csv`,
                    ['Folio', 'Estado', 'Inspector', 'Fecha asignación', 'Dictamen', 'Fecha dictamen', 'Pareja', 'Notas'],
                    todas.map((h) => [fmtFolio(tipo, h.folio), ESTADOS[h.estado]?.label || h.estado, h.inspector?.nombre_completo || '',
                        h.asignado_en ? h.asignado_en.slice(0, 10) : '', h.dictamen_ref || '', h.fecha_dictamen || '',
                        h.par_folio ? fmtFolio(tipo === 'distintivo' ? 'flexograma' : 'distintivo', h.par_folio) : '', h.notas || '']));
                toast(`Reporte con ${fmtNum(todas.length)} folios descargado.`);
            } catch (err) { toast(err.message, 'error'); } finally { btn.disabled = false; }
        }

        // ---- Eventos ----
        $('holo-grid').addEventListener('click', (e) => {
            const b = e.target.closest('[data-i]');
            if (b) abrirDetalle(filas[Number(b.dataset.i)]);
        });
        $('holo-chips').addEventListener('click', (e) => {
            const b = e.target.closest('[data-estado]');
            if (!b) return;
            filtroEstado = b.dataset.estado;
            pagina = 1;
            recargarTodo();
        });
        $('holo-first').addEventListener('click', () => { pagina = 1; cargarPagina(); });
        $('holo-prev').addEventListener('click', () => { pagina -= 1; cargarPagina(); });
        $('holo-next').addEventListener('click', () => { pagina += 1; cargarPagina(); });
        $('holo-last').addEventListener('click', () => { pagina = Math.max(1, Math.ceil(total / POR_PAGINA)); cargarPagina(); });
        let tBus = null;
        $('buscador-folios')?.addEventListener('input', (e) => {
            clearTimeout(tBus);
            tBus = setTimeout(() => { busqueda = e.target.value; pagina = 1; cargarPagina(); }, 350);
        });
        $('btn-alta-individual')?.addEventListener('click', () => abrirAlta(false));
        $('btn-alta-rango')?.addEventListener('click', () => abrirAlta(true));
        $('btn-eliminar-rango')?.addEventListener('click', () => { $('elim-form').reset(); App.openModal('modal-holo-eliminar'); });
        $('btn-reporte')?.addEventListener('click', (e) => reporte(e.currentTarget));

        // ---- Arranque ----
        (async () => {
            try { DB = await App.db(); } catch (err) { cargando($('holo-grid'), err.message); return; }
            if (!DB.puedeEditar()) ['btn-alta-individual', 'btn-alta-rango', 'btn-eliminar-rango'].forEach((id) => $(id)?.classList.add('hidden'));
            marcarSerie(tipo);
            listaInspectores = await inspectores(DB).catch(() => []);
            await recargarTodo();
            let t = null;
            DB.sb.channel(`sudi-holo-cat-${tipo}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'sudi_scfi_hologramas' }, () => {
                    clearTimeout(t);
                    t = setTimeout(recargarTodo, 1500);
                })
                .subscribe();
        })();
    }

    // ===============================================================
    // 2. ASIGNACIÓN: asignar_distintivos / asignar_flexogramas / asignar_precintos
    // ===============================================================
    function asignar({ tipo: tipoInicial, mount = '#holo-app' }) {
        let tipo = tipoInicial;
        const raiz = document.querySelector(mount);
        const POR_PAGINA = 12;
        let DB = null;
        let tarjetas = [];
        let listaInspectores = [];
        let pagina = 1;
        let busqueda = '';
        let actual = null;

        raiz.innerHTML = `
            <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div class="flex flex-wrap gap-3">
                    <div class="bg-dark-800 border border-dark-700 rounded-xl px-5 py-3">
                        <p class="text-xs text-gray-400">Disponibles en almacén</p>
                        <p id="asg-almacen" class="text-2xl font-bold text-emerald-400">…</p>
                    </div>
                    <div class="bg-dark-800 border border-dark-700 rounded-xl px-5 py-3">
                        <p class="text-xs text-gray-400">Siguiente folio a entregar</p>
                        <p id="asg-siguiente" class="text-2xl font-bold text-white font-mono">…</p>
                    </div>
                    <div class="bg-dark-800 border border-dark-700 rounded-xl px-5 py-3">
                        <p class="text-xs text-gray-400">En manos de inspectores</p>
                        <p id="asg-campo" class="text-2xl font-bold text-blue-400">…</p>
                    </div>
                </div>
                ${selectorSerie(tipo, (t) => { tipo = t; pagina = 1; marcarSerie(tipo); cargar(); })}
            </div>
            <div id="asg-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"></div>
            <div class="flex items-center justify-center gap-2 mt-8">
                <button type="button" id="asg-prev" class="${BTN} bg-dark-800 border border-dark-700 text-gray-300 hover:bg-dark-700"><i class="ph ph-caret-left"></i></button>
                <span id="asg-pagina" class="text-sm text-gray-400 px-3"></span>
                <button type="button" id="asg-next" class="${BTN} bg-dark-800 border border-dark-700 text-gray-300 hover:bg-dark-700"><i class="ph ph-caret-right"></i></button>
            </div>`;

        modal('modal-asg-detalle', 'Inspector', 'ph-user', `
            <div id="asgd-metricas" class="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5"></div>
            <h4 class="text-sm font-bold text-white mb-2">Folios por usar (asignados)</h4>
            <div id="asgd-rangos" class="space-y-2"></div>`, 'max-w-2xl');

        modal('modal-asg-asignar', 'Asignar', 'ph-user-plus', `
            <form id="asg-form" class="space-y-3">
                <div><label class="${LB}">Inspector *</label><select id="asg-inspector" class="${IN}" required></select></div>
                <div id="asg-cant-wrap"><label class="${LB}">Cantidad a asignar *</label><input id="asg-cantidad" type="number" min="1" class="${IN}"></div>
                <div id="asg-rango-wrap" class="grid grid-cols-2 gap-3 hidden">
                    <div><label class="${LB}">Folio inicial *</label><input id="asg-del" class="${IN} font-mono"></div>
                    <div><label class="${LB}">Folio final *</label><input id="asg-al" class="${IN} font-mono"></div>
                </div>
                <p id="asg-resumen" class="text-xs text-brand-yellow"></p>
                <div class="flex justify-end gap-3 pt-2">
                    <button type="button" data-modal-close="" class="${BTN} text-gray-300 hover:bg-dark-700">Cancelar</button>
                    <button type="submit" id="asg-guardar" class="${BTN} bg-brand-yellow text-dark-900 hover:bg-yellow-400"><i class="ph ph-check"></i> Asignar</button>
                </div>
            </form>`);

        let disponibles = 0;
        let siguiente = null;

        async function cargar() {
            const grid = $('asg-grid');
            cargando(grid, 'Cargando inspectores...');
            try {
                const [stats, conteos, sig] = await Promise.all([
                    DB.listar('sudi_v_hologramas_inspector_tipo', { filtros: { tipo } }),
                    DB.listar('sudi_v_hologramas_tipo_estado', { filtros: { tipo } }),
                    DB.listar('sudi_scfi_hologramas', { select: 'folio', filtros: { tipo, estado: 'disponible' }, orden: 'folio', limite: 1 }),
                ]);
                const por = Object.fromEntries(conteos.map((c) => [c.estado, c.total]));
                disponibles = por.disponible || 0;
                siguiente = sig[0]?.folio ?? null;
                $('asg-almacen').textContent = fmtNum(disponibles);
                $('asg-siguiente').textContent = siguiente === null ? '—' : fmtFolio(tipo, siguiente);
                $('asg-campo').textContent = fmtNum(por.asignado || 0);
                // Inspectores sin folios también aparecen (con ceros) para poder asignarles
                const vistos = new Set(stats.map((s) => s.inspector_id));
                tarjetas = [...stats, ...listaInspectores.filter((u) => !vistos.has(u.id)).map((u) => ({
                    inspector_id: u.id, inspector: u.nombre_completo, asignados: 0, disponibles: 0, usados: 0, alto_flujo: 0, danados: 0,
                }))].sort((a, b) => b.disponibles - a.disponibles || b.asignados - a.asignados || a.inspector.localeCompare(b.inspector, 'es'));
                pintar();
            } catch (err) {
                grid.innerHTML = `<div class="col-span-full py-10 text-center text-red-400 text-sm">${esc(err.message)}</div>`;
            }
        }

        function filtradas() {
            const t = busqueda.trim().toLowerCase();
            return t ? tarjetas.filter((x) => x.inspector.toLowerCase().includes(t)) : tarjetas;
        }

        function pintar() {
            const lista = filtradas();
            const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
            pagina = Math.min(Math.max(1, pagina), paginas);
            const vis = lista.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
            const met = (label, n, cls) => `<div class="flex justify-between text-sm"><span class="text-gray-400">${label}</span><span class="font-bold ${cls}">${fmtNum(n)}</span></div>`;
            $('asg-grid').innerHTML = vis.length ? vis.map((s) => `
                <button type="button" data-insp="${esc(s.inspector_id)}" class="text-left bg-dark-800 border border-dark-700 rounded-2xl p-5 hover:border-brand-yellow/60 transition-colors">
                    <p class="text-white font-bold mb-3 truncate">${esc(s.inspector)}</p>
                    <div class="space-y-1.5">
                        ${met('Asignados:', s.asignados, 'text-white')}
                        ${met('Disponibles:', s.disponibles, s.disponibles ? 'text-emerald-400' : 'text-gray-500')}
                        ${met('Usados:', s.usados + s.alto_flujo, 'text-gray-300')}
                        ${met('Dañados:', s.danados, s.danados ? 'text-red-400' : 'text-gray-500')}
                    </div>
                </button>`).join('')
                : '<div class="col-span-full py-16 text-center text-gray-500 text-sm bg-dark-800 border border-dashed border-dark-700 rounded-xl">No hay inspectores. Dalos de alta en Catálogos → Usuarios (marcados como inspector).</div>';
            $('asg-pagina').textContent = `Pág. ${pagina} de ${paginas}`;
            $('asg-prev').disabled = pagina <= 1;
            $('asg-next').disabled = pagina >= paginas;
        }

        async function abrirDetalle(id) {
            actual = tarjetas.find((t) => t.inspector_id === id);
            if (!actual) return;
            document.querySelector('#modal-asg-detalle [data-titulo]').textContent = actual.inspector;
            const caja = (l, n, c) => `<div class="bg-dark-900 border border-dark-700 rounded-lg px-3 py-2"><p class="text-[11px] text-gray-400">${l}</p><p class="text-lg font-bold ${c}">${fmtNum(n)}</p></div>`;
            $('asgd-metricas').innerHTML = caja('Asignados', actual.asignados, 'text-white') + caja('Disponibles', actual.disponibles, 'text-emerald-400')
                + caja('Usados', actual.usados, 'text-gray-300') + caja('Alto flujo', actual.alto_flujo, 'text-purple-400') + caja('Dañados', actual.danados, 'text-red-400');
            cargando($('asgd-rangos'), 'Buscando folios...');
            App.openModal('modal-asg-detalle');
            try {
                const folios = [];
                for (let desde = 0; ; desde += 1000) {
                    const { data, error } = await DB.sb.from('sudi_scfi_hologramas').select('folio')
                        .eq('tipo', tipo).eq('estado', 'asignado').eq('inspector_id', id).order('folio').range(desde, desde + 999);
                    if (error) throw new Error(DB.mensajeError(error));
                    folios.push(...data.map((d) => Number(d.folio)));
                    if (data.length < 1000) break;
                }
                const rs = rangos(folios);
                const edita = DB.puedeEditar();
                $('asgd-rangos').innerHTML = rs.length ? rs.map((r) => `
                    <div class="flex items-center justify-between gap-3 bg-dark-900 border border-dark-700 rounded-lg px-4 py-2">
                        <span class="font-mono text-sm text-white">${esc(fmtFolio(tipo, r.del))}${r.al !== r.del ? ` – ${esc(fmtFolio(tipo, r.al))}` : ''}</span>
                        <span class="text-xs text-gray-400">${fmtNum(r.al - r.del + 1)} folio(s)</span>
                        ${edita ? `<button type="button" data-devolver="${r.del}:${r.al}" class="text-xs font-semibold text-amber-400 hover:underline">Devolver al almacén</button>` : ''}
                    </div>`).join('')
                    : '<p class="text-sm text-gray-500 bg-dark-900 border border-dashed border-dark-700 rounded-lg p-4 text-center">No tiene folios pendientes por usar.</p>';
            } catch (err) {
                $('asgd-rangos').innerHTML = `<p class="text-sm text-red-400">${esc(err.message)}</p>`;
            }
        }

        $('asgd-rangos').addEventListener('click', (e) => {
            const b = e.target.closest('[data-devolver]');
            if (!b || !actual) return;
            const [del, al] = b.dataset.devolver.split(':').map(Number);
            App.confirmAction({
                title: 'Devolver folios',
                message: `¿Regresar al almacén los folios ${fmtFolio(tipo, del)}${al !== del ? ` al ${fmtFolio(tipo, al)}` : ''} de ${actual.inspector}?`,
                confirmLabel: 'Devolver',
                danger: false,
                onConfirm: async () => {
                    try {
                        const n = await DB.rpc('sudi_scfi_devolver_rango', { p_tipo: tipo, p_del: del, p_al: al, p_inspector: actual.inspector_id });
                        toast(`${fmtNum(n)} folio(s) devueltos al almacén.`);
                        await cargar();
                        abrirDetalle(actual.inspector_id);
                    } catch (err) { toast(err.message, 'error'); }
                },
            });
        });

        // ---- Asignar ----
        let modoRango = false;
        function abrirAsignar(rango, inspectorId = '') {
            modoRango = rango;
            document.querySelector('#modal-asg-asignar [data-titulo]').textContent = `${rango ? 'Asignar por rango' : 'Asignar'} · ${TIPOS[tipo].titulo}`;
            $('asg-form').reset();
            $('asg-inspector').innerHTML = '<option value="">Selecciona un inspector...</option>' + listaInspectores.map((u) => `<option value="${u.id}">${esc(u.nombre_completo)}</option>`).join('');
            $('asg-inspector').value = inspectorId;
            $('asg-cant-wrap').classList.toggle('hidden', rango);
            $('asg-rango-wrap').classList.toggle('hidden', !rango);
            if (rango && siguiente !== null) $('asg-del').value = fmtFolio(tipo, siguiente);
            resumenAsignar();
            App.openModal('modal-asg-asignar');
        }
        function resumenAsignar() {
            if (modoRango) {
                const del = leerFolio($('asg-del').value), al = leerFolio($('asg-al').value);
                $('asg-resumen').textContent = del !== null && al !== null && al >= del ? `Rango de ${fmtNum(al - del + 1)} folio(s). Solo se toman los que estén disponibles.` : '';
            } else {
                const n = parseInt($('asg-cantidad').value, 10) || 0;
                $('asg-resumen').textContent = siguiente === null ? 'No hay folios disponibles en el almacén.'
                    : `Hay ${fmtNum(disponibles)} disponibles; se entregan los más bajos a partir del ${fmtFolio(tipo, siguiente)}.${n > disponibles ? ' ⚠ No alcanzan.' : ''}`;
            }
        }
        ['asg-cantidad', 'asg-del', 'asg-al'].forEach((id) => $(id).addEventListener('input', resumenAsignar));

        $('asg-form').addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const inspector = $('asg-inspector').value;
            if (!inspector) { toast('Elige un inspector.', 'error'); return; }
            const btn = $('asg-guardar');
            btn.disabled = true;
            try {
                if (modoRango) {
                    const del = leerFolio($('asg-del').value), al = leerFolio($('asg-al').value);
                    if (del === null || al === null || al < del) throw new Error('Revisa el rango de folios.');
                    const n = await DB.rpc('sudi_scfi_asignar_rango', { p_tipo: tipo, p_inspector: inspector, p_del: del, p_al: al });
                    const pedidos = al - del + 1;
                    toast(n === pedidos ? `${fmtNum(n)} folio(s) asignados.` : `${fmtNum(n)} de ${fmtNum(pedidos)} folios asignados; los demás no estaban disponibles.`, n ? 'success' : 'warning');
                } else {
                    const cant = parseInt($('asg-cantidad').value, 10);
                    if (!(cant > 0)) throw new Error('Escribe una cantidad válida.');
                    const r = await DB.rpc('sudi_scfi_asignar_hologramas', { p_tipo: tipo, p_inspector: inspector, p_cantidad: cant });
                    const x = Array.isArray(r) ? r[0] : r;
                    toast(`${fmtNum(x?.asignados)} folio(s) asignados: ${fmtFolio(tipo, x?.folio_del)} al ${fmtFolio(tipo, x?.folio_al)}.`);
                }
                App.closeModal('modal-asg-asignar');
                cargar();
            } catch (err) { toast(err.message, 'error'); } finally { btn.disabled = false; }
        });

        // ---- Reporte ----
        $('btn-reporte')?.addEventListener('click', () => {
            if (!tarjetas.length) { toast('No hay datos para el reporte.', 'warning'); return; }
            descargarCSV(`asignacion_${tipo}_${hoy()}.csv`,
                ['Inspector', 'Asignados', 'Disponibles', 'Usados', 'Alto flujo', 'Dañados', 'Última asignación'],
                tarjetas.map((s) => [s.inspector, s.asignados, s.disponibles, s.usados, s.alto_flujo, s.danados, s.ultima_asignacion ? s.ultima_asignacion.slice(0, 10) : '']));
        });

        // ---- Eventos ----
        $('asg-grid').addEventListener('click', (e) => {
            const b = e.target.closest('[data-insp]');
            if (b) abrirDetalle(b.dataset.insp);
        });
        $('asg-prev').addEventListener('click', () => { pagina -= 1; pintar(); });
        $('asg-next').addEventListener('click', () => { pagina += 1; pintar(); });
        $('buscador-inspectores')?.addEventListener('input', (e) => { busqueda = e.target.value; pagina = 1; pintar(); });
        $('btn-asignar-individual')?.addEventListener('click', () => abrirAsignar(false));
        $('btn-asignar-rango')?.addEventListener('click', () => abrirAsignar(true));

        (async () => {
            try { DB = await App.db(); } catch (err) { cargando($('asg-grid'), err.message); return; }
            if (!DB.puedeEditar()) ['btn-asignar-individual', 'btn-asignar-rango'].forEach((id) => $(id)?.classList.add('hidden'));
            marcarSerie(tipo);
            listaInspectores = await inspectores(DB).catch(() => []);
            await cargar();
            let t = null;
            DB.sb.channel(`sudi-holo-asg-${tipo}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'sudi_scfi_hologramas' }, () => {
                    clearTimeout(t);
                    t = setTimeout(cargar, 1500);
                })
                .subscribe();
        })();
    }


    // ===============================================================
    // 3. COMPRAS: reportes/SCFI/reporte_compras.html
    // ===============================================================
    function compras({ mount = '#holo-app' } = {}) {
        const raiz = document.querySelector(mount);
        const SECCIONES = [
            ['flexograma', 'Flexogramas'], ['inicial', 'Flexogramas iniciales'], ['distintivo', 'Distintivos'],
            ['precinto', 'Precintos'], ['rollo_protector', 'Rollos protectores'],
        ];
        let DB = null;
        let filas = [];
        let actual = null;

        raiz.innerHTML = `<div id="cmp-resumen" class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8"></div><div id="cmp-secciones" class="space-y-8"></div>`;

        modal('modal-cmp', 'Compra', 'ph-shopping-cart', `
            <form id="cmp-form" class="space-y-3">
                <div class="grid grid-cols-2 gap-3">
                    <div class="col-span-2" id="cmp-tipo-wrap"><label class="${LB}">Tipo *</label>
                        <select id="cmp-tipo" class="${IN}">${SECCIONES.map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></div>
                    <div id="cmp-del-wrap"><label class="${LB}">Folio inicial</label><input id="cmp-del" class="${IN} font-mono"></div>
                    <div id="cmp-al-wrap"><label class="${LB}">Folio final</label><input id="cmp-al" class="${IN} font-mono"></div>
                    <div><label class="${LB}">Cantidad</label><input id="cmp-cantidad" type="number" min="0" class="${IN}"></div>
                    <div><label class="${LB}">Fecha de compra *</label><input id="cmp-fecha" type="date" class="${IN}"></div>
                    <div><label class="${LB}">Recepción en oficina</label><input id="cmp-recepcion" type="date" class="${IN}"></div>
                    <div><label class="${LB}">Periodo</label><input id="cmp-periodo" class="${IN}" placeholder="2do periodo"></div>
                    <div><label class="${LB}">Factura interna SUDI</label><input id="cmp-factura" class="${IN}"></div>
                    <div><label class="${LB}">Acuse de recepción (EMA)</label><input id="cmp-acuse" class="${IN}"></div>
                </div>
                <div><label class="${LB}">Notas (faltantes, dañados…)</label><textarea id="cmp-notas" rows="2" class="${IN}"></textarea></div>
                <p id="cmp-aviso" class="text-xs text-gray-400"></p>
                <div class="flex justify-between gap-3 pt-2">
                    <button type="button" id="cmp-eliminar" class="${BTN} text-red-400 hover:bg-red-500/10"><i class="ph ph-trash"></i> Eliminar</button>
                    <div class="flex gap-3">
                        <button type="button" data-modal-close="" class="${BTN} text-gray-300 hover:bg-dark-700">Cancelar</button>
                        <button type="submit" id="cmp-guardar" class="${BTN} bg-brand-yellow text-dark-900 hover:bg-yellow-400"><i class="ph ph-floppy-disk"></i> Guardar</button>
                    </div>
                </div>
            </form>`, 'max-w-xl');

        async function cargar() {
            cargando($('cmp-secciones'), 'Cargando compras...');
            const desde = $('f-desde')?.value, hasta = $('f-hasta')?.value;
            try {
                filas = await DB.listar('sudi_v_hologramas_compras', {
                    orden: 'fecha_compra', asc: false,
                    consulta: (q) => { if (desde) q = q.gte('fecha_compra', desde); if (hasta) q = q.lte('fecha_compra', hasta); return q; },
                });
                pintar();
            } catch (err) {
                $('cmp-secciones').innerHTML = `<p class="text-red-400 text-sm">${esc(err.message)}</p>`;
            }
        }

        function pintar() {
            $('cmp-resumen').innerHTML = SECCIONES.map(([k, l]) => {
                const n = filas.filter((f) => f.tipo === k).reduce((s, f) => s + (f.cantidad || 0), 0);
                return `<div class="bg-dark-800 border border-dark-700 rounded-xl px-4 py-3"><p class="text-xs text-gray-400">${l}</p><p class="text-xl font-bold text-white">${fmtNum(n)}</p></div>`;
            }).join('');
            const th = (t) => `<th class="py-3 px-4 text-xs font-semibold text-gray-400 uppercase whitespace-nowrap">${t}</th>`;
            const td = (v, c = 'text-gray-300') => `<td class="py-3 px-4 text-sm ${c} whitespace-nowrap">${v}</td>`;
            $('cmp-secciones').innerHTML = SECCIONES.map(([k, l]) => {
                const lista = filas.filter((f) => f.tipo === k);
                const conFolios = k !== 'rollo_protector';
                return `
                <section>
                    <h3 class="text-white font-bold text-lg mb-3">${l} <span class="text-sm text-gray-500 font-normal">(${lista.length} compra(s))</span></h3>
                    <div class="bg-dark-800 border border-dark-700 rounded-2xl overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead class="border-b border-dark-700"><tr>
                                ${conFolios ? th('Del folio') + th('Al folio') : ''}${th('Compra')}${th('Recepción')}${th('Cantidad')}
                                ${conFolios ? th('En sistema') + th('Disponibles') + th('Asignados') + th('Usados') + th('Dañados') : ''}
                                ${th('Periodo')}${th('Factura')}${th('Acuse')}${th('Notas')}
                            </tr></thead>
                            <tbody class="divide-y divide-dark-700">
                                ${lista.length ? lista.map((f) => `
                                <tr data-cmp="${esc(f.id)}" class="hover:bg-dark-700/40 cursor-pointer no-clickable">
                                    ${conFolios ? td(esc(fmtFolio(k, f.folio_del)), 'text-white font-mono') + td(esc(fmtFolio(k, f.folio_al)), 'text-white font-mono') : ''}
                                    ${td(fmtFecha(f.fecha_compra))}${td(fmtFecha(f.fecha_recepcion))}${td(fmtNum(f.cantidad), 'text-white font-bold')}
                                    ${conFolios ? td(f.en_sistema === f.cantidad ? fmtNum(f.en_sistema) : `<span class="text-amber-400" title="Diferente a la cantidad comprada">${fmtNum(f.en_sistema)}</span>`)
                                        + td(fmtNum(f.disponibles), 'text-emerald-400') + td(fmtNum(f.asignados), 'text-blue-400') + td(fmtNum(f.usados)) + td(fmtNum(f.danados), f.danados ? 'text-red-400' : 'text-gray-500') : ''}
                                    ${td(esc(f.periodo || '—'))}${td(esc(f.factura_interna || f.factura || '—'))}${td(esc(f.acuse_referencia || '—'))}
                                    <td class="py-3 px-4 text-xs text-gray-400 max-w-xs truncate" title="${esc(f.notas || '')}">${esc(f.notas || '—')}</td>
                                </tr>`).join('') : `<tr class="no-clickable"><td colspan="15" class="py-6 px-4 text-center text-sm text-gray-500">Sin compras en el periodo.</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </section>`;
            }).join('');
        }

        function abrir(f) {
            actual = f || null;
            const nueva = !f;
            document.querySelector('#modal-cmp [data-titulo]').textContent = nueva ? 'Registrar compra' : 'Editar compra';
            $('cmp-form').reset();
            $('cmp-tipo-wrap').classList.toggle('hidden', !nueva);
            $('cmp-tipo').value = f?.tipo || 'rollo_protector';
            $('cmp-del').value = f?.folio_del ? fmtFolio(f.tipo, f.folio_del) : '';
            $('cmp-al').value = f?.folio_al ? fmtFolio(f.tipo, f.folio_al) : '';
            $('cmp-cantidad').value = f?.cantidad ?? '';
            $('cmp-fecha').value = f?.fecha_compra || hoy();
            $('cmp-recepcion').value = f?.fecha_recepcion || '';
            $('cmp-periodo').value = f?.periodo || '';
            $('cmp-factura').value = f?.factura_interna || f?.factura || '';
            $('cmp-acuse').value = f?.acuse_referencia || '';
            $('cmp-notas').value = f?.notas || '';
            ajustar();
            $('cmp-eliminar').classList.toggle('hidden', nueva || (f.en_sistema > 0));
            App.openModal('modal-cmp');
        }
        function ajustar() {
            const nueva = !actual;
            const tipo = $('cmp-tipo').value;
            // Folios: en compras nuevas con folios se dan de alta desde el catálogo; aquí solo rollos o edición
            const conFolios = tipo !== 'rollo_protector';
            $('cmp-del').disabled = $('cmp-al').disabled = !nueva || !conFolios;
            $('cmp-del-wrap').classList.toggle('hidden', !conFolios);
            $('cmp-al-wrap').classList.toggle('hidden', !conFolios);
            $('cmp-cantidad').disabled = conFolios && !nueva;
            $('cmp-aviso').textContent = nueva && conFolios
                ? 'Se darán de alta los folios del rango como disponibles (igual que "Por rango" en el catálogo).'
                : (!nueva && conFolios ? 'El rango de folios no se cambia aquí; para corregirlo usa el catálogo.' : '');
        }
        $('cmp-tipo').addEventListener('change', ajustar);

        $('cmp-form').addEventListener('submit', async (ev) => {
            ev.preventDefault();
            const tipo = actual?.tipo || $('cmp-tipo').value;
            const datos = {
                fecha_compra: $('cmp-fecha').value || hoy(),
                fecha_recepcion: $('cmp-recepcion').value || null,
                periodo: $('cmp-periodo').value.trim() || null,
                factura_interna: $('cmp-factura').value.trim() || null,
                acuse_referencia: $('cmp-acuse').value.trim() || null,
                notas: $('cmp-notas').value.trim() || null,
            };
            const btn = $('cmp-guardar');
            btn.disabled = true;
            try {
                if (actual) {
                    if (tipo === 'rollo_protector') datos.cantidad = Math.max(0, parseInt($('cmp-cantidad').value, 10) || 0);
                    await DB.actualizar('sudi_scfi_holograma_compras', actual.id, datos);
                    toast('Compra actualizada.');
                } else if (tipo === 'rollo_protector') {
                    const cant = parseInt($('cmp-cantidad').value, 10);
                    if (!(cant > 0)) throw new Error('Escribe la cantidad de rollos.');
                    await DB.crear('sudi_scfi_holograma_compras', { tipo, cantidad: cant, ...datos });
                    toast('Compra de rollos registrada.');
                } else {
                    const del = leerFolio($('cmp-del').value), al = leerFolio($('cmp-al').value);
                    if (del === null || al === null || al < del) throw new Error('Revisa el rango de folios.');
                    const n = await DB.rpc('sudi_scfi_alta_hologramas', {
                        p_tipo: tipo, p_del: del, p_al: al, p_fecha: datos.fecha_compra,
                        p_factura: datos.factura_interna, p_periodo: datos.periodo, p_notas: datos.notas,
                    });
                    if (datos.fecha_recepcion || datos.acuse_referencia) {
                        const { data } = await DB.sb.from('sudi_scfi_holograma_compras').select('id')
                            .eq('tipo', tipo).eq('folio_del', del).eq('folio_al', al).order('created_at', { ascending: false }).limit(1);
                        if (data?.[0]) await DB.actualizar('sudi_scfi_holograma_compras', data[0].id,
                            { fecha_recepcion: datos.fecha_recepcion, acuse_referencia: datos.acuse_referencia });
                    }
                    toast(`Compra registrada: ${fmtNum(n)} folio(s) nuevos dados de alta.`);
                }
                App.closeModal('modal-cmp');
                cargar();
            } catch (err) { toast(err.message, 'error'); } finally { btn.disabled = false; }
        });

        $('cmp-eliminar').addEventListener('click', () => {
            if (!actual) return;
            App.confirmAction({
                title: 'Eliminar compra',
                message: 'Solo se puede eliminar una compra sin folios en el sistema. ¿Continuar?',
                confirmLabel: 'Eliminar',
                onConfirm: async () => {
                    try {
                        await DB.eliminar('sudi_scfi_holograma_compras', actual.id);
                        App.closeModal('modal-cmp');
                        toast('Compra eliminada.');
                        cargar();
                    } catch (err) { toast(err.message, 'error'); }
                },
            });
        });

        $('cmp-secciones').addEventListener('click', (e) => {
            const tr = e.target.closest('[data-cmp]');
            if (!tr || !DB?.puedeEditar()) return;
            abrir(filas.find((f) => f.id === tr.dataset.cmp));
        });
        $('btn-nueva-compra')?.addEventListener('click', () => abrir(null));
        $('f-desde')?.addEventListener('change', cargar);
        $('f-hasta')?.addEventListener('change', cargar);
        $('btn-reporte')?.addEventListener('click', () => {
            if (!filas.length) { toast('No hay compras en el periodo.', 'warning'); return; }
            descargarCSV(`compras_hologramas_${hoy()}.csv`,
                ['Tipo', 'Del folio', 'Al folio', 'Fecha compra', 'Recepción', 'Cantidad', 'En sistema', 'Disponibles', 'Asignados', 'Usados', 'Dañados', 'Periodo', 'Factura interna', 'Acuse', 'Notas'],
                filas.map((f) => [SECCIONES.find(([k]) => k === f.tipo)?.[1] || f.tipo, f.folio_del ? fmtFolio(f.tipo, f.folio_del) : '', f.folio_al ? fmtFolio(f.tipo, f.folio_al) : '',
                    f.fecha_compra || '', f.fecha_recepcion || '', f.cantidad ?? '', f.en_sistema, f.disponibles, f.asignados, f.usados, f.danados,
                    f.periodo || '', f.factura_interna || f.factura || '', f.acuse_referencia || '', f.notas || '']));
        });

        (async () => {
            try { DB = await App.db(); } catch (err) { cargando($('cmp-secciones'), err.message); return; }
            if (!DB.puedeEditar()) $('btn-nueva-compra')?.classList.add('hidden');
            await cargar();
        })();
    }

    window.SUDIHolo = { catalogo, asignar, compras, fmtFolio, leerFolio, TIPOS, ESTADOS };

    // Arranque automático: <script src="../../JS/hologramas.js" data-pantalla="catalogo|asignar" data-tipo="distintivo" defer>
    // (corre antes de DOMContentLoaded para que app.js inicialice los modales)
    const yo = document.currentScript;
    if (yo?.dataset.pantalla === 'compras') compras();
    else if (yo?.dataset.pantalla && TIPOS[yo.dataset.tipo]) {
        (yo.dataset.pantalla === 'asignar' ? asignar : catalogo)({ tipo: yo.dataset.tipo });
    }
})();

/**
 * inspecciones.js — SCFI → Inspecciones (SCFI/inspecciones.html) conectada a Supabase.
 * Puntos 12, 17, 18, 19 y 20 (supabase/0006_sudi_inspecciones_scfi.sql):
 *   · Folio automático DI-CAL-AA-ZZ-N / AF-N (rpc sudi_scfi_crear_inspeccion).
 *   · Bitácora (horas, tiempo según norma, BIEN/MAL, quién firma y quién hizo el trabajo).
 *   · Lados con flexograma, distintivo y precinto (rpc sudi_scfi_guardar_lados).
 *   · Evidencias (fotos/videos) y documentos (dictamen, orden de servicio).
 * Usa: JS/app.js (App.*), JS/supabase-client.js (DB.*), JS/hologramas.js (formato de folios).
 */
(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const toast = (m, tipo = 'success') => App.toast(m, tipo);
    const fmtNum = (n) => Number(n || 0).toLocaleString('es-MX');
    const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const fmtFechaLarga = (v) => { if (!v) return '—'; const [a, m, d] = String(v).slice(0, 10).split('-'); return `${Number(d)} de ${MESES[Number(m) - 1]} del ${a}`; };
    const hoy = () => new Date().toISOString().slice(0, 10);
    const hhmm = (t) => (t ? String(t).slice(0, 5) : '');
    const fmtFolio = (tipo, f) => (window.SUDIHolo ? SUDIHolo.fmtFolio(tipo, f) : String(f ?? ''));
    const leerFolio = (t) => { const d = String(t ?? '').replace(/\D/g, ''); return d ? Number(d) : null; };

    const TIPOS = {
        periodica_1: 'Periódica 1er periodo', periodica_2: 'Periódica 2do periodo',
        extraordinaria_1: 'Extraordinaria 1er periodo', extraordinaria_2: 'Extraordinaria 2do periodo', inicial: 'Inicial',
    };
    const ESTATUS = {
        programada: { label: 'Programada', clase: 'bg-blue-500/15 border-blue-500/30 text-blue-400', icono: 'ph-calendar' },
        en_proceso: { label: 'En proceso', clase: 'bg-amber-500/15 border-amber-500/30 text-amber-400', icono: 'ph-timer' },
        terminada:  { label: 'Terminada',  clase: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400', icono: 'ph-check-circle' },
        cancelada:  { label: 'Cancelada',  clase: 'bg-red-500/15 border-red-500/30 text-red-400', icono: 'ph-x-circle' },
    };
    const ETAPAS = [
        ['etapa_visual', 'Verificación visual', 'ph-eye'],
        ['etapa_metrologica', 'Verificación metrológica', 'ph-gas-pump'],
        ['etapa_final', 'Verificación final', 'ph-check'],
        ['etapa_informacion_final', 'Información final', 'ph-list-bullets'],
    ];

    const IN = 'w-full px-3 py-2 text-sm bg-dark-900 border border-dark-700 rounded-lg text-white focus:outline-none focus:border-brand-yellow transition-colors disabled:opacity-60 [color-scheme:dark]';
    const LB = 'block text-xs text-gray-400 mb-1';
    const BTN = 'px-4 py-2 text-sm rounded-lg font-semibold transition-colors inline-flex items-center gap-2 disabled:opacity-50';
    const BTN2 = `${BTN} bg-dark-800 border border-dark-700 text-gray-300 hover:bg-dark-700 hover:text-white`;
    const BTNY = `${BTN} bg-brand-yellow text-dark-900 hover:bg-yellow-400`;

    const POR_PAGINA = 12;
    let DB = null;
    let pagina = 1, total = 0, filas = [];
    let filtros = { estatus: '', inspector: '', desde: '', hasta: '', texto: '' };
    let inspectores = [];
    let actual = null;              // inspección abierta (fila de la vista)
    let lados = [];                 // lados en edición
    let foliosInsp = { flexograma: [], inicial: [], distintivo: [], precinto: [] };

    // ---------------------------------------------------------------
    // Estructura de la página y modales
    // ---------------------------------------------------------------
    function montar() {
        $('insp-app').innerHTML = `
            <div class="flex flex-wrap items-end gap-3 mb-6">
                <div id="insp-chips" class="flex flex-wrap gap-2"></div>
                <div class="flex flex-wrap gap-2 ml-auto">
                    <select id="f-inspector" class="${IN} w-56"><option value="">Todos los inspectores</option></select>
                    <input type="date" id="f-desde" class="${IN} w-40" title="Desde">
                    <input type="date" id="f-hasta" class="${IN} w-40" title="Hasta">
                </div>
            </div>
            <div id="insp-grid" class="grid grid-cols-1 xl:grid-cols-2 gap-6"></div>
            <div class="flex items-center justify-between mt-8 text-sm text-gray-400">
                <span id="insp-mostrando"></span>
                <div class="flex items-center gap-2">
                    <button type="button" id="insp-prev" class="${BTN2}"><i class="ph ph-caret-left"></i></button>
                    <span id="insp-pagina"></span>
                    <button type="button" id="insp-next" class="${BTN2}"><i class="ph ph-caret-right"></i></button>
                </div>
            </div>`;

        modal('modal-insp-nueva', 'Nueva verificación', 'ph-plus-circle', `
            <form id="nv-form" class="space-y-4">
                <div class="relative">
                    <label class="${LB}">Cliente *</label>
                    <input id="nv-cliente-buscar" autocomplete="off" class="${IN}" placeholder="Busca por razón social, nombre comercial o RFC">
                    <div id="nv-cliente-res" class="absolute z-10 left-0 right-0 mt-1 bg-dark-900 border border-dark-700 rounded-lg max-h-56 overflow-y-auto hidden"></div>
                    <p id="nv-cliente-sel" class="text-xs text-brand-yellow mt-1"></p>
                </div>
                <div><label class="${LB}">Estación *</label><select id="nv-estacion" class="${IN}"><option value="">Primero elige el cliente</option></select></div>
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="${LB}">Verificador SUDI (firma) *</label><select id="nv-inspector" class="${IN}"></select></div>
                    <div><label class="${LB}">¿Quién realiza el trabajo?</label><select id="nv-realizo" class="${IN}"></select></div>
                    <div><label class="${LB}">Tipo de inspección *</label><select id="nv-tipo" class="${IN}"><option value="">Selecciona...</option>${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
                    <div><label class="${LB}">Fecha de inspección *</label><input id="nv-fecha" type="date" class="${IN}"></div>
                    <div><label class="${LB}">Zona del folio *</label><select id="nv-zona" class="${IN}"></select></div>
                    <div class="flex items-end"><label class="flex items-center gap-2 text-sm text-gray-300 pb-2"><input id="nv-af" type="checkbox" class="accent-yellow-500 w-4 h-4"> Alto flujo (folio AF)</label></div>
                    <div><label class="${LB}">Mangueras</label><input id="nv-mangueras" type="number" min="0" class="${IN}"></div>
                    <div><label class="${LB}">Precio por manguera</label><input id="nv-precio" type="number" min="0" step="0.01" class="${IN}"></div>
                    <div><label class="${LB}">Viáticos</label><input id="nv-viaticos" type="number" min="0" step="0.01" class="${IN}"></div>
                </div>
                <div><label class="${LB}">Observaciones</label><textarea id="nv-obs" rows="2" class="${IN}"></textarea></div>
                <div class="bg-dark-900 border border-dark-700 rounded-lg px-4 py-3 text-sm flex justify-between"><span class="text-gray-400">Folio que se asignará</span><span id="nv-folio" class="font-mono font-bold text-brand-yellow">—</span></div>
                <div class="flex justify-end gap-3">
                    <button type="button" data-modal-close="" class="${BTN} text-gray-300 hover:bg-dark-700">Cancelar</button>
                    <button type="submit" id="nv-guardar" class="${BTNY}"><i class="ph ph-floppy-disk"></i> Crear verificación</button>
                </div>
            </form>`, 'max-w-2xl');

        modal('modal-insp-detalle', 'Verificación', 'ph-clipboard-text', `
            <div class="flex border-b border-dark-700 mb-5 overflow-x-auto text-sm" id="det-tabs">
                ${[['general', 'General'], ['lados', 'Lados y hologramas'], ['bitacora', 'Bitácora'], ['evidencias', 'Evidencias'], ['documentos', 'Documentos'], ['comentarios', 'Comentarios']]
                    .map(([k, l], i) => `<button type="button" data-tab="${k}" class="px-4 py-2.5 border-b-2 whitespace-nowrap font-semibold ${i ? 'border-transparent text-gray-400' : 'border-brand-yellow text-white'}">${l}</button>`).join('')}
            </div>
            <div id="det-etapas" class="flex flex-wrap gap-2 mb-5"></div>
            <div data-panel="general"></div>
            <div data-panel="lados" class="hidden"></div>
            <div data-panel="bitacora" class="hidden"></div>
            <div data-panel="evidencias" class="hidden"></div>
            <div data-panel="documentos" class="hidden"></div>
            <div data-panel="comentarios" class="hidden"></div>`, 'max-w-6xl');

        modal('modal-insp-consecutivo', 'Consecutivos de folios', 'ph-hash', `
            <p class="text-xs text-gray-400 mb-4">Escribe el <b>último</b> consecutivo usado en el SUDI anterior para que los folios nuevos continúen después de él. No se puede bajar si ya hay folios mayores.</p>
            <form id="cons-form" class="space-y-3">
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="${LB}">Serie</label><select id="cons-serie" class="${IN}"></select></div>
                    <div><label class="${LB}">Último consecutivo</label><input id="cons-ultimo" type="number" min="0" class="${IN}"></div>
                </div>
                <p id="cons-actual" class="text-xs text-brand-yellow"></p>
                <div class="flex justify-end gap-3">
                    <button type="button" data-modal-close="" class="${BTN} text-gray-300 hover:bg-dark-700">Cerrar</button>
                    <button type="submit" class="${BTNY}"><i class="ph ph-floppy-disk"></i> Guardar</button>
                </div>
            </form>`);
    }

    function modal(id, titulo, icono, cuerpo, ancho = 'max-w-md') {
        const div = document.createElement('div');
        div.innerHTML = `
        <div id="${id}" data-modal="" class="hidden fixed inset-0 z-50 flex items-center justify-center px-4">
            <div class="modal-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
            <div class="modal-panel relative bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full ${ancho} p-6 max-h-[92vh] overflow-y-auto">
                <div class="flex items-center justify-between mb-4 gap-4">
                    <h3 class="text-white font-bold text-lg flex items-center gap-2 min-w-0"><i class="ph ${icono} text-brand-yellow"></i> <span data-titulo class="truncate">${titulo}</span></h3>
                    <button type="button" data-modal-close="" class="text-gray-500 hover:text-white transition-colors"><i class="ph ph-x text-xl"></i></button>
                </div>
                ${cuerpo}
            </div>
        </div>`;
        document.body.appendChild(div.firstElementChild);
    }

    const opcionesUsuarios = (vacio) => `<option value="">${vacio}</option>` + inspectores.map((u) => `<option value="${u.id}">${esc(u.nombre_completo)}</option>`).join('');
    const yo = () => DB?.perfil?.id;
    const puedeCapturar = (i) => DB.puedeEditar() || [i?.inspector_id, i?.realizo_id].includes(yo());

    // ---------------------------------------------------------------
    // Listado
    // ---------------------------------------------------------------
    function consulta(q) {
        if (filtros.estatus) q = q.eq('estatus', filtros.estatus);
        if (filtros.inspector) q = q.or(`inspector_id.eq.${filtros.inspector},realizo_id.eq.${filtros.inspector}`);
        if (filtros.desde) q = q.gte('fecha_inspeccion', filtros.desde);
        if (filtros.hasta) q = q.lte('fecha_inspeccion', filtros.hasta);
        const t = filtros.texto.trim().replace(/[,()%*\\]/g, ' ').trim();
        if (t) q = q.or(['folio', 'razon_social', 'cliente_comercial', 'estacion_nombre', 'permiso', 'numero_estacion', 'inspector']
            .map((c) => `${c}.ilike.%${t}%`).join(','));
        return q;
    }

    async function pintarChips() {
        const conteos = await Promise.all(['', ...Object.keys(ESTATUS)].map(async (k) => {
            let q = DB.sb.from('sudi_v_scfi_insp_lista').select('id', { count: 'exact', head: true });
            const f = { ...filtros, estatus: k };
            const prev = filtros; filtros = f; q = consulta(q); filtros = prev;
            const { count } = await q;
            return [k, count || 0];
        }));
        $('insp-chips').innerHTML = conteos.map(([k, n]) => `
            <button type="button" data-estatus="${k}" class="px-3 py-1.5 rounded-lg border text-xs font-semibold ${filtros.estatus === k ? 'ring-2 ring-brand-yellow ' : ''}${k ? ESTATUS[k].clase : 'bg-dark-800 text-gray-300 border-dark-700'}">
                ${k ? ESTATUS[k].label : 'Todas'} <span class="opacity-80">(${fmtNum(n)})</span></button>`).join('');
    }

    function tarjeta(i, idx) {
        const st = ESTATUS[i.estatus] || ESTATUS.programada;
        const etapas = ETAPAS.map(([k, l]) => `<span title="${l}" class="w-2 h-2 rounded-full ${i[k] ? 'bg-emerald-400' : 'bg-dark-600'}"></span>`).join('');
        return `
        <button type="button" data-idx="${idx}" class="text-left bg-dark-800 rounded-xl border border-dark-700 flex flex-col sm:flex-row hover:-translate-y-1 hover:border-brand-yellow/50 transition-all relative group">
            <div class="flex-1 p-6 pl-8 relative min-w-0">
                <div class="absolute left-0 top-0 bottom-0 w-1 ${i.alto_flujo ? 'bg-purple-500' : 'bg-dark-600'} group-hover:bg-brand-yellow transition-colors rounded-l-xl"></div>
                <h3 class="text-lg font-bold text-white mb-2 group-hover:text-brand-yellow transition-colors">Folio: ${esc(i.folio)}</h3>
                <p class="text-[13px] text-gray-300 font-medium mb-1 uppercase tracking-wide truncate">${esc(i.razon_social || i.cliente_comercial || 'Cliente sin nombre')}</p>
                <p class="text-xs text-gray-500 mb-0.5 truncate">Estación: ${esc(i.numero_estacion || i.estacion_nombre || '—')}</p>
                <p class="text-xs text-gray-500 mb-4 truncate">PL: ${esc(i.permiso || '—')}</p>
                <div class="flex flex-wrap items-center gap-2">
                    <span class="text-[11px] font-bold text-blue-400 uppercase tracking-widest inline-flex items-center gap-1 bg-blue-500/10 px-2 py-1 rounded"><i class="ph ph-user text-sm"></i> ${esc(i.inspector || 'Sin inspector')}</span>
                    ${i.realizo && i.realizo !== i.inspector ? `<span class="text-[11px] text-gray-400 inline-flex items-center gap-1"><i class="ph ph-wrench"></i> ${esc(i.realizo)}</span>` : ''}
                    <span class="flex items-center gap-1 ml-1">${etapas}</span>
                </div>
            </div>
            <div class="w-full sm:w-[250px] bg-dark-900/50 p-6 flex flex-col justify-between border-t sm:border-t-0 sm:border-l border-dark-700 rounded-b-xl sm:rounded-bl-none sm:rounded-r-xl">
                <div class="space-y-3 mb-5">
                    <div><p class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Fecha inspección:</p><p class="text-sm text-blue-300 font-medium">${fmtFechaLarga(i.fecha_inspeccion)}</p></div>
                    <div><p class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Tipo de inspección:</p><p class="text-sm text-gray-300 font-medium">${TIPOS[i.tipo] || i.tipo}</p></div>
                    <div><p class="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Facturación:</p><p class="text-sm text-gray-300 font-medium">${i.facturacion === 'facturado' ? `Facturado ${esc(i.factura || '')}` : 'No facturado'}</p></div>
                </div>
                <div class="w-full ${st.clase} border text-center py-2 rounded-lg font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2"><i class="ph ${st.icono} text-lg"></i> ${st.label}</div>
            </div>
        </button>`;
    }

    async function cargar() {
        const grid = $('insp-grid');
        grid.innerHTML = '<div class="col-span-full py-16 text-center text-gray-500 text-sm"><i class="ph ph-spinner animate-spin"></i> Cargando verificaciones...</div>';
        try {
            const desde = (pagina - 1) * POR_PAGINA;
            const { data, error, count } = await consulta(DB.sb.from('sudi_v_scfi_insp_lista').select('*', { count: 'exact' }))
                .order('fecha_inspeccion', { ascending: false, nullsFirst: false }).order('consecutivo', { ascending: false, nullsFirst: false })
                .range(desde, desde + POR_PAGINA - 1);
            if (error) throw new Error(DB.mensajeError(error));
            filas = data; total = count || 0;
            const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
            grid.innerHTML = filas.length ? filas.map(tarjeta).join('')
                : '<div class="col-span-full py-16 text-center text-gray-500 text-sm bg-dark-800 border border-dashed border-dark-700 rounded-xl">No se encontraron verificaciones con ese criterio.</div>';
            $('insp-mostrando').textContent = total ? `Mostrando ${desde + 1} a ${desde + filas.length} de ${fmtNum(total)} verificaciones` : '';
            $('insp-pagina').textContent = `Pág. ${pagina} de ${paginas}`;
            $('insp-prev').disabled = pagina <= 1;
            $('insp-next').disabled = pagina >= paginas;
            pintarChips().catch(() => {});
        } catch (err) {
            grid.innerHTML = `<div class="col-span-full py-10 text-center text-red-400 text-sm">${esc(err.message)}</div>`;
        }
    }

    // ---------------------------------------------------------------
    // Nueva verificación (folio automático)
    // ---------------------------------------------------------------
    let nvCliente = null;
    let nvEstaciones = [];

    async function previewFolio() {
        const fecha = $('nv-fecha').value || hoy();
        const yy = fecha.slice(2, 4);
        const af = $('nv-af').checked;
        const serie = `${af ? 'AF' : 'DI-CAL'}-${yy}`;
        try {
            const ult = await DB.rpc('sudi_scfi_ultimo_consecutivo', { p_serie: serie });
            const n = (ult || 0) + 1;
            $('nv-folio').textContent = af ? `AF-${n}` : `DI-CAL-${yy}-${$('nv-zona').value || '03'}-${n}`;
            if (!ult && DB.esAdmin()) $('nv-folio').textContent += '  ⚠ ajusta el consecutivo';
        } catch (_) { $('nv-folio').textContent = '—'; }
    }

    async function abrirNueva() {
        nvCliente = null; nvEstaciones = [];
        $('nv-form').reset();
        $('nv-cliente-sel').textContent = '';
        $('nv-estacion').innerHTML = '<option value="">Primero elige el cliente</option>';
        $('nv-inspector').innerHTML = opcionesUsuarios('Selecciona...');
        $('nv-realizo').innerHTML = opcionesUsuarios('El mismo verificador');
        $('nv-fecha').value = hoy();
        const zonas = await DB.listar('sudi_zonas', { filtros: { activo: true }, orden: 'clave' }).catch(() => []);
        const zz = zonas.filter((z) => /^\d{2}$/.test(z.clave));
        $('nv-zona').innerHTML = (zz.length ? zz : [{ clave: '03', nombre: 'Chihuahua' }, { clave: '01', nombre: 'Juárez' }])
            .map((z) => `<option value="${z.clave}">${z.clave} · ${esc(z.nombre || '')}</option>`).join('');
        $('nv-zona').value = '03';
        previewFolio();
        App.openModal('modal-insp-nueva');
    }

    let tCli = null;
    async function buscarCliente() {
        const t = $('nv-cliente-buscar').value.trim().replace(/[,()%*\\]/g, ' ').trim();
        const box = $('nv-cliente-res');
        if (t.length < 2) { box.classList.add('hidden'); return; }
        const { data, error } = await DB.sb.from('clientes_catalogo').select('id, razon_social, nombre_comercial, rfc')
            .or(['razon_social', 'nombre_comercial', 'rfc'].map((c) => `${c}.ilike.%${t}%`).join(',')).limit(15);
        if (error) { box.innerHTML = `<p class="p-3 text-xs text-red-400">${esc(DB.mensajeError(error))}</p>`; box.classList.remove('hidden'); return; }
        box.innerHTML = data.length ? data.map((c) => `<button type="button" data-cli="${c.id}" class="block w-full text-left px-3 py-2 text-sm hover:bg-dark-700"><span class="text-white">${esc(c.razon_social || c.nombre_comercial)}</span> <span class="text-xs text-gray-500">${esc(c.rfc || '')}</span></button>`).join('')
            : '<p class="p-3 text-xs text-gray-500">No está en el catálogo. Dalo de alta en Catálogos → Clientes.</p>';
        box._datos = data;
        box.classList.remove('hidden');
    }

    async function elegirCliente(c) {
        nvCliente = c;
        $('nv-cliente-res').classList.add('hidden');
        $('nv-cliente-buscar').value = c.razon_social || c.nombre_comercial;
        $('nv-cliente-sel').textContent = c.rfc ? `RFC ${c.rfc}` : '';
        const { data } = await DB.sb.from('estaciones_servicio').select('id, nombre, nombre_comercial, permiso, numero_estacion, numero_mangueras, numero_dispensarios, municipio')
            .eq('cliente_id', String(c.id)).order('nombre');
        nvEstaciones = data || [];
        $('nv-estacion').innerHTML = nvEstaciones.length
            ? '<option value="">Selecciona la estación...</option>' + nvEstaciones.map((e) => `<option value="${esc(e.id)}">${esc(e.permiso || 'Sin PL')} · ${esc(e.nombre_comercial || e.nombre || '')} ${e.municipio ? '· ' + esc(e.municipio) : ''}</option>`).join('')
            : '<option value="">Este cliente no tiene estaciones (agrégalas en Catálogos → Clientes)</option>';
    }

    async function crearVerificacion(ev) {
        ev.preventDefault();
        const falta = [];
        if (!nvCliente) falta.push('cliente');
        if (!$('nv-estacion').value) falta.push('estación');
        if (!$('nv-inspector').value) falta.push('verificador');
        if (!$('nv-tipo').value) falta.push('tipo');
        if (!$('nv-fecha').value) falta.push('fecha');
        if (falta.length) { toast(`Falta: ${falta.join(', ')}.`, 'error'); return; }
        const num = (id) => ($(id).value === '' ? null : Number($(id).value));
        const btn = $('nv-guardar');
        btn.disabled = true;
        try {
            const est = nvEstaciones.find((e) => e.id === $('nv-estacion').value);
            const nueva = await DB.rpc('sudi_scfi_crear_inspeccion', { p: {
                cliente_id: nvCliente.id, estacion_id: $('nv-estacion').value,
                inspector_id: $('nv-inspector').value, realizo_id: $('nv-realizo').value || $('nv-inspector').value,
                tipo: $('nv-tipo').value, fecha_inspeccion: $('nv-fecha').value, zona: $('nv-zona').value,
                alto_flujo: $('nv-af').checked, mangueras: num('nv-mangueras') ?? est?.numero_mangueras ?? null,
                dispensarios: est?.numero_dispensarios ?? null,
                precio_por_manguera: num('nv-precio'), viaticos: num('nv-viaticos'),
                observaciones: $('nv-obs').value.trim() || null,
            } });
            App.closeModal('modal-insp-nueva');
            toast(`Verificación creada con folio ${nueva.folio}.`);
            pagina = 1;
            await cargar();
            abrirDetalle(nueva.id);
        } catch (err) { toast(err.message, 'error'); } finally { btn.disabled = false; }
    }

    // ---------------------------------------------------------------
    // Detalle
    // ---------------------------------------------------------------
    function tab(nombre) {
        document.querySelectorAll('#det-tabs [data-tab]').forEach((b) => {
            const on = b.dataset.tab === nombre;
            b.classList.toggle('border-brand-yellow', on); b.classList.toggle('text-white', on);
            b.classList.toggle('border-transparent', !on); b.classList.toggle('text-gray-400', !on);
        });
        document.querySelectorAll('#modal-insp-detalle [data-panel]').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== nombre));
        if (nombre === 'lados') pintarLados();
        if (nombre === 'evidencias') pintarEvidencias();
        if (nombre === 'comentarios') pintarComentarios();
    }

    async function recargarActual() {
        const { data, error } = await DB.sb.from('sudi_v_scfi_insp_lista').select('*').eq('id', actual.id).single();
        if (error) throw new Error(DB.mensajeError(error));
        actual = data;
        const i = filas.findIndex((f) => f.id === data.id);
        if (i >= 0) { filas[i] = data; const el = document.querySelector(`#insp-grid [data-idx="${i}"]`); if (el) el.outerHTML = tarjeta(data, i); }
    }

    async function abrirDetalle(id) {
        try {
            const { data, error } = await DB.sb.from('sudi_v_scfi_insp_lista').select('*').eq('id', id).single();
            if (error) throw new Error(DB.mensajeError(error));
            actual = data;
            lados = null;
            document.querySelector('#modal-insp-detalle [data-titulo]').textContent = `${data.folio} · ${data.razon_social || ''}`;
            pintarEtapas(); pintarGeneral(); pintarBitacora(); pintarDocumentos();
            tab('general');
            App.openModal('modal-insp-detalle');
        } catch (err) { toast(err.message, 'error'); }
    }

    function pintarEtapas() {
        const i = actual;
        const puede = puedeCapturar(i) && !i.cerrada && i.estatus !== 'cancelada';
        $('det-etapas').innerHTML = ETAPAS.map(([k, l, ic]) => `
            <button type="button" data-etapa="${k}" ${puede ? '' : 'disabled'} class="px-3 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 ${i[k] ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' : 'bg-dark-900 border-dark-700 text-gray-400 hover:text-white'}">
                <i class="ph ${i[k] ? 'ph-check-circle' : ic}"></i> ${l}</button>`).join('')
            + (i.cerrada
                ? `<span class="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-400 inline-flex items-center gap-1"><i class="ph ph-lock-key"></i> Cerrada ${i.cerrada_en ? new Date(i.cerrada_en).toLocaleDateString('es-MX') : ''}</span>
                   ${DB.puedeEditar() ? '<button type="button" id="det-reabrir" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-400 hover:bg-amber-500/10">Reabrir</button>' : ''}`
                : (puede ? '<button type="button" id="det-cerrar" class="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-yellow text-dark-900 inline-flex items-center gap-1"><i class="ph ph-lock-key"></i> Cerrar verificación</button>' : ''));
    }

    async function actualizar(cambios, msg) {
        try {
            await DB.actualizar('sudi_scfi_inspecciones', actual.id, cambios);
            await recargarActual();
            pintarEtapas(); pintarGeneral(); pintarBitacora(); pintarDocumentos();
            if (msg) toast(msg);
            return true;
        } catch (err) { toast(err.message, 'error'); return false; }
    }

    // ---- General ----
    function pintarGeneral() {
        const i = actual;
        const ed = DB.puedeEditar() && !i.cerrada ? '' : 'disabled';
        const caja = (k, v) => `<div class="bg-dark-900 border border-dark-700 rounded-lg px-4 py-2.5"><p class="text-[11px] text-gray-500">${k}</p><p class="text-sm text-white">${v}</p></div>`;
        document.querySelector('[data-panel="general"]').innerHTML = `
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                ${caja('Folio', `<span class="font-mono font-bold">${esc(i.folio)}</span>${i.alto_flujo ? ' <span class="text-purple-400 text-xs">ALTO FLUJO</span>' : ''}`)}
                ${caja('Cliente', esc(i.razon_social || '—'))}
                ${caja('Estación', `${esc(i.permiso || '—')}<br><span class="text-xs text-gray-400">${esc(i.estacion_nombre || '')} ${i.estacion_municipio ? '· ' + esc(i.estacion_municipio) : ''}</span>`)}
                ${caja('Importe', `$${fmtNum((i.mangueras_calc || 0) * (i.precio_por_manguera || 0))}`)}
            </div>
            <form id="gen-form" class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><label class="${LB}">Verificador SUDI</label><select id="g-inspector" ${ed} class="${IN}">${opcionesUsuarios('—')}</select></div>
                <div><label class="${LB}">¿Quién realizó el trabajo?</label><select id="g-realizo" ${ed} class="${IN}">${opcionesUsuarios('—')}</select></div>
                <div><label class="${LB}">Tipo</label><select id="g-tipo" ${ed} class="${IN}">${Object.entries(TIPOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
                <div><label class="${LB}">Fecha de inspección</label><input id="g-fecha" type="date" ${ed} class="${IN}"></div>
                <div><label class="${LB}">Mangueras</label><input id="g-mangueras" type="number" min="0" ${ed} class="${IN}"></div>
                <div><label class="${LB}">Precio por manguera</label><input id="g-precio" type="number" step="0.01" ${ed} class="${IN}"></div>
                <div><label class="${LB}">Viáticos</label><input id="g-viaticos" type="number" step="0.01" ${ed} class="${IN}"></div>
                <div><label class="${LB}">Estatus</label><select id="g-estatus" ${DB.puedeEditar() ? '' : 'disabled'} class="${IN}">${Object.entries(ESTATUS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}</select></div>
                <div><label class="${LB}">Facturación</label><select id="g-facturacion" ${DB.puedeEditar() ? '' : 'disabled'} class="${IN}"><option value="no_facturado">No facturado</option><option value="facturado">Facturado</option></select></div>
                <div><label class="${LB}">Factura</label><input id="g-factura" ${DB.puedeEditar() ? '' : 'disabled'} class="${IN}"></div>
                <div class="md:col-span-2" id="g-motivo-wrap"><label class="${LB}">Motivo de cancelación</label><input id="g-motivo" ${DB.puedeEditar() ? '' : 'disabled'} class="${IN}"></div>
                <div class="col-span-2 md:col-span-4"><label class="${LB}">Observaciones</label><textarea id="g-obs" rows="2" ${ed} class="${IN}"></textarea></div>
                ${DB.puedeEditar() ? `<div class="col-span-2 md:col-span-4 flex justify-end"><button type="submit" class="${BTNY}"><i class="ph ph-floppy-disk"></i> Guardar</button></div>` : ''}
            </form>`;
        $('g-inspector').value = i.inspector_id || ''; $('g-realizo').value = i.realizo_id || '';
        $('g-tipo').value = i.tipo; $('g-fecha').value = i.fecha_inspeccion || '';
        $('g-mangueras').value = i.mangueras ?? ''; $('g-precio').value = i.precio_por_manguera ?? ''; $('g-viaticos').value = i.viaticos ?? '';
        $('g-estatus').value = i.estatus; $('g-facturacion').value = i.facturacion; $('g-factura').value = i.factura || '';
        $('g-motivo').value = i.cancelada_motivo || ''; $('g-obs').value = i.observaciones || '';
        const motivo = () => $('g-motivo-wrap').classList.toggle('hidden', $('g-estatus').value !== 'cancelada');
        motivo(); $('g-estatus').addEventListener('change', motivo);
        $('gen-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const num = (id) => ($(id).value === '' ? null : Number($(id).value));
            const cambios = {
                estatus: $('g-estatus').value, facturacion: $('g-facturacion').value, factura: $('g-factura').value.trim() || null,
                cancelada_motivo: $('g-motivo').value.trim() || null,
            };
            if (!i.cerrada) Object.assign(cambios, {
                inspector_id: $('g-inspector').value || null, realizo_id: $('g-realizo').value || null, tipo: $('g-tipo').value,
                fecha_inspeccion: $('g-fecha').value || null, mangueras: num('g-mangueras'), precio_por_manguera: num('g-precio'),
                viaticos: num('g-viaticos'), observaciones: $('g-obs').value.trim() || null,
            });
            actualizar(cambios, 'Verificación guardada.');
        });
    }

    // ---- Lados y hologramas ----
    async function cargarFoliosInspector() {
        const ids = [actual.inspector_id, actual.realizo_id].filter(Boolean);
        foliosInsp = { flexograma: [], inicial: [], distintivo: [], precinto: [] };
        if (!ids.length) return;
        for (let desde = 0; ; desde += 1000) {
            const { data, error } = await DB.sb.from('sudi_scfi_hologramas').select('tipo, folio')
                .in('inspector_id', ids).eq('estado', 'asignado').order('folio').range(desde, desde + 999);
            if (error) throw new Error(DB.mensajeError(error));
            data.forEach((h) => foliosInsp[h.tipo]?.push(Number(h.folio)));
            if (data.length < 1000) break;
        }
    }

    async function cargarLados() {
        const [inst, holos] = await Promise.all([
            DB.listar('sudi_scfi_instrumentos', { filtros: { inspeccion_id: actual.id }, orden: 'orden' }),
            DB.listar('sudi_scfi_hologramas', { select: 'id, tipo, folio', filtros: { inspeccion_id: actual.id } }),
        ]);
        const porId = Object.fromEntries(holos.map((h) => [h.id, h]));
        lados = inst.map((x) => ({
            manguera_id: x.manguera_id, dispensario: x.dispensario ?? '', lado: x.lado || '', combustible: x.combustible || '',
            marca: x.marca || '', modelo: x.modelo || '', serie: x.serie || '', resultado: x.resultado || 'aprueba',
            flexograma: porId[x.holograma_id]?.folio ?? '', distintivo: porId[x.distintivo_id]?.folio ?? '', precinto: porId[x.precinto_id]?.folio ?? '',
            revision_calidad: x.revision_calidad || '', comentarios: x.comentarios || '',
        }));
    }

    async function pintarLados() {
        const panel = document.querySelector('[data-panel="lados"]');
        if (!lados) {
            panel.innerHTML = '<p class="text-sm text-gray-500"><i class="ph ph-spinner animate-spin"></i> Cargando lados...</p>';
            try { await Promise.all([cargarLados(), cargarFoliosInspector()]); } catch (err) { panel.innerHTML = `<p class="text-red-400 text-sm">${esc(err.message)}</p>`; return; }
        }
        const ro = !puedeCapturar(actual) || actual.cerrada || actual.estatus === 'cancelada';
        const dis = ro ? 'disabled' : '';
        const flexTipo = actual.tipo === 'inicial' ? 'inicial' : 'flexograma';
        const cel = 'px-2 py-1.5 text-xs bg-dark-900 border border-dark-700 rounded text-white w-full focus:outline-none focus:border-brand-yellow disabled:opacity-70';
        panel.innerHTML = `
            <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
                <p class="text-xs text-gray-400">Folios disponibles del inspector: <b class="text-white">${fmtNum(foliosInsp[flexTipo].length)}</b> flexogramas${flexTipo === 'inicial' ? ' iniciales' : ''} ·
                    <b class="text-white">${fmtNum(foliosInsp.distintivo.length)}</b> distintivos · <b class="text-white">${fmtNum(foliosInsp.precinto.length)}</b> precintos</p>
                ${ro ? '' : `<div class="flex flex-wrap gap-2">
                    <button type="button" id="l-cargar" class="${BTN2}"><i class="ph ph-gas-pump"></i> Cargar de la estación</button>
                    <button type="button" id="l-agregar" class="${BTN2}"><i class="ph ph-plus"></i> Agregar lado</button>
                    <button type="button" id="l-llenar" class="${BTN2}"><i class="ph ph-magic-wand"></i> Llenar folios</button>
                    <button type="button" id="l-guardar" class="${BTNY}"><i class="ph ph-floppy-disk"></i> Guardar lados</button></div>`}
            </div>
            <datalist id="dl-flex">${foliosInsp[flexTipo].slice(0, 500).map((f) => `<option value="${fmtFolio(flexTipo, f)}">`).join('')}</datalist>
            <datalist id="dl-dist">${foliosInsp.distintivo.slice(0, 500).map((f) => `<option value="${fmtFolio('distintivo', f)}">`).join('')}</datalist>
            <datalist id="dl-prec">${foliosInsp.precinto.slice(0, 500).map((f) => `<option value="${fmtFolio('precinto', f)}">`).join('')}</datalist>
            <div class="overflow-x-auto border border-dark-700 rounded-xl">
                <table class="w-full text-left min-w-[1100px]">
                    <thead class="bg-dark-900 text-[11px] uppercase text-gray-400"><tr>
                        ${['#', 'Disp.', 'Lado', 'Combustible', 'Marca', 'Modelo', 'Serie', 'Flexograma', 'Distintivo', 'Precinto', 'Resultado', ''].map((h) => `<th class="px-2 py-2 font-semibold">${h}</th>`).join('')}
                    </tr></thead>
                    <tbody>
                        ${lados.length ? lados.map((l, n) => `
                        <tr data-l="${n}" class="border-t border-dark-700">
                            <td class="px-2 py-1.5 text-xs text-gray-500">${n + 1}</td>
                            <td class="px-1 w-16"><input ${dis} data-k="dispensario" value="${esc(l.dispensario)}" class="${cel}"></td>
                            <td class="px-1 w-14"><input ${dis} data-k="lado" value="${esc(l.lado)}" maxlength="3" class="${cel} uppercase text-center"></td>
                            <td class="px-1"><input ${dis} data-k="combustible" value="${esc(l.combustible)}" class="${cel}"></td>
                            <td class="px-1"><input ${dis} data-k="marca" value="${esc(l.marca)}" class="${cel}"></td>
                            <td class="px-1"><input ${dis} data-k="modelo" value="${esc(l.modelo)}" class="${cel}"></td>
                            <td class="px-1"><input ${dis} data-k="serie" value="${esc(l.serie)}" class="${cel}"></td>
                            <td class="px-1 w-44"><input ${dis} data-k="flexograma" list="dl-flex" value="${l.flexograma !== '' ? esc(fmtFolio(flexTipo, l.flexograma)) : ''}" class="${cel} font-mono"></td>
                            <td class="px-1 w-28"><input ${dis} data-k="distintivo" list="dl-dist" value="${l.distintivo !== '' ? esc(fmtFolio('distintivo', l.distintivo)) : ''}" class="${cel} font-mono"></td>
                            <td class="px-1 w-32"><input ${dis} data-k="precinto" list="dl-prec" value="${l.precinto !== '' ? esc(fmtFolio('precinto', l.precinto)) : ''}" class="${cel} font-mono"></td>
                            <td class="px-1 w-28"><select ${dis} data-k="resultado" class="${cel}"><option value="aprueba" ${l.resultado !== 'rechaza' ? 'selected' : ''}>Aprueba</option><option value="rechaza" ${l.resultado === 'rechaza' ? 'selected' : ''}>Rechaza</option></select></td>
                            <td class="px-1 w-8">${ro ? '' : `<button type="button" data-quitar="${n}" class="text-gray-500 hover:text-red-400" title="Quitar"><i class="ph ph-trash"></i></button>`}</td>
                        </tr>`).join('') : '<tr><td colspan="12" class="py-8 text-center text-sm text-gray-500">Sin lados capturados. Usa "Cargar de la estación" o "Agregar lado".</td></tr>'}
                    </tbody>
                </table>
            </div>
            <p class="text-[11px] text-gray-500 mt-3">Al guardar, los folios quedan como <b>usados</b> con este dictamen (${esc(actual.folio)}) y ligados a su manguera. Si quitas un lado, sus folios regresan al inspector.</p>`;
        if (ro) return;
        $('l-agregar').addEventListener('click', () => { leerLados(); lados.push({ lado: siguienteLado(), resultado: 'aprueba', flexograma: '', distintivo: '', precinto: '', dispensario: '', combustible: '', marca: '', modelo: '', serie: '' }); pintarLados(); });
        $('l-cargar').addEventListener('click', cargarDeEstacion);
        $('l-llenar').addEventListener('click', llenarFolios);
        $('l-guardar').addEventListener('click', guardarLados);
        panel.querySelectorAll('[data-quitar]').forEach((b) => b.addEventListener('click', () => { leerLados(); lados.splice(Number(b.dataset.quitar), 1); pintarLados(); }));
    }

    function siguienteLado() {
        const usados = lados.map((l) => l.lado);
        for (let c = 65; c <= 90; c++) { const l = String.fromCharCode(c); if (!usados.includes(l)) return l; }
        return '';
    }

    function leerLados() {
        document.querySelectorAll('[data-panel="lados"] [data-l]').forEach((tr) => {
            const l = lados[Number(tr.dataset.l)];
            tr.querySelectorAll('[data-k]').forEach((el) => {
                const k = el.dataset.k;
                l[k] = ['flexograma', 'distintivo', 'precinto'].includes(k) ? (leerFolio(el.value) ?? '') : el.value.trim();
            });
            l.lado = String(l.lado || '').toUpperCase();
        });
    }

    async function cargarDeEstacion() {
        if (!actual.estacion_id) { toast('La verificación no tiene estación.', 'error'); return; }
        try {
            const m = await DB.listar('sudi_v_estacion_mangueras', { filtros: { estacion_id: actual.estacion_id }, orden: ['dispensario', 'orden'] });
            if (!m.length) { toast('La estación no tiene dispensarios capturados. Agrégalos en Catálogos → Clientes → Estaciones, o captura los lados aquí.', 'warning'); return; }
            leerLados();
            const prev = lados;
            lados = m.map((x) => {
                const ya = prev.find((p) => p.manguera_id === x.manguera_id);
                return ya || { manguera_id: x.manguera_id, dispensario: x.dispensario, lado: x.lado, combustible: x.combustible, marca: x.marca || '', modelo: x.modelo || '', serie: x.serie || '', resultado: 'aprueba', flexograma: '', distintivo: '', precinto: '' };
            });
            pintarLados();
            toast(`${m.length} lado(s) cargados de la estación.`);
        } catch (err) { toast(err.message, 'error'); }
    }

    // Llena los lados vacíos con los folios más bajos del inspector
    function llenarFolios() {
        leerLados();
        const flexTipo = actual.tipo === 'inicial' ? 'inicial' : 'flexograma';
        const usados = { f: new Set(lados.map((l) => l.flexograma).filter(Boolean)), d: new Set(lados.map((l) => l.distintivo).filter(Boolean)), p: new Set(lados.map((l) => l.precinto).filter(Boolean)) };
        const libres = { f: foliosInsp[flexTipo].filter((x) => !usados.f.has(x)), d: foliosInsp.distintivo.filter((x) => !usados.d.has(x)), p: foliosInsp.precinto.filter((x) => !usados.p.has(x)) };
        let n = 0;
        lados.forEach((l) => {
            if (l.flexograma === '' && libres.f.length) { l.flexograma = libres.f.shift(); n++; }
            if (l.distintivo === '' && libres.d.length) { l.distintivo = libres.d.shift(); n++; }
            if (l.precinto === '' && libres.p.length) { l.precinto = libres.p.shift(); n++; }
        });
        pintarLados();
        toast(n ? `${n} folio(s) propuestos. Revísalos y da "Guardar lados".` : 'No hay folios libres del inspector para llenar.', n ? 'success' : 'warning');
    }

    async function guardarLados() {
        leerLados();
        const malos = lados.map((l, n) => (!/^[A-Z0-9]{1,3}$/.test(l.lado || '') ? n + 1 : null)).filter(Boolean);
        if (malos.length) { toast(`Revisa el lado de las filas ${malos.join(', ')} (A, B, C…).`, 'error'); return; }
        const btn = $('l-guardar');
        btn.disabled = true;
        try {
            const r = await DB.rpc('sudi_scfi_guardar_lados', { p_inspeccion: actual.id, p_items: lados });
            lados = null;
            await recargarActual();
            pintarEtapas();
            await pintarLados();
            toast(`${r.lados} lado(s) guardados; ${r.hologramas} folio(s) marcados como usados.`);
        } catch (err) { toast(err.message, 'error'); } finally { if ($('l-guardar')) $('l-guardar').disabled = false; }
    }

    // ---- Bitácora ----
    function pintarBitacora() {
        const i = actual;
        const ro = !puedeCapturar(i) || i.cerrada ? 'disabled' : '';
        const caja = (k, v, c = 'text-white') => `<div class="bg-dark-900 border border-dark-700 rounded-lg px-4 py-2.5"><p class="text-[11px] text-gray-500">${k}</p><p class="text-lg font-bold ${c}">${v}</p></div>`;
        document.querySelector('[data-panel="bitacora"]').innerHTML = `
            <div class="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                ${caja('Mangueras', fmtNum(i.mangueras_calc))}
                ${caja('Tiempo según la norma', `${fmtNum(i.tiempo_norma_min)} min`)}
                ${caja('Tiempo realizado', i.min_realizado == null ? '—' : `${fmtNum(i.min_realizado)} min`)}
                ${caja('Diferencia', i.diferencia_min == null ? '—' : `${i.diferencia_min > 0 ? '+' : ''}${fmtNum(i.diferencia_min)} min`)}
                ${caja('Horario', i.calificacion || '—', i.calificacion === 'BIEN' ? 'text-emerald-400' : i.calificacion === 'MAL' ? 'text-red-400' : 'text-gray-400')}
            </div>
            <form id="bit-form" class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><label class="${LB}">Hora de inicio</label><input id="b-inicio" type="time" ${ro} class="${IN}" value="${hhmm(i.hora_inicio)}"></div>
                <div><label class="${LB}">Hora final</label><input id="b-fin" type="time" ${ro} class="${IN}" value="${hhmm(i.hora_fin)}"></div>
                <div class="flex items-end"><label class="flex items-center gap-2 text-sm text-gray-300 pb-2"><input id="b-fisico" type="checkbox" ${ro} ${i.dictamen_entregado ? 'checked' : ''} class="accent-yellow-500 w-4 h-4"> Dictamen entregado en físico</label></div>
                <div class="flex items-end"><label class="flex items-center gap-2 text-sm text-gray-300 pb-2"><input id="b-tarde" type="checkbox" ${ro} ${i.evidencia_fuera_tiempo || i.evidencias_tarde ? 'checked' : ''} class="accent-yellow-500 w-4 h-4"> Fotos/videos fuera de tiempo</label></div>
                <div class="col-span-2"><label class="${LB}">Cambios (quién modificó qué)</label><textarea id="b-cambios" rows="2" ${ro} class="${IN}" placeholder="Ej. ROBERTO MODIFICA C.P.">${esc(i.cambios || '')}</textarea></div>
                <div class="col-span-2"><label class="${LB}">Notas</label><textarea id="b-notas" rows="2" ${ro} class="${IN}">${esc(i.observaciones || '')}</textarea></div>
                <p class="col-span-2 md:col-span-4 text-[11px] text-gray-500">Ubicación: ${esc(i.estacion_municipio || '—')} · Tipo de revisión: ${TIPOS[i.tipo] || i.tipo} · Evidencias: ${fmtNum(i.evidencias)}${i.evidencias_tarde ? ` (${i.evidencias_tarde} subidas después del día siguiente)` : ''}</p>
                ${ro ? '' : `<div class="col-span-2 md:col-span-4 flex justify-end"><button type="submit" class="${BTNY}"><i class="ph ph-floppy-disk"></i> Guardar bitácora</button></div>`}
            </form>`;
        $('bit-form').addEventListener('submit', (e) => {
            e.preventDefault();
            actualizar({
                hora_inicio: $('b-inicio').value || null, hora_fin: $('b-fin').value || null,
                dictamen_entregado: $('b-fisico').checked, evidencia_fuera_tiempo: $('b-tarde').checked,
                cambios: $('b-cambios').value.trim() || null, observaciones: $('b-notas').value.trim() || null,
                estatus: actual.estatus === 'programada' && $('b-inicio').value ? 'en_proceso' : actual.estatus,
            }, 'Bitácora guardada.');
        });
    }

    // ---- Evidencias ----
    async function pintarEvidencias() {
        const panel = document.querySelector('[data-panel="evidencias"]');
        const puede = puedeCapturar(actual);
        panel.innerHTML = `
            ${puede ? `<label class="block border-2 border-dashed border-dark-600 rounded-xl p-6 text-center cursor-pointer hover:border-brand-yellow transition-colors mb-4">
                <i class="ph ph-upload-simple text-2xl text-gray-400"></i>
                <p class="text-sm text-gray-300 mt-1">Sube fotos y videos de la verificación</p>
                <p class="text-[11px] text-gray-500">Se guardan en SUDI (no en el teléfono ni en iCloud). Máx. 50 MB por archivo.</p>
                <input id="ev-input" type="file" multiple accept="image/*,video/*,application/pdf" class="hidden">
            </label>
            <p id="ev-progreso" class="text-xs text-brand-yellow mb-3"></p>` : ''}
            <div id="ev-lista" class="grid grid-cols-2 md:grid-cols-4 gap-3"><p class="text-sm text-gray-500 col-span-full"><i class="ph ph-spinner animate-spin"></i> Cargando...</p></div>`;
        $('ev-input')?.addEventListener('change', subirEvidencias);
        try {
            const ev = await DB.listar('sudi_scfi_evidencias', { filtros: { inspeccion_id: actual.id }, orden: 'created_at' });
            const urls = await Promise.all(ev.map((x) => DB.urlArchivo(x.ruta).catch(() => null)));
            $('ev-lista').innerHTML = ev.length ? ev.map((x, n) => `
                <div class="bg-dark-900 border border-dark-700 rounded-xl overflow-hidden">
                    <a href="${urls[n] || '#'}" target="_blank" rel="noopener" class="block aspect-video bg-dark-800 flex items-center justify-center">
                        ${x.tipo === 'foto' && urls[n] ? `<img src="${urls[n]}" alt="" class="w-full h-full object-cover">` : `<i class="ph ${x.tipo === 'video' ? 'ph-video' : 'ph-file'} text-3xl text-gray-400"></i>`}
                    </a>
                    <div class="px-3 py-2 flex items-center justify-between gap-2">
                        <p class="text-[11px] text-gray-400 truncate" title="${esc(x.nombre)}">${esc(x.nombre || x.tipo)}<br>${new Date(x.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</p>
                        ${DB.puedeEditar() || x.subido_por === yo() ? `<button type="button" data-ev-borrar="${x.id}" class="text-gray-500 hover:text-red-400"><i class="ph ph-trash"></i></button>` : ''}
                    </div>
                </div>`).join('') : '<p class="text-sm text-gray-500 col-span-full">Sin evidencias.</p>';
            $('ev-lista').querySelectorAll('[data-ev-borrar]').forEach((b) => b.addEventListener('click', () => App.confirmAction({
                title: 'Eliminar evidencia', message: '¿Eliminar este archivo de la verificación?', confirmLabel: 'Eliminar',
                onConfirm: async () => { try { await DB.eliminar('sudi_scfi_evidencias', b.dataset.evBorrar); await recargarActual(); pintarEvidencias(); pintarBitacora(); } catch (err) { toast(err.message, 'error'); } },
            })));
        } catch (err) { $('ev-lista').innerHTML = `<p class="text-sm text-red-400 col-span-full">${esc(err.message)}</p>`; }
    }

    async function subirEvidencias(e) {
        const archivos = [...e.target.files];
        if (!archivos.length) return;
        let ok = 0;
        for (const [n, f] of archivos.entries()) {
            $('ev-progreso').textContent = `Subiendo ${n + 1} de ${archivos.length}: ${f.name}...`;
            try {
                if (f.size > 50 * 1024 * 1024) throw new Error(`${f.name} pesa más de 50 MB.`);
                const ruta = await DB.subirArchivo(`scfi/inspecciones/${actual.id}`, f);
                await DB.crear('sudi_scfi_evidencias', {
                    inspeccion_id: actual.id, ruta, nombre: f.name, bytes: f.size,
                    tipo: f.type.startsWith('video') ? 'video' : f.type.startsWith('image') ? 'foto' : 'documento',
                });
                ok++;
            } catch (err) { toast(err.message, 'error'); }
        }
        $('ev-progreso').textContent = '';
        if (ok) toast(`${ok} archivo(s) subidos.`);
        await recargarActual();
        pintarEvidencias(); pintarBitacora();
    }

    // ---- Documentos ----
    function pintarDocumentos() {
        const i = actual;
        const puede = puedeCapturar(i);
        const fila = (campo, titulo, icono) => `
            <div class="flex flex-wrap items-center justify-between gap-3 bg-dark-900 border border-dark-700 rounded-xl px-5 py-4">
                <div class="flex items-center gap-3"><i class="ph ${icono} text-2xl text-brand-yellow"></i>
                    <div><p class="text-white font-semibold">${titulo}</p><p class="text-xs text-gray-500">${i[campo] ? esc(i[campo].split('/').pop().replace(/^\d+_/, '')) : 'Sin archivo'}</p></div></div>
                <div class="flex gap-2">
                    ${i[campo] ? `<button type="button" data-ver="${campo}" class="${BTN2}"><i class="ph ph-eye"></i> Ver</button>` : ''}
                    ${puede ? `<label class="${BTN2} cursor-pointer"><i class="ph ph-upload-simple"></i> ${i[campo] ? 'Reemplazar' : 'Subir'}<input type="file" data-subir="${campo}" accept="application/pdf,image/*" class="hidden"></label>` : ''}
                </div>
            </div>`;
        document.querySelector('[data-panel="documentos"]').innerHTML = `
            <div class="space-y-3">
                ${fila('dictamen_archivo', 'Dictamen', 'ph-file-pdf')}
                ${fila('orden_servicio_archivo', 'Orden de servicio', 'ph-file-text')}
                <div class="flex flex-wrap items-center justify-between gap-3 bg-dark-900 border border-dark-700 rounded-xl px-5 py-4">
                    <div class="flex items-center gap-3"><i class="ph ph-envelope-simple text-2xl text-brand-yellow"></i>
                        <div><p class="text-white font-semibold">Enviar correo al cliente</p><p class="text-xs text-gray-500">${esc(i.cliente_correo || 'El cliente no tiene correo en el catálogo')}${i.correo_enviado_en ? ` · enviado ${new Date(i.correo_enviado_en).toLocaleDateString('es-MX')}` : ''}</p></div></div>
                    <button type="button" id="doc-correo" class="${BTN2}"><i class="ph ph-paper-plane-tilt"></i> Abrir correo</button>
                </div>
                <p class="text-[11px] text-gray-500">El correo se abre en tu programa de correo con los datos listos; adjunta el dictamen descargado. SUDI registra la fecha de envío.</p>
            </div>`;
        const panel = document.querySelector('[data-panel="documentos"]');
        panel.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', async () => {
            try { window.open(await DB.urlArchivo(actual[b.dataset.ver]), '_blank', 'noopener'); } catch (err) { toast(err.message, 'error'); }
        }));
        panel.querySelectorAll('[data-subir]').forEach((inp) => inp.addEventListener('change', async () => {
            const f = inp.files[0]; if (!f) return;
            try {
                const ruta = await DB.subirArchivo(`scfi/inspecciones/${actual.id}/documentos`, f);
                await actualizar({ [inp.dataset.subir]: ruta }, 'Archivo guardado.');
            } catch (err) { toast(err.message, 'error'); }
        }));
        $('doc-correo').addEventListener('click', () => {
            const asunto = `Dictamen ${i.folio} · ${i.razon_social || ''}`;
            const cuerpo = `Buen día.\n\nLe compartimos el dictamen ${i.folio} de la verificación realizada el ${fmtFechaLarga(i.fecha_inspeccion)} a la estación ${i.permiso || ''} ${i.estacion_nombre || ''}.\n\nTipo: ${TIPOS[i.tipo] || i.tipo}\n\nQuedamos a sus órdenes.\nJOMAR Verificaciones`;
            window.location.href = `mailto:${encodeURIComponent(i.cliente_correo || '')}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
            if (puede) actualizar({ correo_enviado_en: new Date().toISOString() });
        });
    }

    // ---- Comentarios ----
    async function pintarComentarios() {
        const panel = document.querySelector('[data-panel="comentarios"]');
        panel.innerHTML = `
            <form id="com-form" class="flex gap-2 mb-4"><input id="com-texto" class="${IN}" placeholder="Escribe un comentario..."><button class="${BTNY}"><i class="ph ph-paper-plane-tilt"></i></button></form>
            <div id="com-lista" class="space-y-2"><p class="text-sm text-gray-500"><i class="ph ph-spinner animate-spin"></i></p></div>`;
        const pintar = async () => {
            const lista = await DB.comentarios.listar('sudi_scfi_inspecciones', actual.id).catch(() => []);
            $('com-lista').innerHTML = lista.length ? lista.map((c) => `
                <div class="bg-dark-900 border border-dark-700 rounded-lg px-4 py-2.5">
                    <p class="text-xs text-gray-500">${esc(c.autor?.nombre_completo || 'Usuario')} · ${new Date(c.created_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</p>
                    <p class="text-sm text-gray-200 whitespace-pre-wrap">${esc(c.texto)}</p>
                </div>`).join('') : '<p class="text-sm text-gray-500">Sin comentarios.</p>';
        };
        $('com-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const t = $('com-texto').value.trim(); if (!t) return;
            try { await DB.comentarios.crear('sudi_scfi_inspecciones', actual.id, t); $('com-texto').value = ''; pintar(); } catch (err) { toast(err.message, 'error'); }
        });
        pintar();
    }

    // ---------------------------------------------------------------
    // Consecutivos (solo administrador)
    // ---------------------------------------------------------------
    async function abrirConsecutivos() {
        const yy = String(new Date().getFullYear()).slice(2);
        const series = [`DI-CAL-${yy}`, `AF-${yy}`];
        $('cons-serie').innerHTML = series.map((s) => `<option>${s}</option>`).join('');
        const mostrar = async () => {
            const u = await DB.rpc('sudi_scfi_ultimo_consecutivo', { p_serie: $('cons-serie').value }).catch(() => null);
            $('cons-actual').textContent = `Último usado: ${u ?? '—'} → el siguiente folio será el ${(u || 0) + 1}.`;
            $('cons-ultimo').value = u ?? 0;
        };
        $('cons-serie').onchange = mostrar;
        await mostrar();
        App.openModal('modal-insp-consecutivo');
    }

    // ---------------------------------------------------------------
    // Eventos y arranque
    // ---------------------------------------------------------------
    function enlazar() {
        $('insp-grid').addEventListener('click', (e) => { const b = e.target.closest('[data-idx]'); if (b) abrirDetalle(filas[Number(b.dataset.idx)].id); });
        $('insp-chips').addEventListener('click', (e) => { const b = e.target.closest('[data-estatus]'); if (!b) return; filtros.estatus = b.dataset.estatus; pagina = 1; cargar(); });
        $('insp-prev').addEventListener('click', () => { pagina -= 1; cargar(); });
        $('insp-next').addEventListener('click', () => { pagina += 1; cargar(); });
        $('f-inspector').addEventListener('change', (e) => { filtros.inspector = e.target.value; pagina = 1; cargar(); });
        $('f-desde').addEventListener('change', (e) => { filtros.desde = e.target.value; pagina = 1; cargar(); });
        $('f-hasta').addEventListener('change', (e) => { filtros.hasta = e.target.value; pagina = 1; cargar(); });
        let tB = null;
        $('inspecciones-search')?.addEventListener('input', (e) => { clearTimeout(tB); tB = setTimeout(() => { filtros.texto = e.target.value; pagina = 1; cargar(); }, 350); });

        $('btn-nueva-verificacion')?.addEventListener('click', abrirNueva);
        $('btn-consecutivos')?.addEventListener('click', abrirConsecutivos);
        $('nv-cliente-buscar').addEventListener('input', () => { nvCliente = null; clearTimeout(tCli); tCli = setTimeout(buscarCliente, 300); });
        $('nv-cliente-res').addEventListener('click', (e) => {
            const b = e.target.closest('[data-cli]'); if (!b) return;
            elegirCliente(($('nv-cliente-res')._datos || []).find((c) => String(c.id) === b.dataset.cli));
        });
        $('nv-estacion').addEventListener('change', () => {
            const est = nvEstaciones.find((x) => x.id === $('nv-estacion').value);
            if (est?.numero_mangueras && !$('nv-mangueras').value) $('nv-mangueras').value = est.numero_mangueras;
        });
        ['nv-fecha', 'nv-zona', 'nv-af'].forEach((id) => $(id).addEventListener('change', previewFolio));
        $('nv-form').addEventListener('submit', crearVerificacion);

        $('det-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) tab(b.dataset.tab); });
        $('det-etapas').addEventListener('click', (e) => {
            const b = e.target.closest('[data-etapa]');
            if (b) {
                const k = b.dataset.etapa;
                const cambios = { [k]: !actual[k] };
                if (actual.estatus === 'programada') cambios.estatus = 'en_proceso';
                actualizar(cambios);
                return;
            }
            if (e.target.closest('#det-cerrar')) {
                App.confirmAction({
                    title: 'Cerrar verificación', danger: false, confirmLabel: 'Cerrar',
                    message: `Se cerrará ${actual.folio}. Ya no se podrán cambiar lados ni bitácora sin que un gerente la reabra. ¿Continuar?`,
                    onConfirm: () => actualizar({ cerrada: true, etapa_final: true }, 'Verificación cerrada.'),
                });
            }
            if (e.target.closest('#det-reabrir')) actualizar({ cerrada: false, estatus: 'en_proceso' }, 'Verificación reabierta.');
        });
        $('cons-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await DB.rpc('sudi_scfi_ajustar_consecutivo', { p_serie: $('cons-serie').value, p_ultimo: Number($('cons-ultimo').value) });
                toast('Consecutivo actualizado.');
                App.closeModal('modal-insp-consecutivo');
            } catch (err) { toast(err.message, 'error'); }
        });
    }

    montar();
    enlazar();
    (async () => {
        try { DB = await App.db(); } catch (err) { $('insp-grid').innerHTML = `<p class="text-red-400">${esc(err.message)}</p>`; return; }
        if (!DB.puedeEditar()) $('btn-nueva-verificacion')?.classList.add('hidden');
        if (!DB.esAdmin()) $('btn-consecutivos')?.classList.add('hidden');
        inspectores = await DB.listar('sudi_usuarios', { select: 'id, nombre_completo, es_inspector', filtros: { activo: true }, orden: 'nombre_completo' }).catch(() => []);
        if (inspectores.some((u) => u.es_inspector)) inspectores = inspectores.filter((u) => u.es_inspector);
        $('f-inspector').innerHTML = '<option value="">Todos los inspectores</option>' + inspectores.map((u) => `<option value="${u.id}">${esc(u.nombre_completo)}</option>`).join('');
        await cargar();
        // Abrir directo: inspecciones.html?folio=DI-CAL-26-03-701
        const folio = new URLSearchParams(location.search).get('folio');
        if (folio) {
            const { data } = await DB.sb.from('sudi_scfi_inspecciones').select('id').eq('folio', folio).maybeSingle();
            if (data) abrirDetalle(data.id);
        }
        let t = null;
        DB.sb.channel('sudi-scfi-insp').on('postgres_changes', { event: '*', schema: 'public', table: 'sudi_scfi_inspecciones' }, () => { clearTimeout(t); t = setTimeout(cargar, 1500); }).subscribe();
    })();
})();

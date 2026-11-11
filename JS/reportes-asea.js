/**
 * reportes-asea.js — Reportes de ASEA conectados a Supabase.
 *   <script src="../../JS/reportes-asea.js" data-pantalla="general"    defer>  → reportes/ASEA/general_inspecciones.html
 *   <script src="../../JS/reportes-asea.js" data-pantalla="inicio"     defer>  → reportes/ASEA/por_fecha_inicio.html
 *   <script src="../../JS/reportes-asea.js" data-pantalla="creacion"   defer>  → reportes/ASEA/por_fecha_creacion.html
 *   <script src="../../JS/reportes-asea.js" data-pantalla="trimestral" defer>  → reportes/ASEA/Inspecciones_trimestrales.html
 *   <script src="../../JS/reportes-asea.js" data-pantalla="cobranza"   defer>  → reportes/ASEA/cobranza.html
 * Datos: sudi_asea_ordenes (0011/0012/0013) + estaciones_servicio, clientes_catalogo, sudi_asea_estaciones,
 * sudi_estacion_tanques, sudi_estacion_dispensarios, sudi_usuarios, sudi_asea_gerentes, sudi_zonas.
 */
(() => {
    'use strict';

    const PANTALLA = document.currentScript?.dataset.pantalla || 'general';
    const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    const POR_PAGINA = 25;

    const $ = (id) => document.getElementById(id);
    const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const pad = (n) => String(n).padStart(2, '0');
    const IN = 'bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm font-medium text-white focus:outline-none focus:border-brand-yellow [color-scheme:dark]';
    const BTN = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50';
    const TIPO = { OP: 'Operación y mantenimiento', D: 'Diseño', C: 'Construcción' };
    const ESTATUS = { en_tramite: 'En trámite', realizada: 'Realizada', cancelada: 'Cancelada' };

    // ---------------- Fechas (hora local) ----------------
    const diaLocal = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
    const hora = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
    const dmy = (f) => { if (!f) return ''; const [a, m, d] = String(f).slice(0, 10).split('-'); return `${d}/${m}/${a}`; };
    const hoyISO = () => diaLocal(new Date().toISOString());

    // ---------------- Datos ----------------
    let DB = null, ordenes = [], filas = [], pagina = 1;
    let est = {}, cli = {}, asea = {}, usu = {}, ger = {}, zonas = {}, tanques = {}, disp = {};

    const estado = (o) => (o.estatus === 'cancelada' ? 'cancelada' : (o.estatus === 'realizada' || o.fecha_fin) ? 'realizada' : o.fecha_inicio ? 'proceso' : 'pendiente');
    const E = (o) => est[String(o.estacion_id)] || {};
    const C = (o) => cli[o.cliente_id] || cli[E(o).cliente_id] || {};
    const A = (o) => asea[String(o.estacion_id)] || {};
    const primero = (...v) => v.find((x) => x !== undefined && x !== null && String(x).trim() !== '') ?? '';
    const razon = (o) => primero(C(o).razon_social, E(o).razon_social);
    const gerente = (o) => primero(ger[o.gerente_id]?.nombre, o.gerente_nombre);
    const tipoGer = (o) => primero(ger[o.gerente_id]?.tipo, o.tipo_gerente);
    const zonaTxt = (o) => (o.zona ? `${o.zona}${zonas[o.zona] ? ` · ${zonas[o.zona]}` : ''}` : '');
    const cumple = (o) => (o.cumple === true ? 'Cumple' : o.cumple === false ? 'No cumple' : 'Pendiente');
    const estatusTxt = (o) => ({ pendiente: 'Pendiente', proceso: 'En proceso', realizada: 'Realizada', cancelada: 'Cancelada' }[estado(o)]);
    const direccion = (o) => primero(E(o).direccion, E(o).domicilio, [E(o).calle, E(o).numero].filter(Boolean).join(' '));

    async function todo(tabla, cols = '*', filtro) {
        const out = [];
        for (let d = 0; ; d += 1000) {
            let q = DB.sb.from(tabla).select(cols).range(d, d + 999);
            if (filtro) q = filtro(q);
            const { data, error } = await q;
            if (error) throw new Error(DB.mensajeError(error));
            out.push(...(data || []));
            if (!data || data.length < 1000) break;
        }
        return out;
    }
    async function porIds(tabla, col, ids, cols = '*') {
        const out = [];
        for (let i = 0; i < ids.length; i += 200) {
            const { data, error } = await DB.sb.from(tabla).select(cols).in(col, ids.slice(i, i + 200));
            if (error) throw new Error(DB.mensajeError(error));
            out.push(...(data || []));
        }
        return out;
    }

    async function cargarTodo() {
        $('rep-tbody').innerHTML = `<tr><td colspan="${COLS.length}" class="py-10 text-center text-gray-500"><i class="ph ph-spinner animate-spin"></i> Cargando...</td></tr>`;
        try {
            ordenes = await todo('sudi_asea_ordenes');
            const estIds = [...new Set(ordenes.map((o) => o.estacion_id).filter(Boolean).map(String))];
            const [ests, us, gs, zs, as] = await Promise.all([
                porIds('estaciones_servicio', 'id', estIds),
                DB.listar('sudi_usuarios', { select: 'id, nombre_completo' }).catch(() => []),
                DB.listar('sudi_asea_gerentes').catch(() => []),
                DB.listar('sudi_zonas', { select: 'clave, nombre' }).catch(() => []),
                porIds('sudi_asea_estaciones', 'estacion_id', estIds).catch(() => []),
            ]);
            est = Object.fromEntries(ests.map((e) => [String(e.id), e]));
            usu = Object.fromEntries(us.map((u) => [u.id, u.nombre_completo]));
            ger = Object.fromEntries(gs.map((g) => [g.id, g]));
            zonas = Object.fromEntries(zs.map((z) => [z.clave, z.nombre]));
            asea = Object.fromEntries(as.map((a) => [String(a.estacion_id), a]));
            const cliIds = [...new Set([...ordenes.map((o) => o.cliente_id), ...ests.map((e) => e.cliente_id)].filter(Boolean))];
            cli = Object.fromEntries((await porIds('clientes_catalogo', 'id', cliIds).catch(() => [])).map((c) => [c.id, c]));
            if (PANTALLA === 'inicio') {
                const [ts, ds] = await Promise.all([
                    porIds('sudi_estacion_tanques', 'estacion_id', estIds, 'estacion_id').catch(() => []),
                    porIds('sudi_estacion_dispensarios', 'estacion_id', estIds, 'estacion_id').catch(() => []),
                ]);
                tanques = {}; disp = {};
                ts.forEach((t) => { tanques[String(t.estacion_id)] = (tanques[String(t.estacion_id)] || 0) + 1; });
                ds.forEach((t) => { disp[String(t.estacion_id)] = (disp[String(t.estacion_id)] || 0) + 1; });
            }
            filtrar();
        } catch (err) {
            $('rep-tbody').innerHTML = `<tr><td colspan="${COLS.length}" class="py-10 text-center text-red-400">${esc(err.message)}</td></tr>`;
        }
    }

    // ---------------- Pantallas ----------------
    // [encabezado, valor(o, i), ancho]
    const COL_GENERAL = [
        ['Solicitud de servicio', (o) => o.folio], ['Estación', (o) => E(o).permiso], ['Tipo de verificación', (o) => TIPO[o.tipo_verificacion] || o.tipo_verificacion],
        ['Verificador', (o) => usu[o.verificador_id]], ['Cliente', razon], ['RFC', (o) => C(o).rfc],
        ['Contacto', (o) => primero(C(o).contacto, C(o).representante)], ['Teléfono', (o) => primero(C(o).telefono, C(o).celular, E(o).telefono)],
        ['Nombre de estación', (o) => primero(E(o).nombre_comercial, E(o).nombre)], ['Número de permiso', (o) => E(o).permiso],
        ['Responsable de estación', (o) => primero(A(o).representante, E(o).encargado)], ['Dirección', direccion],
        ['Fecha de solicitud', (o) => dmy(o.fecha_solicitud)], ['Estatus', estatusTxt],
        ['Fecha inicio', (o) => dmy(diaLocal(o.fecha_inicio))], ['Hora inicio', (o) => hora(o.fecha_inicio)],
        ['Fecha fin', (o) => dmy(diaLocal(o.fecha_fin))], ['Hora fin', (o) => hora(o.fecha_fin)],
        ['Zona', zonaTxt], ['Gerente técnico', gerente], ['Tipo de gerente', tipoGer], ['Resultado', cumple],
    ];
    const COL_INICIO = [
        ['Solicitud de servicio', (o) => o.folio], ['Zona', zonaTxt], ['Cliente', razon], ['Estación', (o) => primero(E(o).nombre_comercial, E(o).nombre)],
        ['Fecha inicio', (o) => dmy(diaLocal(o.fecha_inicio))], ['Hora inicio', (o) => hora(o.fecha_inicio)],
        ['Fecha fin', (o) => dmy(diaLocal(o.fecha_fin))], ['Hora fin', (o) => hora(o.fecha_fin)],
        ['Tipo de verificación', (o) => TIPO[o.tipo_verificacion] || o.tipo_verificacion], ['Verificador', (o) => usu[o.verificador_id]],
        ['Gerente técnico', gerente], ['Número de permiso', (o) => E(o).permiso], ['Dirección', direccion],
        ['Municipio', (o) => E(o).municipio], ['Estado', (o) => E(o).estado], ['Tipo estación', (o) => A(o).tipo],
        ['Representante legal', (o) => primero(C(o).representante_legal, C(o).representante)],
        ['Norma en vigor', (o) => (A(o).norma_en_vigor ? 'Sí' : A(o).norma_en_vigor === false ? 'No' : '')],
        ['Dispensarios', (o) => disp[String(o.estacion_id)] || 0], ['Tanques', (o) => tanques[String(o.estacion_id)] || 0], ['Estatus', estatusTxt],
    ];
    const COL_CREACION = [
        ['Solicitud de servicio', (o) => o.folio], ['Fecha de creación', (o) => dmy(diaLocal(o.created_at) || o.fecha_solicitud)],
        ['Razón social', razon], ['Estación', (o) => E(o).permiso], ['Tipo de verificación', (o) => TIPO[o.tipo_verificacion] || o.tipo_verificacion],
        ['Capturó', (o) => usu[o.created_by]], ['Estatus', estatusTxt],
    ];
    const COL_TRIM = [
        ['No. de reporte trimestral', (o, i) => i + 1], ['Identificador / Referencia', (o) => E(o).permiso],
        ['Esquema de evaluación de la conformidad', (o) => (TIPO[o.tipo_verificacion] || '').toUpperCase()], ['Razón social (Cliente)', razon],
        ['Fecha de la visita', (o) => dmy(diaLocal(o.fecha_inicio))], ['Hora de inicio', (o) => hora(o.fecha_inicio)], ['Hora de finalización', (o) => hora(o.fecha_fin)],
        ['Nombre del inspector', (o) => usu[o.verificador_id]], ['Gerente técnico', gerente], ['Calle y número', direccion],
        ['Municipio / Delegación', (o) => E(o).municipio], ['Entidad federativa', (o) => E(o).estado],
        ['Código postal', (o) => primero(E(o).codigo_postal, E(o).cp)], ['Folio del dictamen', (o) => o.folio],
        ['Fecha del dictamen', (o) => dmy(diaLocal(o.fecha_fin))], ['Resultado', cumple],
    ];
    const COL_COBRANZA = [
        ['Solicitud de servicio', (o) => o.folio], ['Estación', (o) => E(o).permiso], ['Razón social', razon],
        ['Verificador', (o) => usu[o.verificador_id]], ['Fecha fin', (o) => dmy(diaLocal(o.fecha_fin))],
        ['Autorizada', (o) => (o.autorizada ? 'Sí' : 'No')],
    ];
    const CFG = {
        general: { titulo: 'Reporte general de inspecciones', cols: COL_GENERAL, fecha: (o) => o.fecha_solicitud, base: 'fecha de solicitud', archivo: 'ASEA_general' },
        inicio: { titulo: 'Inspecciones por fecha de inicio', cols: COL_INICIO, fecha: (o) => diaLocal(o.fecha_inicio), base: 'fecha de inicio', archivo: 'ASEA_por_fecha_inicio' },
        creacion: { titulo: 'Órdenes por fecha de creación', cols: COL_CREACION, fecha: (o) => diaLocal(o.created_at) || o.fecha_solicitud, base: 'fecha de creación', archivo: 'ASEA_por_fecha_creacion' },
        trimestral: { titulo: 'Inspecciones trimestrales', cols: COL_TRIM, fecha: (o) => diaLocal(o.fecha_fin), base: 'fecha de fin (solo realizadas)', archivo: 'ASEA_trimestral' },
        cobranza: { titulo: 'Cobranza', cols: COL_COBRANZA, fecha: (o) => diaLocal(o.fecha_fin), base: 'fecha de fin (solo realizadas)', archivo: 'ASEA_cobranza' },
    }[PANTALLA];
    const COLS = CFG.cols;
    const soloRealizadas = PANTALLA === 'trimestral' || PANTALLA === 'cobranza';

    // ---------------- Filtros ----------------
    function rango() {
        if (PANTALLA === 'trimestral') {
            const a = $('f-anio').value, t = Number($('f-trim').value);
            const m1 = (t - 1) * 3 + 1, m3 = m1 + 2;
            return [`${a}-${pad(m1)}-01`, `${a}-${pad(m3)}-${pad(new Date(Number(a), m3, 0).getDate())}`];
        }
        return [$('f-desde').value, $('f-hasta').value];
    }
    function filtrosHTML() {
        const hoy = new Date();
        if (PANTALLA === 'trimestral') {
            const anios = Array.from({ length: 5 }, (_, i) => hoy.getFullYear() - i);
            const t = Math.floor(hoy.getMonth() / 3) + 1;
            return `<select id="f-trim" class="${IN}">${[1, 2, 3, 4].map((n) => `<option value="${n}" ${n === t ? 'selected' : ''}>${n}º trimestre</option>`).join('')}</select>
                <select id="f-anio" class="${IN}">${anios.map((a) => `<option>${a}</option>`).join('')}</select>`;
        }
        const ini = `${hoy.getFullYear()}-${pad(hoy.getMonth() + 1)}-01`;
        return `<label class="flex items-center gap-2 text-xs text-gray-400">Desde <input id="f-desde" type="date" value="${ini}" class="${IN}"></label>
            <label class="flex items-center gap-2 text-xs text-gray-400">Hasta <input id="f-hasta" type="date" value="${hoyISO()}" class="${IN}"></label>`;
    }

    function filtrar() {
        const [desde, hasta] = rango();
        const tipo = $('f-tipo').value, term = norm($('f-texto').value.trim());
        filas = ordenes.filter((o) => {
            const f = CFG.fecha(o);
            if (!f || (desde && f < desde) || (hasta && f > hasta)) return false;
            if (soloRealizadas && estado(o) !== 'realizada') return false;
            if (!soloRealizadas && !$('f-canceladas').checked && estado(o) === 'cancelada') return false;
            if (tipo && o.tipo_verificacion !== tipo) return false;
            if (term && !norm([o.folio, o.folio_seguimiento, E(o).permiso, E(o).nombre_comercial, razon(o), usu[o.verificador_id], gerente(o)].join(' ')).includes(term)) return false;
            return true;
        }).sort((a, b) => String(CFG.fecha(a)).localeCompare(String(CFG.fecha(b))) || (a.consecutivo || 0) - (b.consecutivo || 0));
        pagina = 1;
        pintar();
    }

    function pintar() {
        const [desde, hasta] = rango();
        const extra = PANTALLA === 'cobranza' ? ` · <b class="text-white">${filas.filter((o) => !o.autorizada).length}</b> sin autorizar` : '';
        $('rep-resumen').innerHTML = `<span class="text-xl font-bold text-white">Total: <span class="text-emerald-400">${filas.length}</span></span>
            <span class="text-gray-400 text-sm">${dmy(desde)} al ${dmy(hasta)} · por ${CFG.base}${extra}</span>`;
        const paginas = Math.max(1, Math.ceil(filas.length / POR_PAGINA));
        pagina = Math.min(Math.max(1, pagina), paginas);
        const ini = (pagina - 1) * POR_PAGINA;
        $('rep-tbody').innerHTML = filas.length ? filas.slice(ini, ini + POR_PAGINA).map((o, k) => `
            <tr class="border-t border-dark-700 hover:bg-dark-700/30 no-clickable">
                ${COLS.map((c, j) => {
                    const v = c[1](o, ini + k);
                    const celda = j === 0 && o.folio ? `<a href="../../ASEA/inspecciones_asea.html" class="text-brand-yellow font-semibold hover:underline">${esc(v)}</a>` : esc(v ?? '');
                    return `<td class="px-3 py-2.5 text-xs text-gray-300 ${j === 0 ? 'sticky left-0 bg-dark-800' : ''}">${celda || '<span class="text-gray-600">—</span>'}</td>`;
                }).join('')}
            </tr>`).join('')
            : `<tr><td colspan="${COLS.length}" class="py-10 text-center text-gray-500">Sin registros en el periodo.</td></tr>`;
        $('rep-pagina').textContent = `Pág. ${pagina} de ${paginas}`;
        $('rep-prev').disabled = pagina <= 1;
        $('rep-next').disabled = pagina >= paginas;
    }

    // ---------------- Excel ----------------
    function cargarXLSX() {
        if (window.XLSX) return Promise.resolve();
        return new Promise((ok, mal) => {
            const s = document.createElement('script');
            s.src = XLSX_URL; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar el generador de Excel. Revisa tu conexión.'));
            document.head.appendChild(s);
        });
    }
    async function exportar(btn) {
        if (!filas.length) { App.toast('No hay renglones para exportar.', 'warning'); return; }
        btn.disabled = true;
        try {
            await cargarXLSX();
            const datos = [COLS.map((c) => c[0]), ...filas.map((o, i) => COLS.map((c) => c[1](o, i) ?? ''))];
            const ws = XLSX.utils.aoa_to_sheet(datos);
            ws['!cols'] = COLS.map((c) => ({ wch: Math.max(12, Math.min(40, c[0].length + 4)) }));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
            const [desde, hasta] = rango();
            XLSX.writeFile(wb, PANTALLA === 'trimestral' ? `${CFG.archivo}_${$('f-anio').value}-T${$('f-trim').value}.xlsx` : `${CFG.archivo}_${desde}_a_${hasta}.xlsx`);
            App.toast(`Excel con ${filas.length} renglones descargado.`, 'success');
        } catch (err) { App.toast(err.message, 'error'); } finally { btn.disabled = false; }
    }

    // ---------------- Montaje ----------------
    function montar() {
        $('rep-filtros').innerHTML = `
            ${filtrosHTML()}
            <select id="f-tipo" class="${IN}"><option value="">Todos los tipos</option>${Object.entries(TIPO).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
            ${soloRealizadas ? '' : '<label class="flex items-center gap-2 text-xs text-gray-400"><input id="f-canceladas" type="checkbox" class="accent-yellow-500 w-4 h-4"> Incluir canceladas</label>'}
            <button type="button" id="btn-actualizar" class="${BTN} bg-dark-800 border border-dark-700 text-gray-200 hover:bg-dark-700"><i class="ph ph-arrows-clockwise"></i> Actualizar</button>
            <button type="button" id="btn-exportar" class="${BTN} bg-emerald-600 hover:bg-emerald-500 text-white"><i class="ph ph-microsoft-excel-logo"></i> Exportar Excel</button>`;
        $('rep-app').innerHTML = `
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <div id="rep-resumen" class="flex flex-col gap-0.5"></div>
                <div class="relative md:w-80"><i class="ph ph-magnifying-glass absolute left-3 top-2.5 text-gray-400"></i>
                    <input id="f-texto" class="${IN} w-full pl-9" placeholder="Buscar folio, PL, cliente, verificador..."></div>
            </div>
            <div class="bg-dark-800 border border-dark-700 rounded-2xl overflow-x-auto">
                <table class="w-full text-left border-collapse whitespace-nowrap">
                    <thead class="bg-dark-900"><tr>${COLS.map((c, k) => `<th class="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase ${k === 0 ? 'sticky left-0 bg-dark-900' : ''}">${esc(c[0])}</th>`).join('')}</tr></thead>
                    <tbody id="rep-tbody"></tbody>
                </table>
            </div>
            <div class="flex items-center justify-end gap-2 mt-4 text-sm text-gray-400">
                <button type="button" id="rep-prev" class="${BTN} bg-dark-800 border border-dark-700 text-gray-300"><i class="ph ph-caret-left"></i></button>
                <span id="rep-pagina"></span>
                <button type="button" id="rep-next" class="${BTN} bg-dark-800 border border-dark-700 text-gray-300"><i class="ph ph-caret-right"></i></button>
            </div>`;
        document.title = `${CFG.titulo} - Jomar SUDI`;
        ['f-desde', 'f-hasta', 'f-trim', 'f-anio', 'f-tipo', 'f-canceladas'].forEach((id) => $(id)?.addEventListener('change', filtrar));
        $('f-texto').addEventListener('input', filtrar);
        $('btn-actualizar').addEventListener('click', cargarTodo);
        $('btn-exportar').addEventListener('click', (e) => exportar(e.currentTarget));
        $('rep-prev').addEventListener('click', () => { pagina -= 1; pintar(); });
        $('rep-next').addEventListener('click', () => { pagina += 1; pintar(); });
    }

    montar();
    (async () => {
        try { DB = await App.db(); } catch (err) { $('rep-tbody').innerHTML = `<tr><td class="p-6 text-red-400">${esc(err.message)}</td></tr>`; return; }
        cargarTodo();
    })();
})();

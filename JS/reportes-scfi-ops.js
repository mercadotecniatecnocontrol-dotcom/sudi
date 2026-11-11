/**
 * reportes-scfi-ops.js — Reportes operativos de SCFI conectados a Supabase.
 *   data-pantalla="dictamenes"  → reportes/SCFI/reporte_dictamenes.html     (vista sudi_v_scfi_insp_lista)
 *   data-pantalla="comisiones"  → reportes/SCFI/reporte_comisiones.html     (vista sudi_v_scfi_insp_lista)
 *   data-pantalla="equipos"     → reportes/SCFI/reporteequipos.html         (sudi_scfi_equipos, SQL 0014)
 *   data-pantalla="pendientes"  → reportes/SCFI/verificaciones_pendientes.html
 *        (clientes_catalogo con norma SCFI + estaciones_servicio + sudi_v_estacion_mangueras + sudi_v_scfi_insp_lista)
 */
(() => {
    'use strict';

    const PANTALLA = document.currentScript?.dataset.pantalla || 'dictamenes';
    const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    const POR_PAGINA = 25;

    const $ = (id) => document.getElementById(id);
    const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const norm = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const pad = (n) => String(n).padStart(2, '0');
    const fmt = (n) => Number(n || 0).toLocaleString('es-MX');
    const money = (n) => `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const dmy = (f) => { if (!f) return ''; const [a, m, d] = String(f).slice(0, 10).split('-'); return `${d}/${m}/${a}`; };
    const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
    const primero = (...v) => v.find((x) => x !== undefined && x !== null && String(x).trim() !== '') ?? '';
    const IN = 'bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm font-medium text-white focus:outline-none focus:border-brand-yellow [color-scheme:dark]';
    const BTN = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50';
    const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const TIPOS = { periodica_1: 'Periódica 1er periodo', periodica_2: 'Periódica 2do periodo', extraordinaria_1: 'Extraordinaria 1er periodo', extraordinaria_2: 'Extraordinaria 2do periodo', inicial: 'Inicial' };
    const INST = { volumetrico: 'Volumétrica', termometro: 'Termómetro', crono: 'Crono', mesa: 'Mesa', embudo: 'Embudo' };
    const ESTATUS = { programada: 'Programada', en_proceso: 'En proceso', terminada: 'Terminada', cancelada: 'Cancelada' };

    let DB = null, filas = [], pagina = 1, sel = new Set();

    const terminada = (i) => i.estatus === 'terminada' || i.cerrada;
    const mangueras = (i) => Number(i.mangueras_calc ?? i.mangueras ?? 0) || 0;
    const importe = (i) => mangueras(i) * (Number(i.precio_por_manguera) || 0);
    const siNo = (v) => (v === true || v === 'si' || v === 'sí' ? 'Sí' : v === false || v === 'no' ? 'No' : (v ? String(v) : 'No'));
    const anios = () => Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

    async function todo(q) {
        const out = [];
        for (let d = 0; ; d += 1000) {
            const { data, error } = await q().range(d, d + 999);
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

    // =================================================================
    // Pantallas
    // =================================================================
    const P = {};

    // ---------- Dictámenes ----------
    P.dictamenes = {
        titulo: 'Reporte de dictámenes', archivo: 'SCFI_dictamenes',
        filtros: () => `<label class="flex items-center gap-2 text-xs text-gray-400">Desde <input id="f-desde" type="date" value="${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}-01" class="${IN}"></label>
            <label class="flex items-center gap-2 text-xs text-gray-400">Hasta <input id="f-hasta" type="date" value="${hoyISO()}" class="${IN}"></label>
            <select id="f-entregado" class="${IN}"><option value="">Entregados y no</option><option value="si">Entregados</option><option value="no">Sin entregar</option></select>`,
        async cargar() {
            const d = $('f-desde').value, h = $('f-hasta').value;
            const lista = await todo(() => DB.sb.from('sudi_v_scfi_insp_lista').select('*').gte('fecha_inspeccion', d).lte('fecha_inspeccion', h).order('fecha_inspeccion'));
            return lista.filter((i) => i.estatus !== 'cancelada' && terminada(i));
        },
        filtrar: (r) => { const e = $('f-entregado').value; return !e || (siNo(r.dictamen_entregado) === 'Sí') === (e === 'si'); },
        cols: [
            ['Folio', (i) => i.folio], ['Entregado', (i) => siNo(i.dictamen_entregado)], ['Fecha', (i) => dmy(i.fecha_inspeccion)],
            ['Empresa', (i) => primero(i.razon_social, i.cliente_comercial)], ['PL de estación', (i) => i.permiso], ['Estación', (i) => i.estacion_nombre],
            ['Mangueras', mangueras], ['Precio por manguera', (i) => money(i.precio_por_manguera)], ['Importe', (i) => money(importe(i))],
            ['Viáticos', (i) => money(i.viaticos)], ['Facturación', (i) => i.facturacion], ['Factura', (i) => i.factura], ['Inspector', (i) => primero(i.realizo, i.inspector)],
        ],
        resumen: (l) => `<b class="text-white">${fmt(l.length)}</b> dictámenes · <b class="text-white">${fmt(l.reduce((s, i) => s + mangueras(i), 0))}</b> mangueras · importe <b class="text-emerald-400">${money(l.reduce((s, i) => s + importe(i), 0))}</b> · viáticos <b class="text-white">${money(l.reduce((s, i) => s + (Number(i.viaticos) || 0), 0))}</b> · <b class="text-amber-400">${fmt(l.filter((i) => siNo(i.dictamen_entregado) !== 'Sí').length)}</b> sin entregar`,
    };

    // ---------- Comisiones ----------
    P.comisiones = {
        titulo: 'Reporte de comisiones', archivo: 'SCFI_comisiones', seleccion: true,
        filtros: () => `<select id="f-verif" class="${IN}"><option value="">Selecciona verificador</option></select>
            <select id="f-mes" class="${IN}">${MESES.map((m, i) => `<option value="${i + 1}" ${i === new Date().getMonth() ? 'selected' : ''}>${m}</option>`).join('')}</select>
            <select id="f-anio" class="${IN}">${anios().map((a) => `<option>${a}</option>`).join('')}</select>`,
        async preparar() {
            const us = await DB.listar('sudi_usuarios', { select: 'id, nombre_completo, es_inspector, firma_verificador, activo', orden: 'nombre_completo' });
            let vs = us.filter((u) => u.es_inspector || u.firma_verificador);
            if (!vs.length) vs = us;
            $('f-verif').innerHTML = '<option value="">Selecciona verificador</option>' + vs.map((u) => `<option value="${u.id}">${esc(u.nombre_completo)}${u.activo === false ? ' (inactivo)' : ''}</option>`).join('');
        },
        async cargar() {
            const v = $('f-verif').value;
            if (!v) return null;
            const a = Number($('f-anio').value), m = Number($('f-mes').value);
            const lista = await todo(() => DB.sb.from('sudi_v_scfi_insp_lista').select('*')
                .gte('fecha_inspeccion', `${a}-${pad(m)}-01`).lte('fecha_inspeccion', `${a}-${pad(m)}-${pad(new Date(a, m, 0).getDate())}`)
                .or(`realizo_id.eq.${v},inspector_id.eq.${v}`).order('fecha_inspeccion'));
            return lista.filter((i) => i.estatus !== 'cancelada' && terminada(i));
        },
        vacio: 'Selecciona un verificador para ver sus inspecciones terminadas del mes.',
        cols: [
            ['Folio', (i) => i.folio], ['Fecha', (i) => dmy(i.fecha_inspeccion)], ['Estación', (i) => primero(i.estacion_nombre, i.permiso)], ['PL', (i) => i.permiso],
            ['Empresa', (i) => primero(i.razon_social, i.cliente_comercial)], ['Tipo', (i) => TIPOS[i.tipo] || i.tipo], ['Mangueras', mangueras],
            ['Precio por manguera', (i) => money(i.precio_por_manguera)], ['Importe', (i) => money(importe(i))], ['Viáticos', (i) => money(i.viaticos)], ['Horario', (i) => i.calificacion],
        ],
        resumen: (l) => {
            const s = l.filter((i) => sel.has(i.id));
            const base = s.length ? s : [];
            return `<b class="text-white">${fmt(l.length)}</b> inspecciones terminadas · seleccionadas <b class="text-brand-yellow">${fmt(s.length)}</b>:
                <b class="text-white">${fmt(base.reduce((x, i) => x + mangueras(i), 0))}</b> mangueras · importe <b class="text-emerald-400">${money(base.reduce((x, i) => x + importe(i), 0))}</b> · viáticos <b class="text-white">${money(base.reduce((x, i) => x + (Number(i.viaticos) || 0), 0))}</b>`;
        },
    };

    // ---------- Equipos ----------
    const VIG = 365, AVISO = 30;
    const diasRest = (f) => { if (!f) return null; const v = new Date(`${f}T12:00:00`); v.setDate(v.getDate() + VIG); return Math.ceil((v - new Date()) / 86400000); };
    const estInst = (f) => { const d = diasRest(f); return d === null ? 'Sin fecha' : d < 0 ? 'Vencida' : d <= AVISO ? 'Por vencer' : 'Vigente'; };
    const venceEn = (f) => { if (!f) return ''; const v = new Date(`${f}T12:00:00`); v.setDate(v.getDate() + VIG); return `${pad(v.getDate())}/${pad(v.getMonth() + 1)}/${v.getFullYear()}`; };
    P.equipos = {
        titulo: 'Reporte de equipos', archivo: 'SCFI_equipos',
        filtros: () => `<select id="f-est" class="${IN}"><option value="">Todos los estatus</option><option>Vigente</option><option>Por vencer</option><option>Vencida</option><option>Sin fecha</option></select>
            <label class="flex items-center gap-2 text-xs text-gray-400"><input id="f-inactivos" type="checkbox" class="accent-yellow-500 w-4 h-4"> Incluir equipos inactivos</label>`,
        async cargar() {
            const [eqs, us] = await Promise.all([DB.listar('sudi_scfi_equipos', { orden: 'nombre' }), DB.listar('sudi_usuarios', { select: 'id, nombre_completo' })]);
            const u = Object.fromEntries(us.map((x) => [x.id, x.nombre_completo]));
            const out = [];
            eqs.forEach((e) => Object.entries(e.instrumentos || {}).forEach(([k, d]) => out.push({
                id: `${e.id}-${k}`, activo: e.activo !== false, equipo: e.nombre, verificador: u[e.verificador_id] || '', instrumento: INST[k] || k,
                serie: d?.serie || '', certificado: d?.certificado || '', fecha: d?.fecha || '', estatus: estInst(d?.fecha),
            })));
            return out;
        },
        filtrar: (r) => ($('f-inactivos').checked || r.activo) && (!$('f-est').value || r.estatus === $('f-est').value),
        cols: [
            ['Equipo', (r) => r.equipo], ['Verificador', (r) => r.verificador], ['Instrumento', (r) => r.instrumento], ['No. serie', (r) => r.serie],
            ['Certificado', (r) => r.certificado], ['Última calibración', (r) => dmy(r.fecha)], ['Vence', (r) => venceEn(r.fecha)], ['Estatus', (r) => r.estatus],
        ],
        color: (c, r) => (c === 'Estatus' ? ({ Vencida: 'text-red-400 font-semibold', 'Por vencer': 'text-amber-400 font-semibold', Vigente: 'text-emerald-400', 'Sin fecha': 'text-gray-500' }[r.estatus]) : ''),
        resumen: (l) => `<b class="text-white">${fmt(l.length)}</b> instrumentos · <b class="text-red-400">${fmt(l.filter((r) => r.estatus === 'Vencida').length)}</b> vencidos · <b class="text-amber-400">${fmt(l.filter((r) => r.estatus === 'Por vencer').length)}</b> por vencer (vigencia de 12 meses)`,
    };

    // ---------- Verificaciones pendientes ----------
    P.pendientes = {
        titulo: 'Verificaciones pendientes', archivo: 'SCFI_verificaciones_pendientes',
        filtros: () => `<select id="f-periodo" class="${IN}"><option value="1" ${new Date().getMonth() < 6 ? 'selected' : ''}>1er periodo (ene–jun)</option><option value="2" ${new Date().getMonth() >= 6 ? 'selected' : ''}>2do periodo (jul–dic)</option></select>
            <select id="f-anio" class="${IN}">${anios().map((a) => `<option>${a}</option>`).join('')}</select>
            <select id="f-situacion" class="${IN}"><option value="">Todas las pendientes</option><option value="sin">Sin programar</option><option value="prog">Programadas / en proceso</option></select>`,
        async cargar() {
            const a = $('f-anio').value, p = $('f-periodo').value;
            const [d, h] = p === '1' ? [`${a}-01-01`, `${a}-06-30`] : [`${a}-07-01`, `${a}-12-31`];
            const clientes = await DB.listar('clientes_catalogo', { select: 'id, razon_social, nombre_comercial, activo', consulta: (q) => q.contains('normas', ['SCFI']) });
            const cli = Object.fromEntries(clientes.filter((c) => c.activo !== false).map((c) => [String(c.id), c]));
            const ests = (await porIds('estaciones_servicio', 'cliente_id', Object.keys(cli))).filter((e) => e.activo !== false);
            const ids = ests.map((e) => e.id);
            const [mang, insp] = await Promise.all([
                porIds('sudi_v_estacion_mangueras', 'estacion_id', ids, 'estacion_id, dispensario').catch(() => []),
                todo(() => DB.sb.from('sudi_v_scfi_insp_lista').select('id, folio, estatus, cerrada, fecha_inspeccion, estacion_id').gte('fecha_inspeccion', d).lte('fecha_inspeccion', h)),
            ]);
            const nM = {}, nD = {};
            mang.forEach((x) => { const k = String(x.estacion_id); nM[k] = (nM[k] || 0) + 1; (nD[k] ||= new Set()).add(x.dispensario); });
            const porEst = {};
            insp.filter((i) => i.estatus !== 'cancelada').forEach((i) => { (porEst[String(i.estacion_id)] ||= []).push(i); });
            return ests.map((e) => {
                const k = String(e.id), lst = porEst[k] || [];
                if (lst.some(terminada)) return null;
                const prox = lst.sort((x, y) => String(x.fecha_inspeccion).localeCompare(String(y.fecha_inspeccion)))[0];
                const c = cli[String(e.cliente_id)] || {};
                return {
                    id: k, folio: prox?.folio || '', pl: e.permiso || '', estacion: primero(e.nombre_comercial, e.nombre), cliente: primero(c.razon_social, e.razon_social),
                    disp: nD[k]?.size || 0, mang: nM[k] || 0, calle: primero(e.direccion, e.calle, e.domicilio), colonia: e.colonia || '',
                    cp: [primero(e.codigo_postal, e.cp), e.municipio].filter(Boolean).join(' · '),
                    situacion: prox ? `${ESTATUS[prox.estatus] || prox.estatus} ${dmy(prox.fecha_inspeccion)}` : 'Sin programar',
                };
            }).filter(Boolean).sort((x, y) => x.cliente.localeCompare(y.cliente, 'es') || x.pl.localeCompare(y.pl, 'es'));
        },
        filtrar: (r) => { const s = $('f-situacion').value; return !s || (s === 'sin' ? !r.folio : Boolean(r.folio)); },
        cols: [
            ['Folio', (r) => r.folio], ['PL', (r) => r.pl], ['Estación', (r) => r.estacion], ['Cliente', (r) => r.cliente], ['Dispensarios', (r) => r.disp],
            ['Mangueras', (r) => r.mang], ['Calle', (r) => r.calle], ['Colonia', (r) => r.colonia], ['CP / Ubicación', (r) => r.cp], ['Situación', (r) => r.situacion],
        ],
        color: (c, r) => (c === 'Situación' ? (r.folio ? 'text-amber-400' : 'text-red-400') : ''),
        resumen: (l) => `<b class="text-white">${fmt(l.length)}</b> estaciones SCFI sin verificación terminada en el periodo · <b class="text-red-400">${fmt(l.filter((r) => !r.folio).length)}</b> sin programar · <b class="text-white">${fmt(l.reduce((s, r) => s + r.mang, 0))}</b> mangueras`,
    };

    const CFG = P[PANTALLA];
    const COLS = CFG.cols;
    let base = [];

    // =================================================================
    // Motor común
    // =================================================================
    async function cargar() {
        const cuerpo = $('rep-tbody');
        cuerpo.innerHTML = `<tr><td colspan="${COLS.length + 1}" class="py-10 text-center text-gray-500"><i class="ph ph-spinner animate-spin"></i> Cargando...</td></tr>`;
        try {
            const r = await CFG.cargar();
            if (r === null) { base = []; filas = []; sel.clear(); $('rep-resumen').innerHTML = ''; cuerpo.innerHTML = `<tr><td colspan="${COLS.length + 1}" class="py-10 text-center text-gray-500">${CFG.vacio}</td></tr>`; return; }
            base = r;
            sel = new Set();
            filtrar();
        } catch (err) {
            const falta = /sudi_scfi_equipos/.test(err.message) ? ' Falta correr el SQL 0014.' : '';
            cuerpo.innerHTML = `<tr><td colspan="${COLS.length + 1}" class="py-10 text-center text-red-400">${esc(err.message)}${falta}</td></tr>`;
        }
    }

    function filtrar() {
        const term = norm($('f-texto').value.trim());
        filas = base.filter((r) => (!CFG.filtrar || CFG.filtrar(r)) && (!term || norm(COLS.map((c) => c[1](r)).join(' ')).includes(term)));
        pagina = 1;
        pintar();
    }

    function pintar() {
        $('rep-resumen').innerHTML = CFG.resumen(filas);
        const paginas = Math.max(1, Math.ceil(filas.length / POR_PAGINA));
        pagina = Math.min(Math.max(1, pagina), paginas);
        const vis = filas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
        $('rep-tbody').innerHTML = vis.length ? vis.map((r) => `
            <tr data-id="${esc(r.id)}" class="border-t border-dark-700 hover:bg-dark-700/30 no-clickable">
                ${CFG.seleccion ? `<td class="px-3 py-2.5 sticky left-0 bg-dark-800"><input type="checkbox" data-sel ${sel.has(r.id) ? 'checked' : ''} class="accent-yellow-500 w-4 h-4"></td>` : ''}
                ${COLS.map((c, j) => {
                    const v = c[1](r);
                    const cls = CFG.color ? CFG.color(c[0], r) || '' : '';
                    const fija = !CFG.seleccion && j === 0 ? 'sticky left-0 bg-dark-800' : '';
                    return `<td class="px-3 py-2.5 text-xs text-gray-300 ${cls} ${fija} ${j === 0 ? 'font-semibold text-white' : ''}">${v === '' || v == null ? '<span class="text-gray-600">—</span>' : esc(v)}</td>`;
                }).join('')}
            </tr>`).join('')
            : `<tr><td colspan="${COLS.length + 1}" class="py-10 text-center text-gray-500">Sin registros.</td></tr>`;
        $('rep-pagina').textContent = `Pág. ${pagina} de ${paginas}`;
        $('rep-prev').disabled = pagina <= 1;
        $('rep-next').disabled = pagina >= paginas;
    }

    function cargarXLSX() {
        if (window.XLSX) return Promise.resolve();
        return new Promise((ok, mal) => {
            const s = document.createElement('script');
            s.src = XLSX_URL; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar el generador de Excel. Revisa tu conexión.'));
            document.head.appendChild(s);
        });
    }
    async function exportar(btn) {
        const lista = CFG.seleccion && sel.size ? filas.filter((r) => sel.has(r.id)) : filas;
        if (!lista.length) { App.toast('No hay renglones para exportar.', 'warning'); return; }
        btn.disabled = true;
        try {
            await cargarXLSX();
            const ws = XLSX.utils.aoa_to_sheet([COLS.map((c) => c[0]), ...lista.map((r) => COLS.map((c) => c[1](r) ?? ''))]);
            ws['!cols'] = COLS.map((c) => ({ wch: Math.max(12, Math.min(40, c[0].length + 6)) }));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Reporte');
            let sufijo = hoyISO();
            if (PANTALLA === 'comisiones') sufijo = `${($('f-verif').selectedOptions[0]?.text || '').replace(/\s+/g, '_')}_${$('f-anio').value}-${pad($('f-mes').value)}`;
            if (PANTALLA === 'pendientes') sufijo = `${$('f-anio').value}-P${$('f-periodo').value}`;
            if (PANTALLA === 'dictamenes') sufijo = `${$('f-desde').value}_a_${$('f-hasta').value}`;
            XLSX.writeFile(wb, `${CFG.archivo}_${sufijo}.xlsx`);
            App.toast(`Excel con ${lista.length} renglones descargado.`, 'success');
        } catch (err) { App.toast(err.message, 'error'); } finally { btn.disabled = false; }
    }

    function montar() {
        $('rep-filtros').innerHTML = `${CFG.filtros()}
            <button type="button" id="btn-actualizar" class="${BTN} bg-dark-800 border border-dark-700 text-gray-200 hover:bg-dark-700"><i class="ph ph-arrows-clockwise"></i> Actualizar</button>
            <button type="button" id="btn-exportar" class="${BTN} bg-emerald-600 hover:bg-emerald-500 text-white"><i class="ph ph-microsoft-excel-logo"></i> Exportar Excel</button>`;
        $('rep-app').innerHTML = `
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
                <p id="rep-resumen" class="text-sm text-gray-400 leading-relaxed"></p>
                <div class="flex items-center gap-2 shrink-0">
                    ${CFG.seleccion ? `<button type="button" id="btn-todo" class="${BTN} bg-dark-800 border border-dark-700 text-gray-300 hover:text-white">Marcar todo</button><button type="button" id="btn-nada" class="${BTN} bg-dark-800 border border-dark-700 text-gray-300 hover:text-white">Desmarcar</button>` : ''}
                    <div class="relative md:w-72"><i class="ph ph-magnifying-glass absolute left-3 top-2.5 text-gray-400"></i><input id="f-texto" class="${IN} w-full pl-9" placeholder="Buscar..."></div>
                </div>
            </div>
            <div class="bg-dark-800 border border-dark-700 rounded-2xl overflow-x-auto">
                <table class="w-full text-left border-collapse whitespace-nowrap">
                    <thead class="bg-dark-900"><tr>${CFG.seleccion ? '<th class="px-3 py-3 sticky left-0 bg-dark-900 w-10"></th>' : ''}${COLS.map((c, k) => `<th class="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase ${!CFG.seleccion && k === 0 ? 'sticky left-0 bg-dark-900' : ''}">${esc(c[0])}</th>`).join('')}</tr></thead>
                    <tbody id="rep-tbody"></tbody>
                </table>
            </div>
            <div class="flex items-center justify-end gap-2 mt-4 text-sm text-gray-400">
                <button type="button" id="rep-prev" class="${BTN} bg-dark-800 border border-dark-700 text-gray-300"><i class="ph ph-caret-left"></i></button>
                <span id="rep-pagina"></span>
                <button type="button" id="rep-next" class="${BTN} bg-dark-800 border border-dark-700 text-gray-300"><i class="ph ph-caret-right"></i></button>
            </div>
            ${CFG.seleccion ? '<p class="text-[11px] text-gray-500 mt-3">Marca las inspecciones que entran en la comisión; Exportar Excel baja solo las marcadas (o todas si no hay ninguna marcada).</p>' : ''}`;
        document.title = `${CFG.titulo} - Jomar SUDI`;

        const recargan = { dictamenes: ['f-desde', 'f-hasta'], comisiones: ['f-verif', 'f-mes', 'f-anio'], pendientes: ['f-periodo', 'f-anio'], equipos: [] }[PANTALLA];
        recargan.forEach((id) => $(id)?.addEventListener('change', cargar));
        ['f-entregado', 'f-est', 'f-inactivos', 'f-situacion'].forEach((id) => $(id)?.addEventListener('change', filtrar));
        $('f-texto').addEventListener('input', filtrar);
        $('btn-actualizar').addEventListener('click', cargar);
        $('btn-exportar').addEventListener('click', (e) => exportar(e.currentTarget));
        $('rep-prev').addEventListener('click', () => { pagina -= 1; pintar(); });
        $('rep-next').addEventListener('click', () => { pagina += 1; pintar(); });
        if (CFG.seleccion) {
            $('btn-todo').addEventListener('click', () => { filas.forEach((r) => sel.add(r.id)); pintar(); });
            $('btn-nada').addEventListener('click', () => { sel.clear(); pintar(); });
            $('rep-tbody').addEventListener('change', (e) => {
                const c = e.target.closest('[data-sel]');
                if (!c) return;
                const id = c.closest('[data-id]').dataset.id;
                if (c.checked) sel.add(id); else sel.delete(id);
                $('rep-resumen').innerHTML = CFG.resumen(filas);
            });
        }
    }

    montar();
    (async () => {
        try { DB = await App.db(); } catch (err) { $('rep-tbody').innerHTML = `<tr><td class="p-6 text-red-400">${esc(err.message)}</td></tr>`; return; }
        if (CFG.preparar) { try { await CFG.preparar(); } catch (err) { App.toast(err.message, 'error'); } }
        cargar();
    })();
})();

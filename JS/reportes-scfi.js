/**
 * reportes-scfi.js — Reportes de SCFI conectados a Supabase (puntos 22 y 23).
 *   <script src="../../JS/reportes-scfi.js" data-pantalla="profeco" defer>  → reportes/SCFI/reporte_profeco.html
 *   <script src="../../JS/reportes-scfi.js" data-pantalla="bombas"  defer>  → reportes/SCFI/reporte_ema.html
 * Datos: vista sudi_v_scfi_lados_reporte (supabase/0008_sudi_reportes_profeco_bombas.sql),
 * un renglón por lado verificado. Exporta a Excel con el mismo orden de columnas que los machotes de Calidad.
 */
(() => {
    'use strict';

    const yo = document.currentScript;
    const PANTALLA = yo?.dataset.pantalla || 'profeco';
    const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

    const $ = (id) => document.getElementById(id);
    const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmtNum = (n) => Number(n || 0).toLocaleString('es-MX');
    const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const IN = 'bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 text-sm font-medium text-white focus:outline-none focus:border-brand-yellow [color-scheme:dark]';
    const BTN = 'inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50';

    const TIPO_SOLICITUD = (t) => (String(t).startsWith('periodica') ? 'Periódica' : String(t).startsWith('extraordinaria') ? 'Extraordinaria' : 'Inicial');
    const fechaDMY = (v) => { if (!v) return ''; const [a, m, d] = String(v).slice(0, 10).split('-'); return `${d}/${m}/${a}`; };
    const fechaExcel = (v) => (v ? new Date(`${String(v).slice(0, 10)}T12:00:00`) : '');
    const folioHolo = (r) => (r.holograma_folio ? `U${r.holograma_folio}` : '');
    const numReporte = (f) => { if (!f) return ''; const [a, m, d] = String(f).slice(0, 10).split('-'); return `${a}${m}-${Number(d) <= 15 ? 1 : 2}`; };
    const pad = (n) => String(n).padStart(2, '0');
    const finDeMes = (a, m) => new Date(a, m, 0).getDate();

    // ---------------------------------------------------------------
    // WGS84 → UTM (para la plantilla de bombas)
    // ---------------------------------------------------------------
    function utm(lat, lng) {
        if (lat == null || lng == null || lat === '' || lng === '') return null;
        lat = Number(lat); lng = Number(lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        const a = 6378137, f = 1 / 298.257223563, k0 = 0.9996;
        const e2 = f * (2 - f), ep2 = e2 / (1 - e2);
        const zona = Math.floor((lng + 180) / 6) + 1;
        const lon0 = ((zona - 1) * 6 - 180 + 3) * Math.PI / 180;
        const phi = lat * Math.PI / 180, lam = lng * Math.PI / 180;
        const N = a / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
        const T = Math.tan(phi) ** 2, C = ep2 * Math.cos(phi) ** 2, A = Math.cos(phi) * (lam - lon0);
        const M = a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi
            - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi)
            + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi)
            - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi));
        const este = k0 * N * (A + (1 - T + C) * A ** 3 / 6 + (5 - 18 * T + T ** 2 + 72 * C - 58 * ep2) * A ** 5 / 120) + 500000;
        let norte = k0 * (M + N * Math.tan(phi) * (A ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * A ** 4 / 24
            + (61 - 58 * T + T ** 2 + 600 * C - 330 * ep2) * A ** 6 / 720));
        if (lat < 0) norte += 10000000;
        return { norte: Math.round(norte * 100) / 100, este: Math.round(este * 100) / 100, zona, hemisferio: lat >= 0 ? 'N' : 'S' };
    }

    // ---------------------------------------------------------------
    // Columnas de cada reporte (mismo orden que los machotes)
    // ---------------------------------------------------------------
    let CFG = { unidad_inspeccion: 'JOMAR VERIFICACIONES S DE RL DE CV', numero_acreditacion: 'UVIM 131', instrumento_bombas: 'Bombas despachadoras de gasolina' };

    const COL_PROFECO = [
        ['NO. DE UVIM', () => CFG.numero_acreditacion],
        ['NO. DE REPORTE TRIMESTRAL', (r) => numReporte(r.fecha_inspeccion)],
        ['REFERENCIA', (r) => r.folio],
        ['TIPO DE SOLICITUD', (r) => TIPO_SOLICITUD(r.tipo)],
        ['FECHA DE LA VISITA', (r) => fechaExcel(r.fecha_inspeccion), (r) => fechaDMY(r.fecha_inspeccion)],
        ['NO. DE ESTACIÓN', (r) => r.permiso, null, true],
        ['RAZÓN SOCIAL', (r) => r.razon_social, null, true],
        ['CALLE Y NÚMERO', (r) => r.calle_numero, null, true],
        ['COLONIA', (r) => r.colonia],
        ['MUNICIPIO/DELEGACIÓN', (r) => r.municipio, null, true],
        ['ENTIDAD FEDERATIVA', (r) => String(r.estado || '').toUpperCase(), null, true],
        ['CÓDIGO POSTAL', (r) => r.codigo_postal, null, true],
        ['TIPO DE INSTRUMENTO VERIFICADO', (r) => (r.tipo_instrumento === 'medidor_alto_flujo' ? 'Medidor' : 'Dispensario')],
        ['TIPO DE BÁSCULA', (r) => r.tipo_bascula || 'NA'],
        ['MARCA', (r) => r.marca, null, true],
        ['MODELO', (r) => r.modelo, null, true],
        ['SERIE', (r) => r.serie, null, true],
        ['LADO', (r) => r.lado, null, true],
        ['TIPO DE COMBUSTIBLE', (r) => r.combustible, null, true],
        ['FOLIO DEL HOLOGRAMA', folioHolo, null, true],
        ['FOLIO DE LA ETIQUETA UVA', (r) => r.distintivo_folio ?? '', null, true],
    ];

    const semestre = (f) => (Number(String(f || '').slice(5, 7)) <= 6 ? 'Primer semestre' : 'Segundo semestre');
    const COL_BOMBAS = [
        ['Unidad de inspección', () => CFG.unidad_inspeccion],
        ['Número de acreditación', () => CFG.numero_acreditacion],
        ['Periodo del reporte', (r) => `${String(r.fecha_inspeccion || '').slice(0, 4)}/T${semestre(r.fecha_inspeccion) === 'Primer semestre' ? 1 : 2}`],
        ['Instrumento', () => CFG.instrumento_bombas],
        ['Holograma PROFECO', folioHolo, null, true],
        ['Año holograma', (r) => (r.holograma_folio ? Number(String(r.holograma_folio).slice(0, 4)) : '')],
        ['Periodo', (r) => semestre(r.fecha_inspeccion)],
        ['Distintivo UI', (r) => r.distintivo_folio ?? '', null, true],
        ['No. solicitud', (r) => r.folio],
        ['Fecha de solicitud', (r) => fechaExcel(r.fecha_solicitud), (r) => fechaDMY(r.fecha_solicitud)],
        ['Tipo de inspección', (r) => TIPO_SOLICITUD(r.tipo)],
        ['Fecha de inspección', (r) => fechaExcel(r.fecha_inspeccion), (r) => fechaDMY(r.fecha_inspeccion)],
        ['Número de dictamen', (r) => r.folio],
        ['Inspectores', (r) => String(r.inspector || '').toUpperCase(), null, true],
        ['Personal de apoyo', (r) => String(r.personal_apoyo || '').toUpperCase()],
        ['Razón social solicitante', (r) => r.razon_social, null, true],
        ['RFC', (r) => r.rfc, null, true],
        ['Calle y número', (r) => r.calle_numero, null, true],
        ['Colonia', (r) => r.colonia],
        ['CP', (r) => r.codigo_postal, null, true],
        ['Municipio', (r) => r.municipio_clave_ema ?? '', (r) => (r.municipio_clave_ema ? `${r.municipio_clave_ema} (${r.municipio})` : (r.municipio || '')), true],
        ['Estado', (r) => String(r.estado || '').toUpperCase(), null, true],
        ['Coordenadas geográficas latitud', (r) => (r.lat != null ? Number(r.lat) : ''), null, true],
        ['Coordenadas geográficas longitud', (r) => (r.lng != null ? Number(r.lng) : ''), null, true],
        ['Coordenadas UTM Norte', (r) => utm(r.lat, r.lng)?.norte ?? ''],
        ['Coordenadas UTM Este', (r) => utm(r.lat, r.lng)?.este ?? ''],
        ['Coordenadas UTM Zona', (r) => utm(r.lat, r.lng)?.zona ?? ''],
        ['Coordenadas UTM Hemisferio', (r) => utm(r.lat, r.lng)?.hemisferio ?? ''],
        ['Marca', (r) => r.marca, null, true],
        ['Modelo', (r) => r.modelo, null, true],
        ['Serie', (r) => r.serie, null, true],
        ['Número de aprobación', (r) => r.numero_aprobacion],
        ['Año de aprobación', (r) => r.anio_aprobacion ?? ''],
        ['No. estación de servicio', (r) => r.numero_estacion || r.permiso, null, true],
        ['Lado', (r) => r.lado, null, true],
        ['Tipo de combustible', (r) => r.combustible, null, true],
        ['Numero de precinto', (r) => r.precinto_folio ?? ''],
    ];
    const COLS = PANTALLA === 'bombas' ? COL_BOMBAS : COL_PROFECO;
    const valorVista = (c, r) => { const v = (c[2] || c[1])(r); return v instanceof Date ? fechaDMY(v.toISOString()) : v; };

    // ---------------------------------------------------------------
    // Pantalla
    // ---------------------------------------------------------------
    let DB = null;
    let filas = [];
    let pagina = 1;
    const POR_PAGINA = 50;

    function filtrosHTML() {
        const h = new Date();
        const anios = [h.getFullYear() - 2, h.getFullYear() - 1, h.getFullYear(), h.getFullYear() + 1];
        const selAnio = `<select id="f-anio" class="${IN} w-28">${anios.map((a) => `<option ${a === h.getFullYear() ? 'selected' : ''}>${a}</option>`).join('')}</select>`;
        if (PANTALLA === 'bombas') {
            return `
                <select id="f-periodo" class="${IN} w-48">
                    <option value="1">Primer semestre</option>
                    <option value="2" ${h.getMonth() >= 6 ? 'selected' : ''}>Segundo semestre</option>
                    <option value="r">Rango de fechas</option>
                </select>
                ${selAnio}
                <span id="f-rango" class="hidden items-center gap-2"><input type="date" id="f-desde" class="${IN}"><input type="date" id="f-hasta" class="${IN}"></span>`;
        }
        return `
            <select id="f-mes" class="${IN} w-40">${MESES.map((m, i) => `<option value="${i + 1}" ${i === h.getMonth() ? 'selected' : ''}>${m}</option>`).join('')}</select>
            <select id="f-periodo" class="${IN} w-40">
                <option value="1" ${h.getDate() <= 15 ? 'selected' : ''}>Del 1 al 15</option>
                <option value="2" ${h.getDate() > 15 ? 'selected' : ''}>Del 16 al fin de mes</option>
                <option value="m">Mes completo</option>
            </select>
            ${selAnio}`;
    }

    function rango() {
        const a = Number($('f-anio').value);
        if (PANTALLA === 'bombas') {
            const p = $('f-periodo').value;
            if (p === 'r') return [$('f-desde').value, $('f-hasta').value];
            return p === '1' ? [`${a}-01-01`, `${a}-06-30`] : [`${a}-07-01`, `${a}-12-31`];
        }
        const m = Number($('f-mes').value), p = $('f-periodo').value;
        const ini = p === '2' ? 16 : 1, fin = p === '1' ? 15 : finDeMes(a, m);
        return [`${a}-${pad(m)}-${pad(ini)}`, `${a}-${pad(m)}-${pad(fin)}`];
    }

    async function cargar() {
        const [desde, hasta] = rango();
        const cuerpo = $('rep-tbody');
        if (!desde || !hasta) { cuerpo.innerHTML = `<tr><td colspan="${COLS.length}" class="py-10 text-center text-gray-500">Elige el rango de fechas.</td></tr>`; return; }
        cuerpo.innerHTML = `<tr><td colspan="${COLS.length}" class="py-10 text-center text-gray-500"><i class="ph ph-spinner animate-spin"></i> Cargando...</td></tr>`;
        try {
            filas = [];
            for (let d = 0; ; d += 1000) {
                let q = DB.sb.from('sudi_v_scfi_lados_reporte').select('*')
                    .gte('fecha_inspeccion', desde).lte('fecha_inspeccion', hasta);
                if ($('f-cerradas').checked) q = q.eq('cerrada', true);
                const { data, error } = await q.order('fecha_inspeccion').order('consecutivo').order('orden').range(d, d + 999);
                if (error) throw new Error(DB.mensajeError(error));
                filas.push(...data);
                if (data.length < 1000) break;
            }
            pagina = 1;
            pintar();
        } catch (err) {
            cuerpo.innerHTML = `<tr><td colspan="${COLS.length}" class="py-10 text-center text-red-400">${esc(err.message)}</td></tr>`;
        }
    }

    function faltantes(r) { return COLS.filter((c) => c[3] && (valorVista(c, r) === '' || valorVista(c, r) == null)).map((c) => c[0]); }

    function pintar() {
        const [desde, hasta] = rango();
        const conFaltas = filas.filter((r) => faltantes(r).length);
        const dict = new Set(filas.map((r) => r.folio)).size;
        $('rep-resumen').innerHTML = `
            <span class="text-gray-300"><b class="text-white">${fmtNum(filas.length)}</b> lados de <b class="text-white">${fmtNum(dict)}</b> dictámenes · ${fechaDMY(desde)} al ${fechaDMY(hasta)}</span>
            ${conFaltas.length ? `<span class="text-amber-400"><i class="ph ph-warning"></i> ${fmtNum(conFaltas.length)} renglón(es) con datos faltantes (celdas en rojo). Complétalos en la estación, sus dispensarios o la verificación.</span>`
                : (filas.length ? '<span class="text-emerald-400"><i class="ph ph-check-circle"></i> Todos los renglones están completos.</span>' : '')}`;
        const paginas = Math.max(1, Math.ceil(filas.length / POR_PAGINA));
        pagina = Math.min(Math.max(1, pagina), paginas);
        const vis = filas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
        $('rep-tbody').innerHTML = vis.length ? vis.map((r) => `
            <tr class="border-t border-dark-700 hover:bg-dark-700/30 no-clickable">
                ${COLS.map((c, k) => {
                    const v = valorVista(c, r);
                    const falta = c[3] && (v === '' || v == null);
                    const enlace = c[0].match(/REFERENCIA|No. solicitud/i) ? `<a href="../../SCFI/inspecciones.html?folio=${encodeURIComponent(r.folio)}" class="text-brand-yellow hover:underline">${esc(v)}</a>` : esc(v);
                    return `<td class="px-3 py-2 text-xs ${falta ? 'bg-red-500/15 text-red-300' : 'text-gray-300'} ${k === 0 ? 'sticky left-0 bg-dark-800' : ''}">${falta ? 'FALTA' : enlace}</td>`;
                }).join('')}
            </tr>`).join('')
            : `<tr><td colspan="${COLS.length}" class="py-10 text-center text-gray-500">Sin lados verificados en el periodo${$('f-cerradas').checked ? ' (solo verificaciones cerradas)' : ''}.</td></tr>`;
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
        if (!filas.length) { App.toast('No hay renglones para exportar.', 'warning'); return; }
        const conFaltas = filas.filter((r) => faltantes(r).length).length;
        if (conFaltas && !confirm(`${conFaltas} renglón(es) tienen datos faltantes. ¿Exportar de todos modos?`)) return;
        btn.disabled = true;
        try {
            await cargarXLSX();
            const datos = [COLS.map((c) => c[0]), ...filas.map((r) => COLS.map((c) => c[1](r) ?? ''))];
            const ws = XLSX.utils.aoa_to_sheet(datos, { cellDates: true, dateNF: 'dd/mm/yyyy' });
            ws['!cols'] = COLS.map((c) => ({ wch: Math.max(12, Math.min(40, c[0].length + 2)) }));
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, PANTALLA === 'bombas' ? 'Bombas' : 'Hoja1');
            const [desde, hasta] = rango();
            XLSX.writeFile(wb, PANTALLA === 'bombas'
                ? `Plantilla_bombas_${desde}_a_${hasta}.xlsx`
                : `Reporte_PROFECO_${numReporte(desde)}${$('f-periodo').value === 'm' ? '-mes' : ''}.xlsx`);
            App.toast(`Excel con ${fmtNum(filas.length)} renglones descargado.`, 'success');
        } catch (err) { App.toast(err.message, 'error'); } finally { btn.disabled = false; }
    }

    function montar() {
        const titulo = PANTALLA === 'bombas' ? 'Plantilla de bombas (EMA)' : 'Reporte PROFECO';
        $('rep-filtros').innerHTML = `
            ${filtrosHTML()}
            <label class="flex items-center gap-2 text-xs text-gray-400"><input id="f-cerradas" type="checkbox" checked class="accent-yellow-500 w-4 h-4"> Solo verificaciones cerradas</label>
            <button type="button" id="btn-buscar" class="${BTN} bg-dark-800 border border-dark-700 text-gray-200 hover:bg-dark-700"><i class="ph ph-magnifying-glass"></i> Buscar</button>
            <button type="button" id="btn-exportar" class="${BTN} bg-emerald-600 hover:bg-emerald-500 text-white"><i class="ph ph-microsoft-excel-logo"></i> Exportar Excel</button>`;
        $('rep-app').innerHTML = `
            <div id="rep-resumen" class="flex flex-col gap-1 text-sm mb-4"></div>
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
            </div>
            <p class="text-[11px] text-gray-500 mt-4">${PANTALLA === 'bombas'
                ? 'Un renglón por lado verificado. La clave de municipio sale del catálogo EMA (Chihuahua 217, Juárez 235…); las coordenadas UTM se calculan de la latitud y longitud de la estación.'
                : 'Un renglón por lado verificado. "No. de reporte" = año, mes y quincena de la visita (ej. 202610-2).'}</p>`;
        document.title = `${titulo} - Jomar SUDI`;
        $('btn-buscar').addEventListener('click', cargar);
        $('btn-exportar').addEventListener('click', (e) => exportar(e.currentTarget));
        $('rep-prev').addEventListener('click', () => { pagina -= 1; pintar(); });
        $('rep-next').addEventListener('click', () => { pagina += 1; pintar(); });
        ['f-mes', 'f-periodo', 'f-anio', 'f-cerradas', 'f-desde', 'f-hasta'].forEach((id) => $(id)?.addEventListener('change', () => {
            if (id === 'f-periodo' && $('f-rango')) { const r = $('f-periodo').value === 'r'; $('f-rango').classList.toggle('hidden', !r); $('f-rango').classList.toggle('flex', r); }
            cargar();
        }));
    }

    montar();
    (async () => {
        try { DB = await App.db(); } catch (err) { $('rep-tbody').innerHTML = `<tr><td class="p-6 text-red-400">${esc(err.message)}</td></tr>`; return; }
        try {
            const cfg = await DB.listar('sudi_config');
            cfg.forEach((c) => { if (c.valor) CFG[c.clave] = c.valor; });
        } catch (_) { /* se usan los valores por defecto */ }
        cargar();
    })();

    window.SUDIReportes = { utm, numReporte };
})();

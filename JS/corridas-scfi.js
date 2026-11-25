/**
 * corridas-scfi.js — Captura de corridas metrológicas por lado (NOM-005-SCFI-2017).
 * 3 gastos (máximo, medio, mínimo) × 3 corridas: Lc, E.Rep, T(min), T(°C) y lectura del dispensario (mL).
 * Cálculo:  Cts = 1 + α(Tmv − 20), α = 0.0000477
 *           Vcmv = (V20 + Lc·Kc)·Cts          (mL)
 *           E = I − Vcmv                       (mL)
 *           qv = Vcmv / T                      (L/min)
 *           R = Emax − Emin (por gasto); se reporta el mayor.
 * Guarda en sudi_scfi_instrumentos.pruebas (rpc sudi_scfi_guardar_pruebas, SQL 0021).
 * Lo consume JS/formatos-scfi.js (bloqueMetrologico) para las hojas 3–4 del Dictamen.
 * Uso: SUDICorridas.abrir({ DB, inspeccion, lado, soloLectura, onGuardado })
 */
(() => {
    'use strict';
    const ALFA = 0.0000477;
    const GASTOS = [['max', 'Gasto máximo'], ['med', 'Gasto medio'], ['min', 'Gasto mínimo']];
    const CAMPOS = [['lc', 'Lc (div)'], ['rep', 'E.Rep (mL)'], ['t', 'T (min)'], ['temp', 'T (°C)'], ['lect', 'Dispensario (mL)']];
    const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const num = (x) => (x === '' || x === null || x === undefined || !Number.isFinite(Number(x)) ? null : Number(x));
    const r = (x, d) => (x === null ? null : Number(x.toFixed(d)));
    const f = (x, d = 1) => (x === null || x === undefined ? '—' : Number(x).toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d }));

    // Equipo patrón: el elegido en General; si no hay, el del verificador que realizó; si no, el del que firma.
    async function patron(DB, insp) {
        const { data, error } = await DB.sb.from('sudi_scfi_equipos').select('*').eq('activo', true);
        if (error) throw new Error(DB.mensajeError ? DB.mensajeError(error) : error.message);
        const eq = (insp.equipo_id && (data || []).find((e) => e.id === insp.equipo_id)) || (data || []).find((e) => e.verificador_id === insp.realizo_id) || (data || []).find((e) => e.verificador_id === insp.inspector_id) || null;
        const vol = eq?.instrumentos?.volumetrico || null;
        if (!vol) return null;
        let v20 = num(vol.valor_certificado) ?? num(vol.nominal_ml);
        if (v20 !== null && v20 < 1000) v20 *= 1000;          // capturado en litros → mL
        let kc = num(vol.kc) ?? 10;                             // mL por división (escala de 10 mL)
        if (kc < 1) kc *= 1000;                                 // capturado en L/div → mL/div
        // Límites: los del equipo; si no están capturados, los de la NOM con Vn = nominal (L)
        const vn = (num(vol.nominal_ml) ?? v20 ?? 20000) / 1000;
        const emtEq = num(insp.tipo === 'inicial' ? (num(vol.emt_inicial) ?? vol.emt) : vol.emt);
        const emt = emtEq ?? (insp.tipo === 'inicial' ? 10 + 2 * vn : 20 + 4 * vn);
        const repetibilidad = num(vol.repetibilidad) ?? 20 + 2 * vn;
        return { nombre: eq.nombre || '', serie: vol.id_interna || vol.serie || '', v20, kc, emt: r(emt, 1), repetibilidad: r(repetibilidad, 1) };
    }

    function calcular(entrada, pat) {
        const out = { version: 1 };
        const todosE = [], rs = [];
        GASTOS.forEach(([k]) => {
            const g = entrada[k] || {};
            const vcmv = [], e = [], qv = [], disp = [];
            for (let n = 0; n < 3; n++) {
                const lc = num(g.lc?.[n]), temp = num(g.temp?.[n]), t = num(g.t?.[n]), I = num(g.lect?.[n]);
                let V = null;
                if (pat?.v20 !== null && pat?.v20 !== undefined && lc !== null && temp !== null) V = (pat.v20 + lc * pat.kc) * (1 + ALFA * (temp - 20));
                const E = V !== null && I !== null ? I - V : null;
                vcmv.push(r(V, 1)); e.push(r(E, 1)); qv.push(V !== null && t ? r(V / 1000 / t, 2) : null);
                disp.push(I, r(E, 1));
                if (E !== null) todosE.push(E);
            }
            const ev = e.filter((x) => x !== null);
            const R = ev.length >= 2 ? r(Math.max(...ev) - Math.min(...ev), 1) : null;
            if (R !== null) rs.push(R);
            out[k] = { lc: (g.lc || []).map(num), rep: (g.rep || []).map(num), t: (g.t || []).map(num), temp: (g.temp || []).map(num), lect: (g.lect || []).map(num), disp, vcmv, e, qv, r: R };
        });
        out.e_max = todosE.length ? r(todosE.reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a)), 1) : null;
        out.rep_resultado = rs.length ? Math.max(...rs) : null;
        out.emt = pat?.emt ?? null;
        out.repetibilidad = pat?.repetibilidad ?? null;
        out.cumple_emt = out.e_max !== null && out.emt !== null ? Math.abs(out.e_max) <= out.emt : null;
        out.cumple_rep = out.rep_resultado !== null && out.repetibilidad !== null ? out.rep_resultado <= out.repetibilidad : null;
        out.patron = pat ? { serie: pat.serie, v20_ml: pat.v20, kc_ml: pat.kc, alfa: ALFA } : null;
        return out;
    }

    const IN = 'w-full px-2 py-1 text-xs text-right bg-dark-900 border border-dark-700 rounded text-white focus:outline-none focus:border-brand-yellow disabled:opacity-70';
    const veredicto = (ok) => (ok === null ? '<span class="text-gray-500">—</span>' : ok ? '<span class="text-emerald-400 font-semibold">Cumple</span>' : '<span class="text-red-400 font-semibold">No cumple</span>');

    async function abrir({ DB, inspeccion, lado, soloLectura = false, onGuardado }) {
        if (!lado?.id) { App.toast('Primero da "Guardar lados"; después captura las corridas.', 'warning'); return; }
        let pat = null, avisoPat = '';
        try { pat = await patron(DB, inspeccion); } catch (err) { avisoPat = err.message; }
        if (!pat) avisoPat ||= 'No hay equipo patrón con Medida Volumétrica: elígelo en la pestaña General → "Equipo patrón" y guarda. Mientras, se puede capturar pero no calcular Vcmv ni errores.';
        else if (pat.v20 === null) avisoPat = 'La medida volumétrica no tiene "Valor certificado" ni "Nominal (mL)" en SCFI → Equipos: no se puede calcular Vcmv.';
        const p0 = lado.pruebas || {};
        const ent = {};
        GASTOS.forEach(([k]) => { const g = p0[k] || {}; ent[k] = { lc: g.lc || [], rep: g.rep || [], t: g.t || [], temp: g.temp || [], lect: g.lect || [] }; });
        const dis = soloLectura ? 'disabled' : '';

        const wrap = document.createElement('div');
        wrap.className = 'fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-start justify-center p-3 overflow-y-auto';
        wrap.innerHTML = `
            <div class="bg-dark-800 border border-dark-700 rounded-2xl w-full max-w-4xl my-4">
                <div class="flex items-center justify-between px-5 py-4 border-b border-dark-700">
                    <div><p class="text-white font-bold">Corridas · Lado ${esc(lado.lado)} · ${esc(lado.combustible || '')}</p>
                        <p class="text-[11px] text-gray-400">Disp. ${esc(lado.dispensario || '—')} · ${esc(lado.marca || '')} ${esc(lado.modelo || '')} · Serie ${esc(lado.serie || '—')}${pat ? ` · Equipo ${esc(pat.nombre)} · MV ${esc(pat.serie)} · V20 ${f(pat.v20, 1)} mL · Kc ${f(pat.kc, 2)} mL/div` : ''}</p></div>
                    <button type="button" data-c-cerrar class="text-gray-400 hover:text-white text-xl"><i class="ph ph-x"></i></button>
                </div>
                <div class="p-5 space-y-4">
                    ${avisoPat ? `<p class="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">${esc(avisoPat)}</p>` : ''}
                    <div id="c-resumen" class="grid grid-cols-2 md:grid-cols-4 gap-2"></div>
                    ${GASTOS.map(([k, nom]) => `
                    <div class="border border-dark-700 rounded-xl overflow-x-auto">
                        <table class="w-full min-w-[720px] text-xs">
                            <thead class="bg-dark-900 text-gray-400"><tr><th class="px-2 py-2 text-left">${nom}</th>${CAMPOS.map(([, h]) => `<th class="px-1 py-2 font-semibold">${h}</th>`).join('')}<th class="px-2 text-brand-yellow">Vcmv (mL)</th><th class="px-2 text-brand-yellow">E (mL)</th><th class="px-2 text-brand-yellow">qv (L/min)</th></tr></thead>
                            <tbody>${[0, 1, 2].map((n) => `<tr class="border-t border-dark-700"><td class="px-2 text-gray-400">Corrida ${n + 1}</td>
                                ${CAMPOS.map(([c]) => `<td class="px-1 py-1"><input ${dis} type="number" step="any" inputmode="decimal" data-g="${k}" data-c="${c}" data-n="${n}" value="${esc(ent[k][c][n] ?? '')}" class="${IN}"></td>`).join('')}
                                <td class="px-2 text-right text-white" data-o="${k}-vcmv-${n}"></td><td class="px-2 text-right text-white" data-o="${k}-e-${n}"></td><td class="px-2 text-right text-white" data-o="${k}-qv-${n}"></td></tr>`).join('')}
                                <tr class="border-t border-dark-700"><td colspan="9" class="px-2 py-1.5 text-right text-gray-400">Repetibilidad R = Emax − Emin: <b class="text-white" data-o="${k}-r"></b> mL</td></tr>
                            </tbody>
                        </table>
                    </div>`).join('')}
                    <p class="text-[11px] text-gray-500">Vcmv = (V20 + Lc·Kc)·Cts, Cts = 1 + α(T − 20), α = ${ALFA}. E = lectura del dispensario − Vcmv. qv = Vcmv / T. Se reporta el mayor R de los tres gastos y el E de mayor valor absoluto.</p>
                </div>
                <div class="flex justify-end gap-2 px-5 py-4 border-t border-dark-700">
                    <button type="button" data-c-cerrar class="px-4 py-2 text-sm rounded-lg font-semibold bg-dark-900 border border-dark-700 text-gray-300 hover:text-white">${soloLectura ? 'Cerrar' : 'Cancelar'}</button>
                    ${soloLectura ? '' : '<button type="button" id="c-guardar" class="px-4 py-2 text-sm rounded-lg font-semibold bg-brand-yellow text-dark-900 hover:bg-yellow-400 inline-flex items-center gap-2"><i class="ph ph-floppy-disk"></i> Guardar corridas</button>'}
                </div>
            </div>`;
        document.body.appendChild(wrap);
        const o = (id) => wrap.querySelector(`[data-o="${id}"]`);
        let res = null;

        function leer() {
            wrap.querySelectorAll('[data-g]').forEach((el) => { ent[el.dataset.g][el.dataset.c][Number(el.dataset.n)] = el.value; });
        }
        function refrescar() {
            leer();
            res = calcular(ent, pat);
            GASTOS.forEach(([k]) => {
                for (let n = 0; n < 3; n++) {
                    o(`${k}-vcmv-${n}`).textContent = f(res[k].vcmv[n]);
                    const e = res[k].e[n], el = o(`${k}-e-${n}`);
                    el.textContent = f(e);
                    el.className = `px-2 text-right ${e !== null && res.emt !== null && Math.abs(e) > res.emt ? 'text-red-400 font-semibold' : 'text-white'}`;
                    o(`${k}-qv-${n}`).textContent = f(res[k].qv[n], 2);
                }
                o(`${k}-r`).textContent = f(res[k].r);
            });
            const caja = (t, v, extra) => `<div class="bg-dark-900 border border-dark-700 rounded-lg px-3 py-2"><p class="text-[11px] text-gray-500">${t}</p><p class="text-sm text-white font-bold">${v}</p>${extra ? `<p class="text-[11px]">${extra}</p>` : ''}</div>`;
            wrap.querySelector('#c-resumen').innerHTML = caja('Error máximo (mL)', f(res.e_max), veredicto(res.cumple_emt))
                + caja('EMT ± (mL)', f(res.emt), '')
                + caja('Repetibilidad (mL)', f(res.rep_resultado), veredicto(res.cumple_rep))
                + caja('Límite repetibilidad (mL)', f(res.repetibilidad), '');
        }
        refrescar();
        wrap.addEventListener('input', (e) => { if (e.target.matches('[data-g]')) refrescar(); });
        const cerrar = () => wrap.remove();
        wrap.querySelectorAll('[data-c-cerrar]').forEach((b) => b.addEventListener('click', cerrar));

        wrap.querySelector('#c-guardar')?.addEventListener('click', async (ev) => {
            const btn = ev.currentTarget;
            refrescar();
            btn.disabled = true;
            try {
                const datos = { ...res, actualizado: new Date().toISOString() };
                await DB.rpc('sudi_scfi_guardar_pruebas', { p_instrumento: String(lado.id), p_pruebas: datos });
                lado.pruebas = datos;
                const malo = res.cumple_emt === false || res.cumple_rep === false;
                App.toast(malo ? 'Corridas guardadas. Ojo: el lado NO cumple; revisa si debe quedar como "Rechaza".' : 'Corridas guardadas.', malo ? 'warning' : 'success');
                cerrar();
                onGuardado?.(datos);
            } catch (err) {
                const m = err.original?.code === 'PGRST202' || /sudi_scfi_guardar_pruebas|does not exist|schema cache/i.test(err.message) ? 'Falta correr el SQL 0021 en Supabase (falla de instalación, no del usuario).' : err.message;
                App.toast(m, 'error');
                btn.disabled = false;
            }
        });
    }

    window.SUDICorridas = { abrir, calcular, ALFA };
})();

/**
 * table-actions.js — Apartado interactivo para filas de tablas en Jomar SUDI
 * Proporciona un slide-over drawer al hacer clic izquierdo en cualquier fila de una tabla:
 * - Editar datos del elemento y actualizar la tabla en vivo.
 * - Dejar y gestionar comentarios persistentes asociados al registro.
 * - Eliminar el elemento de la tabla con confirmación y animación fluida.
 */
(() => {
    'use strict';

    // Evitar inicialización doble
    if (window.__tableActionsInitialized) return;
    window.__tableActionsInitialized = true;

    // Estado interno
    let activeRow = null;
    let activeTable = null;
    let currentFields = [];
    let currentTab = 'editar';

    // Inyectar estilos necesarios si no existen
    function injectStyles() {
        if (document.getElementById('table-actions-injected-styles')) return;
        const style = document.createElement('style');
        style.id = 'table-actions-injected-styles';
        style.textContent = `
            table tbody tr:not(.no-clickable):not(.empty-state-row) {
                cursor: pointer;
                transition: background-color 0.15s ease, box-shadow 0.15s ease;
            }
            .table-row-selected {
                background-color: rgba(234, 179, 8, 0.12) !important;
                box-shadow: inset 0 0 0 1.5px rgba(234, 179, 8, 0.6) !important;
                position: relative;
                z-index: 5;
            }
            @keyframes rowFadeOut {
                0% { opacity: 1; transform: scaleY(1); }
                100% { opacity: 0; transform: scaleY(0); height: 0; padding-top: 0; padding-bottom: 0; margin: 0; }
            }
            .row-deleting {
                animation: rowFadeOut 0.35s ease forwards;
                pointer-events: none;
            }
            .custom-drawer-scrollbar::-webkit-scrollbar {
                width: 6px;
            }
            .custom-drawer-scrollbar::-webkit-scrollbar-track {
                background: transparent;
            }
            .custom-drawer-scrollbar::-webkit-scrollbar-thumb {
                background: #232736;
                border-radius: 9999px;
            }
            .custom-drawer-scrollbar::-webkit-scrollbar-thumb:hover {
                background: #3b425b;
            }
        `;
        document.head.appendChild(style);
    }

    // Helper para mostrar notificaciones Toast si no existe window.App.toast
    function showToast(message, type = 'info') {
        if (window.App && typeof window.App.toast === 'function') {
            window.App.toast(message, type);
            return;
        }
        let container = document.getElementById('table-actions-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'table-actions-toast-container';
            container.className = 'fixed top-6 right-6 z-[10000] flex flex-col gap-3 w-80 max-w-[90vw] pointer-events-none';
            document.body.appendChild(container);
        }
        const colors = {
            success: 'border-emerald-500/50 text-emerald-400 bg-dark-800/95',
            error: 'border-red-500/50 text-red-400 bg-dark-800/95',
            warning: 'border-yellow-500/50 text-yellow-400 bg-dark-800/95',
            info: 'border-blue-500/50 text-blue-400 bg-dark-800/95'
        };
        const icons = {
            success: 'ph-check-circle',
            error: 'ph-x-circle',
            warning: 'ph-warning',
            info: 'ph-info'
        };
        const toast = document.createElement('div');
        toast.className = `pointer-events-auto flex items-start gap-3 border rounded-xl shadow-2xl px-4 py-3 text-sm transition-all duration-300 transform translate-x-4 opacity-0 ${colors[type] || colors.info}`;
        toast.innerHTML = `
            <i class="ph ${icons[type] || icons.info} text-xl shrink-0 mt-0.5"></i>
            <p class="text-gray-200 flex-1 font-medium text-xs leading-relaxed">${message}</p>
            <button class="text-gray-400 hover:text-white transition-colors" aria-label="Cerrar"><i class="ph ph-x"></i></button>
        `;
        container.appendChild(toast);
        requestAnimationFrame(() => {
            toast.classList.remove('translate-x-4', 'opacity-0');
        });
        const closeBtn = toast.querySelector('button');
        const dismiss = () => {
            toast.classList.add('translate-x-4', 'opacity-0');
            setTimeout(() => toast.remove(), 250);
        };
        closeBtn.addEventListener('click', dismiss);
        setTimeout(dismiss, 4000);
    }

    // Crear la estructura HTML del Drawer si no existe
    function createDrawer() {
        let drawer = document.getElementById('table-action-drawer-root');
        if (drawer) return drawer;

        drawer = document.createElement('div');
        drawer.id = 'table-action-drawer-root';
        drawer.innerHTML = `
            <!-- Backdrop -->
            <div id="table-drawer-backdrop" 
                 class="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9990] opacity-0 pointer-events-none transition-opacity duration-300"></div>

            <!-- Panel Lateral (Slide-Over Drawer) -->
            <aside id="table-drawer-panel" 
                   class="fixed top-0 right-0 bottom-0 z-[9995] w-full sm:w-[540px] md:w-[580px] bg-dark-900 border-l border-dark-700 shadow-[-10px_0_35px_rgba(0,0,0,0.85)] flex flex-col transform translate-x-full transition-transform duration-300 ease-out text-gray-200">
                
                <!-- Header del Drawer -->
                <div class="h-20 px-6 border-b border-dark-700/80 bg-dark-900/90 backdrop-blur flex items-center justify-between shrink-0">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-xl bg-brand-yellow/10 border border-brand-yellow/30 flex items-center justify-center text-brand-yellow shrink-0">
                            <i class="ph ph-sliders-horizontal text-xl"></i>
                        </div>
                        <div class="min-w-0">
                            <div class="flex items-center gap-2">
                                <h2 id="table-drawer-title" class="text-base font-bold text-white tracking-tight truncate max-w-[280px] sm:max-w-[340px]">
                                    Detalle del Registro
                                </h2>
                                <span id="table-drawer-badge" class="hidden text-[10px] px-2 py-0.5 rounded-md font-semibold bg-dark-800 border border-dark-700 text-brand-yellow uppercase tracking-wider">
                                    Fila
                                </span>
                            </div>
                            <p id="table-drawer-subtitle" class="text-xs text-gray-400 truncate mt-0.5">
                                Selecciona una acción para gestionar este registro
                            </p>
                        </div>
                    </div>
                    <button id="table-drawer-close-btn" 
                            class="w-9 h-9 rounded-lg bg-dark-800 border border-dark-700 text-gray-400 hover:text-white hover:bg-dark-700 flex items-center justify-center transition-colors shrink-0 ml-2"
                            title="Cerrar (Esc)">
                        <i class="ph ph-x text-lg"></i>
                    </button>
                </div>

                <!-- Barra de Pestañas (Tabs) -->
                <div class="px-6 py-2.5 bg-dark-800/60 border-b border-dark-700/70 flex items-center gap-2 shrink-0">
                    <button id="tab-btn-editar" 
                            class="tab-btn flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all bg-brand-yellow text-dark-900 shadow-md">
                        <i class="ph ph-pencil-simple text-sm"></i>
                        <span>Editar</span>
                    </button>
                    <button id="tab-btn-comentarios" 
                            class="tab-btn flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-dark-700/50 transition-all">
                        <i class="ph ph-chat-text text-sm"></i>
                        <span>Comentarios</span>
                        <span id="tab-comments-counter" class="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-dark-700 text-gray-300">0</span>
                    </button>
                    <button id="tab-btn-eliminar" 
                            class="tab-btn flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all ml-auto">
                        <i class="ph ph-trash text-sm"></i>
                        <span>Eliminar</span>
                    </button>
                </div>

                <!-- Contenedor Desplazable de Pestañas -->
                <div class="flex-1 overflow-y-auto custom-drawer-scrollbar p-6 space-y-6">
                    
                    <!-- ================= PESTAÑA: EDITAR ================= -->
                    <div id="pane-editar" class="space-y-5">
                        <div class="flex items-center justify-between pb-1 border-b border-dark-700/50">
                            <div>
                                <h3 class="text-sm font-semibold text-white">Editar Valores del Registro</h3>
                                <p class="text-xs text-gray-400">Modifica los campos y haz clic en Guardar Cambios para actualizar la tabla.</p>
                            </div>
                            <button id="btn-revertir-edicion" type="button" 
                                    class="text-xs text-gray-400 hover:text-brand-yellow flex items-center gap-1 transition-colors" 
                                    title="Restablecer valores originales">
                                <i class="ph ph-arrow-counter-clockwise"></i> Revertir
                            </button>
                        </div>

                        <!-- Formulario dinámico generado con las columnas de la fila -->
                        <form id="table-edit-form" class="space-y-4">
                            <div id="table-edit-fields" class="space-y-4">
                                <!-- Los campos se inyectan dinámicamente -->
                            </div>
                        </form>
                    </div>

                    <!-- ================= PESTAÑA: COMENTARIOS ================= -->
                    <div id="pane-comentarios" class="hidden space-y-6">
                        <div>
                            <h3 class="text-sm font-semibold text-white">Comentarios y Observaciones</h3>
                            <p class="text-xs text-gray-400">Deja notas o anotaciones técnicas asociadas a este registro.</p>
                        </div>

                        <!-- Caja de nuevo comentario -->
                        <div class="bg-dark-800 rounded-xl border border-dark-700 p-4 space-y-3 shadow-md">
                            <div class="flex items-center gap-2 text-xs text-gray-400">
                                <div class="w-6 h-6 rounded-full bg-brand-yellow/20 text-brand-yellow flex items-center justify-center font-bold text-[10px]">
                                    AD
                                </div>
                                <span class="font-medium text-gray-300">Administrador</span>
                                <span class="text-gray-500">• Nuevo comentario</span>
                            </div>
                            <textarea id="comment-input-text" rows="3" 
                                      placeholder="Escribe una observación, nota de verificación o incidencia..." 
                                      class="w-full bg-dark-900 border border-dark-700 rounded-lg p-3 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow transition-all resize-none"></textarea>
                            <div class="flex justify-between items-center pt-1">
                                <span class="text-[11px] text-gray-500">Se guardará localmente</span>
                                <button id="btn-publicar-comentario" type="button" 
                                        class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-yellow to-yellow-600 hover:from-yellow-500 hover:to-yellow-600 text-dark-900 font-semibold text-xs rounded-lg shadow transition-all hover:-translate-y-0.5">
                                    <i class="ph ph-paper-plane-tilt text-sm font-bold"></i> Publicar comentario
                                </button>
                            </div>
                        </div>

                        <!-- Lista de comentarios -->
                        <div class="space-y-3">
                            <div class="flex items-center justify-between">
                                <h4 class="text-xs uppercase tracking-wider text-gray-400 font-semibold">Historial de comentarios</h4>
                                <span id="comments-count-badge" class="text-xs text-gray-500">0 comentarios</span>
                            </div>
                            <div id="comments-list" class="space-y-3">
                                <!-- Se inyecta dinámicamente -->
                            </div>
                        </div>
                    </div>

                    <!-- ================= PESTAÑA: ELIMINAR ================= -->
                    <div id="pane-eliminar" class="hidden space-y-5">
                        <div class="bg-red-500/10 border border-red-500/30 rounded-xl p-5 space-y-3">
                            <div class="flex items-start gap-3">
                                <div class="w-10 h-10 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center shrink-0">
                                    <i class="ph ph-warning-octagon text-2xl"></i>
                                </div>
                                <div>
                                    <h4 class="text-sm font-bold text-red-400">¿Deseas eliminar este registro?</h4>
                                    <p class="text-xs text-gray-300 mt-1 leading-relaxed">
                                        Esta acción eliminará de forma inmediata el elemento de la tabla en pantalla. Asegúrate de que no se requiere para reportes o inspecciones activas.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <!-- Resumen del elemento a eliminar -->
                        <div class="bg-dark-800 border border-dark-700 rounded-xl p-4 space-y-2">
                            <p class="text-[11px] uppercase tracking-wider text-gray-400 font-semibold">Resumen del registro:</p>
                            <div id="delete-summary-content" class="text-xs text-gray-300 space-y-1 divide-y divide-dark-700/40">
                                <!-- Inyectado dinámicamente -->
                            </div>
                        </div>

                        <!-- Botón destructivo -->
                        <button id="btn-confirmar-eliminar" type="button" 
                                class="w-full py-3 px-4 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-red-900/30 flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5">
                            <i class="ph ph-trash text-lg"></i> Confirmar y Eliminar Registro
                        </button>
                    </div>

                </div>

                <!-- Footer del Drawer (fijo en la parte inferior) -->
                <div class="p-4 border-t border-dark-700/80 bg-dark-900/95 flex items-center justify-between shrink-0">
                    <button id="table-drawer-cancel-btn" type="button" 
                            class="px-4 py-2 text-xs font-medium text-gray-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors">
                        Cerrar panel
                    </button>
                    
                    <button id="btn-guardar-cambios-footer" type="button" 
                            class="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-yellow to-yellow-600 text-dark-900 font-bold text-xs rounded-lg shadow-lg hover:shadow-yellow-500/20 transition-all hover:-translate-y-0.5">
                        <i class="ph ph-floppy-disk text-base"></i> Guardar Cambios
                    </button>
                </div>

            </aside>
        `;

        document.body.appendChild(drawer);
        bindDrawerEvents(drawer);
        return drawer;
    }

    // Cambiar de pestaña en el drawer
    function switchTab(tabName) {
        currentTab = tabName;
        const btnEditar = document.getElementById('tab-btn-editar');
        const btnComentarios = document.getElementById('tab-btn-comentarios');
        const btnEliminar = document.getElementById('tab-btn-eliminar');
        const paneEditar = document.getElementById('pane-editar');
        const paneComentarios = document.getElementById('pane-comentarios');
        const paneEliminar = document.getElementById('pane-eliminar');
        const footerSaveBtn = document.getElementById('btn-guardar-cambios-footer');

        // Reset classes
        const inactiveClass = 'tab-btn flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-dark-700/50 transition-all';
        const activeEditClass = 'tab-btn flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all bg-brand-yellow text-dark-900 shadow-md';
        const activeCommentsClass = 'tab-btn flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all bg-dark-700 text-white shadow-md';
        const activeDeleteClass = 'tab-btn flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all bg-red-600 text-white shadow-md';

        btnEditar.className = tabName === 'editar' ? activeEditClass : inactiveClass;
        btnComentarios.className = tabName === 'comentarios' ? activeCommentsClass : inactiveClass;
        btnEliminar.className = tabName === 'eliminar' ? activeDeleteClass : 'tab-btn flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all ml-auto';

        paneEditar.classList.toggle('hidden', tabName !== 'editar');
        paneComentarios.classList.toggle('hidden', tabName !== 'comentarios');
        paneEliminar.classList.toggle('hidden', tabName !== 'eliminar');

        if (footerSaveBtn) {
            if (tabName === 'editar') {
                footerSaveBtn.classList.remove('hidden');
                footerSaveBtn.innerHTML = '<i class="ph ph-floppy-disk text-base"></i> Guardar Cambios';
                footerSaveBtn.className = 'flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand-yellow to-yellow-600 text-dark-900 font-bold text-xs rounded-lg shadow-lg hover:shadow-yellow-500/20 transition-all hover:-translate-y-0.5';
            } else if (tabName === 'comentarios') {
                footerSaveBtn.classList.remove('hidden');
                footerSaveBtn.innerHTML = '<i class="ph ph-plus text-base font-bold"></i> Ir a comentar';
                footerSaveBtn.className = 'flex items-center gap-2 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white font-medium text-xs rounded-lg transition-all';
            } else {
                footerSaveBtn.classList.add('hidden');
            }
        }
    }

    // Vincular eventos estáticos del Drawer
    function bindDrawerEvents(root) {
        const backdrop = root.querySelector('#table-drawer-backdrop');
        const closeBtn = root.querySelector('#table-drawer-close-btn');
        const cancelBtn = root.querySelector('#table-drawer-cancel-btn');
        const btnEditar = root.querySelector('#tab-btn-editar');
        const btnComentarios = root.querySelector('#tab-btn-comentarios');
        const btnEliminar = root.querySelector('#tab-btn-eliminar');
        const footerSaveBtn = root.querySelector('#btn-guardar-cambios-footer');
        const revertBtn = root.querySelector('#btn-revertir-edicion');
        const postCommentBtn = root.querySelector('#btn-publicar-comentario');
        const deleteConfirmBtn = root.querySelector('#btn-confirmar-eliminar');

        backdrop.addEventListener('click', closeDrawer);
        closeBtn.addEventListener('click', closeDrawer);
        cancelBtn.addEventListener('click', closeDrawer);

        btnEditar.addEventListener('click', () => switchTab('editar'));
        btnComentarios.addEventListener('click', () => switchTab('comentarios'));
        btnEliminar.addEventListener('click', () => switchTab('eliminar'));

        footerSaveBtn.addEventListener('click', () => {
            if (currentTab === 'editar') {
                saveRowEdits();
            } else if (currentTab === 'comentarios') {
                const textarea = document.getElementById('comment-input-text');
                if (textarea) textarea.focus();
            }
        });

        revertBtn.addEventListener('click', revertEdits);
        postCommentBtn.addEventListener('click', addComment);
        deleteConfirmBtn.addEventListener('click', deleteActiveRow);

        // Atajo teclado ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const panel = document.getElementById('table-drawer-panel');
                if (panel && !panel.classList.contains('translate-x-full')) {
                    closeDrawer();
                }
            }
        });
    }

    // Abrir Drawer
    function openDrawer(row) {
        createDrawer();
        const backdrop = document.getElementById('table-drawer-backdrop');
        const panel = document.getElementById('table-drawer-panel');

        if (activeRow) {
            activeRow.classList.remove('table-row-selected');
        }
        activeRow = row;
        activeTable = row.closest('table');
        activeRow.classList.add('table-row-selected');

        // Extraer columnas y poblar datos
        extractRowData(row);
        switchTab('editar');

        // Transición de apertura
        backdrop.classList.remove('opacity-0', 'pointer-events-none');
        panel.classList.remove('translate-x-full');
        document.body.classList.add('overflow-hidden');
    }

    // Cerrar Drawer
    function closeDrawer() {
        const backdrop = document.getElementById('table-drawer-backdrop');
        const panel = document.getElementById('table-drawer-panel');
        if (!panel) return;

        backdrop.classList.add('opacity-0', 'pointer-events-none');
        panel.classList.add('translate-x-full');
        document.body.classList.remove('overflow-hidden');

        if (activeRow) {
            activeRow.classList.remove('table-row-selected');
            activeRow = null;
        }
    }

    // Generar un identificador persistente para la fila
    function getRowId(row) {
        if (row.dataset.rowId) return row.dataset.rowId;
        const pageKey = window.location.pathname.split('/').pop() || 'index';
        const cells = Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim());
        const rawKey = `${pageKey}__${cells.slice(0, 4).join('_')}`.replace(/[^a-zA-Z0-9_]/g, '');
        row.dataset.rowId = rawKey || ('row_' + Math.random().toString(36).substr(2, 9));
        return row.dataset.rowId;
    }

    // Extraer datos de la fila y encabezados de la tabla
    function extractRowData(row) {
        const table = row.closest('table');
        if (!table) return;

        // Obtener encabezados
        const thList = Array.from(table.querySelectorAll('thead th'));
        const tdList = Array.from(row.querySelectorAll('td'));

        currentFields = [];

        tdList.forEach((td, index) => {
            // Obtener texto del encabezado
            let headerText = '';
            if (thList[index]) {
                headerText = thList[index].innerText.trim();
            }
            if (!headerText) {
                headerText = `Columna ${index + 1}`;
            }

            // Limpiar texto de iconos o botones en el encabezado
            headerText = headerText.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

            // Determinar si la celda tiene elementos interactivos principales (ej. botones de detalle)
            const hasOnlyAction = td.querySelector('button, a') && td.innerText.trim() === '';

            // Obtener valor actual
            const originalHtml = td.innerHTML;
            const originalText = td.innerText.trim();

            currentFields.push({
                index,
                label: headerText,
                cell: td,
                originalText,
                originalHtml,
                isAction: hasOnlyAction
            });
        });

        // Configurar título y subtítulo del drawer
        const titleEl = document.getElementById('table-drawer-title');
        const subtitleEl = document.getElementById('table-drawer-subtitle');
        const badgeEl = document.getElementById('table-drawer-badge');

        // Identificar campo principal (Folio, Clave, Razón Social o el primer campo con texto)
        const primaryField = currentFields.find(f => !f.isAction && f.originalText.length > 0);
        const secondaryField = currentFields.filter(f => !f.isAction && f.originalText.length > 0)[1];

        if (primaryField) {
            titleEl.textContent = primaryField.originalText;
            subtitleEl.textContent = secondaryField ? `${primaryField.label}: ${primaryField.originalText} • ${secondaryField.label}: ${secondaryField.originalText}` : primaryField.label;
        } else {
            titleEl.textContent = 'Detalles del Registro';
            subtitleEl.textContent = 'Gestión de elemento de tabla';
        }

        const rowIndex = Array.from(table.querySelectorAll('tbody tr')).indexOf(row) + 1;
        if (badgeEl && rowIndex > 0) {
            badgeEl.textContent = `Registro #${rowIndex}`;
            badgeEl.classList.remove('hidden');
        }

        renderEditFields();
        renderComments();
        renderDeleteSummary();
    }

    // Renderizar campos de edición
    function renderEditFields() {
        const container = document.getElementById('table-edit-fields');
        if (!container) return;
        container.innerHTML = '';

        currentFields.forEach((field, i) => {
            if (field.isAction) return;

            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'space-y-1.5';

            const fieldId = `field_input_${i}`;
            const isLong = field.originalText.length > 60;

            let inputHtml = '';
            if (isLong) {
                inputHtml = `
                    <textarea id="${fieldId}" rows="3" 
                              class="w-full bg-dark-800 border border-dark-700 rounded-lg p-3 text-sm text-gray-200 focus:outline-none focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow transition-all resize-none">${escapeHtml(field.originalText)}</textarea>
                `;
            } else {
                inputHtml = `
                    <input type="text" id="${fieldId}" value="${escapeHtml(field.originalText)}" 
                           class="w-full bg-dark-800 border border-dark-700 rounded-lg py-2.5 px-3.5 text-sm text-gray-200 focus:outline-none focus:border-brand-yellow focus:ring-1 focus:ring-brand-yellow transition-all">
                `;
            }

            fieldDiv.innerHTML = `
                <label for="${fieldId}" class="block text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    ${escapeHtml(field.label)}
                </label>
                ${inputHtml}
            `;

            container.appendChild(fieldDiv);
        });
    }

    // Revertir campos de edición a los valores originales de la fila
    function revertEdits() {
        renderEditFields();
        showToast('Valores restaurados al estado original', 'info');
    }

    // Guardar cambios editados en la fila de la tabla
    function saveRowEdits() {
        if (!activeRow) return;

        let modifiedCount = 0;
        currentFields.forEach((field, i) => {
            if (field.isAction) return;
            const input = document.getElementById(`field_input_${i}`);
            if (!input) return;

            const newValue = input.value.trim();
            if (newValue !== field.originalText) {
                // Si la celda contiene etiquetas simples como span o p, actualizar manteniendo estructura
                const mainSpan = field.cell.querySelector('span:not(.badge), p, strong, font');
                if (mainSpan && !field.cell.querySelector('table, select, input')) {
                    mainSpan.textContent = newValue;
                } else if (!field.cell.querySelector('button, a, input, select')) {
                    field.cell.textContent = newValue;
                } else {
                    // Si tiene botones u otros elementos, actualizar nodo de texto
                    const textNode = Array.from(field.cell.childNodes).find(n => n.nodeType === Node.TEXT_NODE && n.nodeValue.trim());
                    if (textNode) {
                        textNode.nodeValue = ' ' + newValue + ' ';
                    } else {
                        field.cell.textContent = newValue;
                    }
                }
                field.originalText = newValue;
                modifiedCount++;
            }
        });

        // Efecto visual de fila actualizada
        activeRow.classList.add('bg-emerald-500/20');
        setTimeout(() => {
            activeRow?.classList.remove('bg-emerald-500/20');
        }, 800);

        showToast(modifiedCount > 0 ? `¡Registro actualizado! (${modifiedCount} campos modificados)` : 'Sin cambios que guardar', 'success');

        // Actualizar título y subtítulo del drawer
        const titleEl = document.getElementById('table-drawer-title');
        const primaryField = currentFields.find(f => !f.isAction && f.originalText.length > 0);
        if (primaryField && titleEl) {
            titleEl.textContent = primaryField.originalText;
        }
    }

    // Sistema de comentarios con almacenamiento en localStorage
    function getStoredComments(rowId) {
        try {
            const raw = localStorage.getItem(`sudi_table_comments_${rowId}`);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveStoredComments(rowId, comments) {
        try {
            localStorage.setItem(`sudi_table_comments_${rowId}`, JSON.stringify(comments));
        } catch (e) {}
    }

    function renderComments() {
        if (!activeRow) return;
        const rowId = getRowId(activeRow);
        const comments = getStoredComments(rowId);
        const listContainer = document.getElementById('comments-list');
        const countBadge = document.getElementById('comments-count-badge');
        const tabCounter = document.getElementById('tab-comments-counter');

        if (countBadge) countBadge.textContent = `${comments.length} comentario${comments.length === 1 ? '' : 's'}`;
        if (tabCounter) tabCounter.textContent = comments.length;

        if (!listContainer) return;
        listContainer.innerHTML = '';

        if (comments.length === 0) {
            listContainer.innerHTML = `
                <div class="p-8 text-center bg-dark-800/40 rounded-xl border border-dark-700/60 space-y-2">
                    <i class="ph ph-chat-circle-dots text-3xl text-gray-500"></i>
                    <p class="text-xs text-gray-400 font-medium">Aún no hay comentarios en este registro.</p>
                    <p class="text-[11px] text-gray-500">Sé el primero en dejar una observación técnica o nota.</p>
                </div>
            `;
            return;
        }

        comments.forEach((c, idx) => {
            const item = document.createElement('div');
            item.className = 'bg-dark-800 rounded-xl border border-dark-700/70 p-4 space-y-2 shadow-sm fade-in';
            item.innerHTML = `
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded-full bg-brand-yellow/20 text-brand-yellow flex items-center justify-center font-bold text-[10px]">
                            ${escapeHtml(c.authorInitial || 'AD')}
                        </div>
                        <span class="text-xs font-semibold text-white">${escapeHtml(c.author || 'Administrador')}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-[11px] text-gray-500">${escapeHtml(c.date)}</span>
                        <button type="button" class="btn-delete-comment text-gray-500 hover:text-red-400 transition-colors p-1" title="Eliminar nota" data-idx="${idx}">
                            <i class="ph ph-trash text-xs"></i>
                        </button>
                    </div>
                </div>
                <p class="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">${escapeHtml(c.text)}</p>
            `;

            item.querySelector('.btn-delete-comment').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteComment(idx);
            });

            listContainer.appendChild(item);
        });
    }

    function addComment() {
        if (!activeRow) return;
        const textarea = document.getElementById('comment-input-text');
        const text = textarea ? textarea.value.trim() : '';

        if (!text) {
            showToast('Por favor escribe un comentario antes de publicar.', 'warning');
            if (textarea) textarea.focus();
            return;
        }

        const rowId = getRowId(activeRow);
        const comments = getStoredComments(rowId);

        const now = new Date();
        const formattedDate = now.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }) + ' ' + now.toLocaleTimeString('es-MX', {
            hour: '2-digit',
            minute: '2-digit'
        });

        comments.unshift({
            id: Date.now(),
            author: 'Administrador',
            authorInitial: 'AD',
            text: text,
            date: formattedDate
        });

        saveStoredComments(rowId, comments);
        if (textarea) textarea.value = '';
        renderComments();
        showToast('Comentario publicado exitosamente', 'success');
    }

    function deleteComment(index) {
        if (!activeRow) return;
        const rowId = getRowId(activeRow);
        const comments = getStoredComments(rowId);
        comments.splice(index, 1);
        saveStoredComments(rowId, comments);
        renderComments();
        showToast('Comentario eliminado', 'info');
    }

    // Renderizar resumen para la pestaña de eliminación
    function renderDeleteSummary() {
        const container = document.getElementById('delete-summary-content');
        if (!container) return;
        container.innerHTML = '';

        const visibleFields = currentFields.filter(f => !f.isAction && f.originalText.length > 0).slice(0, 5);
        visibleFields.forEach(f => {
            const row = document.createElement('div');
            row.className = 'flex items-center justify-between py-1.5 text-xs';
            row.innerHTML = `
                <span class="text-gray-400 font-medium">${escapeHtml(f.label)}:</span>
                <span class="text-white font-semibold truncate max-w-[240px]">${escapeHtml(f.originalText)}</span>
            `;
            container.appendChild(row);
        });
    }

    // Eliminar la fila activa con animación
    function deleteActiveRow() {
        if (!activeRow) return;

        const rowToDelete = activeRow;
        const table = rowToDelete.closest('table');

        // Confirmar eliminación
        closeDrawer();

        // Aplicar clase de animación
        rowToDelete.classList.add('row-deleting');

        setTimeout(() => {
            rowToDelete.remove();

            // Actualizar contadores si existen en la página
            updatePaginationAndCounters(table);
            showToast('Registro eliminado de la tabla.', 'success');
        }, 350);
    }

    // Actualizar contadores visibles de paginación o registros si existen
    function updatePaginationAndCounters(table) {
        if (!table) return;
        const remainingRows = table.querySelectorAll('tbody tr:not(.empty-state-row)').length;

        // Buscar texto tipo "Mostrando X de Y registros" en la página
        const textNodes = document.querySelectorAll('span, p');
        textNodes.forEach(el => {
            if (/Mostrando \d+ de \d+ registros/i.test(el.textContent)) {
                el.textContent = `Mostrando ${remainingRows} de ${remainingRows} registros`;
            }
        });
    }

    // Escape de HTML para evitar XSS al mostrar valores
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Inicializar escucha global para clics en filas de tabla
    function initTableListeners() {
        injectStyles();

        // Delegación global para cualquier clic en una fila de tabla
        document.addEventListener('click', (e) => {
            // Solo clic izquierdo
            if (e.button !== 0) return;

            // Verificar si el clic fue en un botón, enlace, input, dropdown o modal existente
            if (e.target.closest('button, a, input, select, textarea, label, [data-modal-open], [data-dropdown-toggle], .no-row-action')) {
                return;
            }

            // Ignorar clics dentro del propio drawer
            if (e.target.closest('#table-action-drawer-root')) {
                return;
            }

            // Buscar fila dentro de un tbody
            const tr = e.target.closest('table tbody tr');
            if (!tr) return;

            // Ignorar filas de estado vacío
            if (tr.classList.contains('empty-state-row') || tr.classList.contains('no-clickable')) return;
            if (tr.cells.length === 1 && tr.cells[0].colSpan > 1) return;

            // Abrir el apartado
            openDrawer(tr);
        });
    }

    // Exponer API global
    window.TableActions = {
        open: openDrawer,
        close: closeDrawer,
        refresh: () => {
            if (activeRow) extractRowData(activeRow);
        }
    };

    // Auto-arranque
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTableListeners);
    } else {
        initTableListeners();
    }
})();

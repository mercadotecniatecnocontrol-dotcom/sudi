/**
 * app.js — Utilidades compartidas por SCFI y ASEA.
 * Vanilla JS, sin dependencias. Se incluye en cada HTML vía <script src=".../JS/app.js" defer></script>.
 *
 * Expone `window.App` con: toast, modal, dropdown, search, pagination, confirm.
 * Cada página solo llama a estas funciones sobre sus propios elementos — no hay estado
 * ni datos compartidos entre SCFI y ASEA aquí, solo comportamiento de UI reutilizable.
 */
(() => {
    'use strict';

    // ---------------------------------------------------------------
    // Toast notifications (success / error / warning / info)
    // ---------------------------------------------------------------
    const TOAST_ICONS = {
        success: 'ph-check-circle',
        error: 'ph-x-circle',
        warning: 'ph-warning',
        info: 'ph-info',
    };
    const TOAST_COLORS = {
        success: 'border-emerald-500/40 text-emerald-400',
        error: 'border-red-500/40 text-red-400',
        warning: 'border-brand-yellow/40 text-brand-yellow',
        info: 'border-blue-500/40 text-blue-400',
    };

    function ensureToastContainer() {
        let container = document.getElementById('app-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'app-toast-container';
            container.className = 'fixed top-6 right-6 z-[100] flex flex-col gap-3 w-80 max-w-[90vw]';
            document.body.appendChild(container);
        }
        return container;
    }

    function toast(message, type = 'info', duration = 4000) {
        const container = ensureToastContainer();
        const el = document.createElement('div');
        el.className = `fade-in flex items-start gap-3 bg-dark-800 border ${TOAST_COLORS[type] || TOAST_COLORS.info} rounded-xl shadow-2xl px-4 py-3`;
        el.innerHTML = `
            <i class="ph ${TOAST_ICONS[type] || TOAST_ICONS.info} text-xl mt-0.5 shrink-0"></i>
            <p class="text-sm text-gray-200 flex-1">${message}</p>
            <button class="text-gray-500 hover:text-white transition-colors" aria-label="Cerrar">
                <i class="ph ph-x"></i>
            </button>
        `;
        el.querySelector('button').addEventListener('click', () => dismissToast(el));
        container.appendChild(el);
        if (duration > 0) {
            setTimeout(() => dismissToast(el), duration);
        }
        return el;
    }

    function dismissToast(el) {
        if (!el || !el.isConnected) return;
        el.style.transition = 'opacity .25s ease, transform .25s ease';
        el.style.opacity = '0';
        el.style.transform = 'translateX(20px)';
        setTimeout(() => el.remove(), 250);
    }

    // ---------------------------------------------------------------
    // Modales: abrir/cerrar con backdrop, ESC y botón "X"
    // ---------------------------------------------------------------
    function openModal(idOrEl) {
        let modal = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
        if (!modal && typeof idOrEl === 'string' && idOrEl === 'modal-opciones-perfil') {
            modal = ensureProfileModal();
        }
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.style.display = 'flex';
        modal.style.zIndex = '99999';
        document.body.classList.add('overflow-hidden');
        requestAnimationFrame(() => modal.classList.add('modal-open'));
        const focusable = modal.querySelector('input, textarea, select, button');
        if (focusable) focusable.focus();
    }

    function closeModal(idOrEl) {
        const modal = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
        if (!modal) return;
        modal.classList.remove('modal-open');
        document.body.classList.remove('overflow-hidden');
        setTimeout(() => {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }, 200);
    }

    function initModals(root = document) {
        root.querySelectorAll('[data-modal-open]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const target = btn.getAttribute('data-modal-open');
                if (target === 'modal-opciones-perfil') {
                    e.preventDefault();
                    e.stopPropagation();
                    openModal(ensureProfileModal());
                } else {
                    openModal(target);
                }
            });
        });
        root.querySelectorAll('[data-modal-close]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeModal(btn.closest('[data-modal]'));
            });
        });
        root.querySelectorAll('[data-modal]').forEach((modal) => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal || e.target.classList.contains('modal-backdrop')) {
                    closeModal(modal);
                }
            });
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('[data-modal].modal-open').forEach(closeModal);
            }
        });
    }

    // ---------------------------------------------------------------
    // Dropdowns (soporta tanto menús de sidebar como menús flotantes/filtros)
    // ---------------------------------------------------------------
    function initDropdowns(root = document) {
        // Soporta [data-dropdown-toggle], [data-target] y .menu-desplegable-btn
        const dropdownButtons = root.querySelectorAll('[data-dropdown-toggle], button[data-target], .menu-desplegable-btn');
        dropdownButtons.forEach((btn) => {
            if (btn.dataset.dropdownBound) return;
            btn.dataset.dropdownBound = 'true';

            const targetId = btn.getAttribute('data-dropdown-toggle') || btn.getAttribute('data-target');
            if (!targetId) return;
            const panel = document.getElementById(targetId);
            if (!panel) return;

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const isSidebarMenu = btn.closest('aside') || panel.closest('aside');
                const isCurrentlyOpen = !panel.classList.contains('hidden') && panel.style.display !== 'none';
                const caret = btn.querySelector('.ph-caret-down');

                if (isSidebarMenu) {
                    // Para menús desplegables del sidebar (acordeón):
                    if (isCurrentlyOpen) {
                        panel.classList.add('hidden');
                        panel.style.display = 'none';
                        if (caret) caret.classList.remove('rotate-180');
                    } else {
                        panel.classList.remove('hidden');
                        panel.style.display = 'block';
                        if (caret) caret.classList.add('rotate-180');
                    }
                } else {
                    // Para menús flotantes/popovers (filtros, tarjetas, etc.):
                    document.querySelectorAll('[data-dropdown]:not(aside [data-dropdown])').forEach((p) => {
                        p.classList.add('hidden');
                        p.style.display = 'none';
                    });
                    document.querySelectorAll('[data-dropdown-toggle]:not(aside [data-dropdown-toggle]) .ph-caret-down').forEach(c => c.classList.remove('rotate-180'));
                    if (!isCurrentlyOpen) {
                        panel.classList.remove('hidden');
                        panel.style.display = 'block';
                        if (caret) caret.classList.add('rotate-180');
                    }
                }
            });
        });

        document.addEventListener('click', (e) => {
            // Ignorar clics dentro del sidebar para no cerrar sus menús desplegables
            if (e.target.closest('aside')) return;
            if (!e.target.closest('[data-dropdown]') && !e.target.closest('[data-dropdown-toggle]') && !e.target.closest('.menu-desplegable-btn')) {
                document.querySelectorAll('[data-dropdown]:not(aside [data-dropdown])').forEach((p) => {
                    p.classList.add('hidden');
                    p.style.display = 'none';
                    const btn = document.querySelector(`[data-dropdown-toggle="${p.id}"], [data-target="${p.id}"]`);
                    if (btn) {
                        const caret = btn.querySelector('.ph-caret-down');
                        if (caret) caret.classList.remove('rotate-180');
                    }
                });
            }
        });
    }

    // ---------------------------------------------------------------
    // Buscador en vivo: filtra elementos hijos de un contenedor por texto
    // ---------------------------------------------------------------
    function initSearch(inputEl, itemsSelector, options = {}) {
        if (!inputEl) return;
        const { onFilter, emptyStateSelector } = options;
        inputEl.addEventListener('input', () => {
            const term = inputEl.value.trim().toLowerCase();
            const items = document.querySelectorAll(itemsSelector);
            let visibleCount = 0;
            items.forEach((item) => {
                const text = item.textContent.toLowerCase();
                const match = term === '' || text.includes(term);
                item.classList.toggle('hidden', !match);
                if (match) visibleCount += 1;
            });
            if (emptyStateSelector) {
                const emptyState = document.querySelector(emptyStateSelector);
                if (emptyState) emptyState.classList.toggle('hidden', visibleCount > 0);
            }
            if (typeof onFilter === 'function') onFilter(visibleCount);
        });
    }

    // ---------------------------------------------------------------
    // Paginación simple sobre una lista de elementos ya en el DOM
    // ---------------------------------------------------------------
    function initPagination({ itemsSelector, pageSize = 6, prevBtn, nextBtn, labelEl, container }) {
        const scope = container || document;
        const items = Array.from(scope.querySelectorAll(itemsSelector));
        if (items.length === 0) return null;
        let page = 1;
        const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

        function render() {
            items.forEach((item, i) => {
                const itemPage = Math.floor(i / pageSize) + 1;
                item.classList.toggle('hidden', itemPage !== page);
            });
            if (labelEl) labelEl.textContent = `Pág. ${page} de ${totalPages}`;
            if (prevBtn) prevBtn.disabled = page <= 1;
            if (nextBtn) nextBtn.disabled = page >= totalPages;
            [prevBtn, nextBtn].forEach((btn) => {
                if (!btn) return;
                btn.classList.toggle('opacity-40', btn.disabled);
                btn.classList.toggle('cursor-not-allowed', btn.disabled);
            });
        }

        if (prevBtn) prevBtn.addEventListener('click', () => { if (page > 1) { page -= 1; render(); } });
        if (nextBtn) nextBtn.addEventListener('click', () => { if (page < totalPages) { page += 1; render(); } });

        render();
        return { render, goTo: (p) => { page = Math.min(Math.max(1, p), totalPages); render(); } };
    }

    // ---------------------------------------------------------------
    // Confirmación para acciones destructivas (reemplaza confirm() nativo)
    // ---------------------------------------------------------------
    function confirmAction({ title, message, confirmLabel = 'Confirmar', danger = true, onConfirm }) {
        let modal = document.getElementById('app-confirm-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'app-confirm-modal';
            modal.setAttribute('data-modal', '');
            modal.className = 'hidden fixed inset-0 z-[90] flex items-center justify-center px-4';
            modal.innerHTML = `
                <div class="modal-backdrop absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
                <div class="modal-panel relative bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl w-full max-w-sm p-6">
                    <h3 id="app-confirm-title" class="text-white font-bold text-lg mb-2"></h3>
                    <p id="app-confirm-message" class="text-sm text-gray-400 mb-6"></p>
                    <div class="flex justify-end gap-3">
                        <button data-modal-close class="px-4 py-2 text-sm rounded-lg text-gray-300 hover:bg-dark-700 transition-colors">Cancelar</button>
                        <button id="app-confirm-btn" class="px-4 py-2 text-sm rounded-lg font-medium text-white transition-colors"></button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        modal.querySelector('#app-confirm-title').textContent = title || '¿Confirmar acción?';
        modal.querySelector('#app-confirm-message').textContent = message || '';
        const confirmBtn = modal.querySelector('#app-confirm-btn');
        confirmBtn.textContent = confirmLabel;
        confirmBtn.className = `px-4 py-2 text-sm rounded-lg font-medium text-white transition-colors ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-yellow hover:bg-yellow-600'}`;
        const closeBtn = modal.querySelector('[data-modal-close]');
        closeBtn.onclick = () => closeModal(modal);
        modal.onclick = (e) => { if (e.target === modal) closeModal(modal); };
        confirmBtn.onclick = () => {
            closeModal(modal);
            if (typeof onConfirm === 'function') onConfirm();
        };
        openModal(modal);
    }

    // ---------------------------------------------------------------
    // Sidebar responsive (colapsable en móvil)
    // ---------------------------------------------------------------
    function initSidebarToggle() {
        const sidebar = document.querySelector('aside');
        const toggleBtn = document.getElementById('sidebar-toggle');
        const overlay = document.getElementById('sidebar-overlay');
        if (!sidebar || !toggleBtn) return;
        const open = () => {
            sidebar.classList.remove('-translate-x-full');
            overlay?.classList.remove('hidden');
        };
        const close = () => {
            sidebar.classList.add('-translate-x-full');
            overlay?.classList.add('hidden');
        };
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.contains('-translate-x-full') ? open() : close();
        });
        overlay?.addEventListener('click', close);
    }

    // ---------------------------------------------------------------
    // Botones "Guardar" con estado de carga (disabled + texto "Guardando...")
    // ---------------------------------------------------------------
    function withLoading(button, { loadingText = 'Guardando...', task }) {
        if (!button || button.disabled) return;
        const originalText = button.innerHTML;
        button.disabled = true;
        button.classList.add('opacity-70', 'cursor-not-allowed');
        button.innerHTML = `<i class="ph ph-spinner animate-spin"></i> ${loadingText}`;
        Promise.resolve(typeof task === 'function' ? task() : null)
            .finally(() => {
                button.disabled = false;
                button.classList.remove('opacity-70', 'cursor-not-allowed');
                button.innerHTML = originalText;
            });
    }

    // Simula latencia de red para que los estados de loading se noten (mock, sin backend real)
    function fakeRequest(ms = 700) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // ---------------------------------------------------------------
    // Modal "Opciones de perfil"
    // ---------------------------------------------------------------
    function ensureProfileModal() {
        let modal = document.getElementById('modal-opciones-perfil');
        if (modal) return modal;

        // Detectar ruta relativa a login.html y perfil.html
        let logoutHref = 'login.html';
        let perfilHref = 'perfil.html';
        const existingLogout = document.querySelector('aside a[href*="login.html"], a[href*="login.html"]');
        if (existingLogout) {
            logoutHref = existingLogout.getAttribute('href');
            perfilHref = logoutHref.replace('login.html', 'perfil.html');
        } else {
            const loc = window.location.pathname.replace(/\\/g, '/');
            if (loc.includes('/hologramas/') || loc.includes('/catalogo_scfi/') || (loc.includes('/reportes/') && (loc.includes('/SCFI/') || loc.includes('/ASEA/')))) {
                logoutHref = '../../login.html';
                perfilHref = '../../perfil.html';
            } else if (loc.includes('/SCFI/') || loc.includes('/ASEA/') || loc.includes('/reportes/')) {
                logoutHref = '../login.html';
                perfilHref = '../perfil.html';
            }
        }

        modal = document.createElement('div');
        modal.id = 'modal-opciones-perfil';
        modal.setAttribute('data-modal', '');
        modal.className = 'fixed inset-0 flex items-center justify-center p-3 sm:p-6 hidden';
        modal.style.cssText = 'position: fixed; inset: 0; z-index: 99999; display: none; align-items: center; justify-content: center; padding: 1rem;';
        modal.innerHTML = `
            <div class="modal-backdrop fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity" data-modal-close></div>
            <div class="modal-panel relative bg-dark-800 border border-dark-600/90 rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85),0_0_35px_rgba(234,179,8,0.12)] w-full max-w-2xl overflow-hidden z-10 flex flex-col max-h-[92vh] animate-scaleIn">
                
                <!-- Barra superior estilo ventana OS / Dashboard Pro -->
                <div class="flex items-center justify-between px-5 py-3.5 border-b border-dark-700/90 bg-gradient-to-r from-dark-900 via-dark-900/95 to-dark-800 select-none">
                    <div class="flex items-center gap-3">
                        <div class="flex items-center gap-1.5 mr-2">
                            <span class="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 cursor-pointer inline-block transition-colors" data-modal-close title="Cerrar ventana"></span>
                            <span class="w-3 h-3 rounded-full bg-amber-500/80 hover:bg-amber-500 cursor-pointer inline-block transition-colors" title="Minimizar"></span>
                            <span class="w-3 h-3 rounded-full bg-emerald-500/80 hover:bg-emerald-500 cursor-pointer inline-block transition-colors" title="Maximizar"></span>
                        </div>
                        <div class="h-4 w-px bg-dark-700"></div>
                        <div class="flex items-center gap-2 text-white font-bold text-sm">
                            <i class="ph ph-user-gear text-brand-yellow text-base"></i>
                            <span>Opciones de perfil</span>
                        </div>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-yellow/15 text-brand-yellow border border-brand-yellow/30">
                            Administrador
                        </span>
                    </div>
                    <button type="button" data-modal-close class="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-dark-700 transition-colors" aria-label="Cerrar ventana">
                        <i class="ph ph-x text-base"></i>
                    </button>
                </div>

                <!-- Cuerpo de la ventana con scroll interno -->
                <div class="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1">
                    
                    <!-- Tarjeta / Banner principal de usuario -->
                    <div class="p-5 rounded-2xl bg-gradient-to-r from-dark-900 via-dark-900/90 to-dark-700/40 border border-dark-700/80 relative overflow-hidden flex flex-col sm:flex-row items-center gap-5 shadow-inner">
                        <div class="relative shrink-0">
                            <div class="w-20 h-20 rounded-2xl bg-gradient-to-tr from-brand-yellow via-amber-500 to-yellow-400 text-dark-900 font-black text-3xl flex items-center justify-center shadow-xl shadow-brand-yellow/20 border-2 border-brand-yellow/40">
                                DG
                            </div>
                            <span class="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 border-[3px] border-dark-900 rounded-full shadow-md" title="Sesión activa"></span>
                        </div>
                        <div class="flex-1 text-center sm:text-left min-w-0">
                            <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
                                <h2 class="text-xl font-bold text-white tracking-wide">Denisse Gutierrez</h2>
                                <span class="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-brand-yellow/20 text-brand-yellow border border-brand-yellow/30">
                                    <i class="ph ph-shield-check text-sm"></i> Administrador
                                </span>
                            </div>
                            <p class="text-sm text-gray-400 font-mono mb-2">d.gutierrez@tecnocontrol.com.mx</p>
                            <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                                <span class="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                    Conectado al sistema
                                </span>
                                <span class="text-xs text-gray-400 bg-dark-800 px-2.5 py-0.5 rounded-md border border-dark-700">
                                    ID: #ADM-0012
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Pestañas de navegación de la ventana -->
                    <div class="flex items-center gap-2 border-b border-dark-700/80 pb-2 overflow-x-auto">
                        <button type="button" class="profile-tab-btn active px-4 py-2 rounded-xl text-xs font-bold text-brand-yellow bg-brand-yellow/10 border border-brand-yellow/30 transition-all flex items-center gap-2" data-tab="tab-general">
                            <i class="ph ph-identification-card text-sm"></i>
                            Información general
                        </button>
                        <button type="button" class="profile-tab-btn px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-dark-700/50 transition-all flex items-center gap-2 border border-transparent" data-tab="tab-permisos">
                            <i class="ph ph-shield text-sm"></i>
                            Rol y permisos
                        </button>
                        <button type="button" class="profile-tab-btn px-4 py-2 rounded-xl text-xs font-medium text-gray-400 hover:text-white hover:bg-dark-700/50 transition-all flex items-center gap-2 border border-transparent" data-tab="tab-seguridad">
                            <i class="ph ph-lock-key text-sm"></i>
                            Seguridad y sesión
                        </button>
                    </div>

                    <!-- Pestaña 1: Información General -->
                    <div id="tab-general" class="profile-tab-content space-y-3">
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div class="bg-dark-900/70 rounded-xl p-3.5 border border-dark-700/60">
                                <span class="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block mb-1">Nombre y apellido</span>
                                <div class="flex items-center gap-2">
                                    <i class="ph ph-user text-brand-yellow text-lg"></i>
                                    <span class="text-sm font-bold text-white">Denisse Gutierrez</span>
                                </div>
                            </div>

                            <div class="bg-dark-900/70 rounded-xl p-3.5 border border-dark-700/60">
                                <span class="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block mb-1">Usuario</span>
                                <div class="flex items-center gap-2">
                                    <i class="ph ph-identification-badge text-brand-yellow text-lg"></i>
                                    <span class="text-sm font-bold text-white font-mono">d.gutierrez</span>
                                </div>
                            </div>

                            <div class="bg-dark-900/70 rounded-xl p-3.5 border border-dark-700/60">
                                <span class="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block mb-1">Correo institucional</span>
                                <div class="flex items-center gap-2">
                                    <i class="ph ph-envelope text-brand-yellow text-lg"></i>
                                    <span class="text-sm text-gray-200">d.gutierrez@tecnocontrol.com.mx</span>
                                </div>
                            </div>

                            <div class="bg-dark-900/70 rounded-xl p-3.5 border border-dark-700/60">
                                <span class="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block mb-1">Puesto</span>
                                <div class="flex items-center gap-2">
                                    <i class="ph ph-briefcase text-brand-yellow text-lg"></i>
                                    <span class="text-sm text-white font-medium">No especificado</span>
                                </div>
                            </div>

                            <div class="bg-dark-900/70 rounded-xl p-3.5 border border-dark-700/60">
                                <span class="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block mb-1">Teléfono</span>
                                <div class="flex items-center gap-2">
                                    <i class="ph ph-phone text-brand-yellow text-lg"></i>
                                    <span class="text-sm text-gray-200 font-mono">No especificado</span>
                                </div>
                            </div>

                            <div class="bg-dark-900/70 rounded-xl p-3.5 border border-dark-700/60">
                                <span class="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block mb-1">Organización</span>
                                <div class="flex items-center gap-2">
                                    <i class="ph ph-buildings text-brand-yellow text-lg"></i>
                                    <span class="text-sm text-white font-medium">No especificado</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Pestaña 2: Rol y Permisos -->
                    <div id="tab-permisos" class="profile-tab-content space-y-3 hidden">
                        <div class="bg-dark-900/70 rounded-xl p-4 border border-dark-700/60 flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-brand-yellow/15 flex items-center justify-center text-brand-yellow border border-brand-yellow/30">
                                    <i class="ph ph-shield-check text-xl"></i>
                                </div>
                                <div>
                                    <span class="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block">Nivel de privilegios</span>
                                    <span class="text-sm font-bold text-brand-yellow">Administrador Global (Superusuario)</span>
                                </div>
                            </div>
                            <span class="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-xs font-semibold">
                                Acceso Total
                            </span>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                            <div class="bg-dark-900/50 p-3 rounded-lg border border-dark-700/50 flex items-center gap-2 text-gray-300">
                                <i class="ph ph-check-circle text-emerald-400 text-sm"></i>
                                <span>Gestión y Creación en SCFI</span>
                            </div>
                            <div class="bg-dark-900/50 p-3 rounded-lg border border-dark-700/50 flex items-center gap-2 text-gray-300">
                                <i class="ph ph-check-circle text-emerald-400 text-sm"></i>
                                <span>Gestión Integral ASEA</span>
                            </div>
                            <div class="bg-dark-900/50 p-3 rounded-lg border border-dark-700/50 flex items-center gap-2 text-gray-300">
                                <i class="ph ph-check-circle text-emerald-400 text-sm"></i>
                                <span>Asignación de Hologramas y Precintos</span>
                            </div>
                            <div class="bg-dark-900/50 p-3 rounded-lg border border-dark-700/50 flex items-center gap-2 text-gray-300">
                                <i class="ph ph-check-circle text-emerald-400 text-sm"></i>
                                <span>Exportación de Dictámenes y Reportes</span>
                            </div>
                            <div class="bg-dark-900/50 p-3 rounded-lg border border-dark-700/50 flex items-center gap-2 text-gray-300">
                                <i class="ph ph-check-circle text-emerald-400 text-sm"></i>
                                <span>Edición y Eliminación en Tablas</span>
                            </div>
                            <div class="bg-dark-900/50 p-3 rounded-lg border border-dark-700/50 flex items-center gap-2 text-gray-300">
                                <i class="ph ph-check-circle text-emerald-400 text-sm"></i>
                                <span>Asignación de Agenda y Calendario</span>
                            </div>
                        </div>
                    </div>

                    <!-- Pestaña 3: Seguridad y Sesión -->
                    <div id="tab-seguridad" class="profile-tab-content space-y-3 hidden">
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div class="bg-dark-900/70 rounded-xl p-3.5 border border-dark-700/60">
                                <span class="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block mb-1">Estado de conexión</span>
                                <span class="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                    Sesión Activa
                                </span>
                            </div>
                            <div class="bg-dark-900/70 rounded-xl p-3.5 border border-dark-700/60">
                                <span class="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block mb-1">Último acceso</span>
                                <span class="text-sm font-mono text-gray-200">Hoy, 15:30:18</span>
                            </div>
                            <div class="bg-dark-900/70 rounded-xl p-3.5 border border-dark-700/60">
                                <span class="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block mb-1">Dirección IP</span>
                                <span class="text-sm font-mono text-gray-300">192.168.1.104</span>
                            </div>
                            <div class="bg-dark-900/70 rounded-xl p-3.5 border border-dark-700/60">
                                <span class="text-[10px] text-gray-400 uppercase tracking-wider font-semibold block mb-1">Cifrado</span>
                                <span class="text-sm text-emerald-400 font-medium flex items-center gap-1">
                                    <i class="ph ph-lock-key"></i> HTTPS / TLS 1.3
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Barra inferior de acciones -->
                <div class="p-4 sm:p-5 border-t border-dark-700/90 bg-dark-900/90 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div class="text-xs text-gray-400 hidden sm:flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-brand-yellow"></span>
                        <span>SUDI Sistema Único de Dictámenes</span>
                    </div>
                    <div class="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
                        <a href="${perfilHref}" class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-dark-700 hover:bg-dark-600 text-brand-yellow hover:text-yellow-300 border border-brand-yellow/30 text-xs font-semibold transition-all">
                            <i class="ph ph-arrow-square-out text-base"></i>
                            <span>Ver página completa</span>
                        </a>
                        <button type="button" data-modal-close class="px-4 py-2.5 rounded-xl bg-dark-700 hover:bg-dark-600 text-gray-200 hover:text-white text-xs font-semibold transition-all">
                            Cerrar ventana
                        </button>
                        <a href="${logoutHref}" class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 hover:text-red-300 border border-red-500/30 font-bold text-xs transition-all shadow-sm group">
                            <i class="ph ph-sign-out text-base group-hover:-translate-x-0.5 transition-transform"></i>
                            <span>Cerrar sesión</span>
                        </a>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Control de pestañas
        modal.querySelectorAll('.profile-tab-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');
                modal.querySelectorAll('.profile-tab-btn').forEach(b => {
                    b.classList.remove('active', 'text-brand-yellow', 'bg-brand-yellow/10', 'border-brand-yellow/30');
                    b.classList.add('text-gray-400', 'border-transparent');
                });
                btn.classList.add('active', 'text-brand-yellow', 'bg-brand-yellow/10', 'border-brand-yellow/30');
                btn.classList.remove('text-gray-400', 'border-transparent');

                modal.querySelectorAll('.profile-tab-content').forEach(c => c.classList.add('hidden'));
                const activeContent = modal.querySelector('#' + targetTab);
                if (activeContent) activeContent.classList.remove('hidden');
            });
        });

        modal.querySelectorAll('[data-modal-close]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeModal(modal);
            });
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('modal-backdrop')) {
                closeModal(modal);
            }
        });

        return modal;
    }

    function initProfileModal(root = document) {
        // Asegurar que el modal exista en el DOM
        ensureProfileModal();

        // Enlaza triggers explícitos y tarjetas de perfil en el sidebar
        const profileElements = root.querySelectorAll('[data-profile-trigger], [data-modal-open="modal-opciones-perfil"], aside [data-profile-trigger], aside .p-4.border-t > div:first-child');
        profileElements.forEach((el) => {
            if (el.tagName === 'A' && el.getAttribute('href')?.includes('login.html')) return;
            if (!el.getAttribute('title')) {
                el.setAttribute('title', 'Opciones de perfil');
            }
            el.classList.add('group', 'cursor-pointer');

            if (!el.dataset.profileBound) {
                el.dataset.profileBound = 'true';
                el.addEventListener('click', (e) => {
                    if (e.target.closest('a[href*="login.html"]')) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const m = ensureProfileModal();
                    openModal(m);
                });
            }
        });
    }

    // Delegación global infalible para cualquier clic en el perfil del sidebar
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-profile-trigger], [data-modal-open="modal-opciones-perfil"], aside [data-profile-trigger], aside .p-4.border-t > div:first-child');
        if (trigger) {
            if (e.target.closest('a[href*="login.html"]')) return;
            e.preventDefault();
            e.stopPropagation();
            const m = ensureProfileModal();
            openModal(m);
        }
    });

    // ---------------------------------------------------------------
    // Mantener activo el menú del sidebar según la URL actual
    // ---------------------------------------------------------------
    function initSidebarActiveState() {
        const path = window.location.pathname;
        const pageName = path.substring(path.lastIndexOf('/') + 1) || 'index.html';
        
        const sidebarLinks = document.querySelectorAll('aside nav a, aside .menu-desplegable-btn + div a, aside [id^="menu-"] a');
        
        sidebarLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;
            
            const hrefPageName = href.substring(href.lastIndexOf('/') + 1);
            
            // Comparación exacta del nombre del archivo (para no confundir precintos.html con asignar_precintos.html)
            if (pageName && hrefPageName === pageName) {
                // Resaltar el enlace actual
                link.classList.remove('text-gray-400');
                link.classList.add('text-white', 'font-bold');
                const icon = link.querySelector('i');
                if (icon) {
                    icon.classList.add('text-brand-yellow');
                }
                
                // Si está dentro de un menú desplegable, lo abrimos
                const parentMenu = link.closest('.hidden');
                if (parentMenu && parentMenu.id && parentMenu.id.startsWith('menu-')) {
                    parentMenu.classList.remove('hidden');
                    parentMenu.style.display = 'block';
                    
                    const toggleBtn = document.querySelector(`[data-target="${parentMenu.id}"]`);
                    if (toggleBtn) {
                        const caret = toggleBtn.querySelector('.ph-caret-down');
                        if (caret) caret.classList.add('rotate-180');
                    }
                }
            }
        });
    }

    window.App = {
        toast,
        openModal,
        closeModal,
        openProfileModal: () => openModal(ensureProfileModal()),
        initModals,
        initDropdowns,
        initSearch,
        initPagination,
        confirmAction,
        initSidebarToggle,
        initProfileModal,
        initSidebarActiveState,
        withLoading,
        fakeRequest,
    };

    document.addEventListener('DOMContentLoaded', () => {
        initModals();
        initDropdowns();
        initSidebarToggle();
        initProfileModal();
        initSidebarActiveState();

        // Carga automática de table-actions.js si no está presente en el documento
        if (!window.__tableActionsInitialized && !document.querySelector('script[src*="table-actions.js"]')) {
            const appScript = document.querySelector('script[src*="app.js"]');
            if (appScript) {
                const s = document.createElement('script');
                s.src = appScript.getAttribute('src').replace('app.js', 'table-actions.js');
                s.defer = true;
                document.body.appendChild(s);
            }
        }
    });
})();


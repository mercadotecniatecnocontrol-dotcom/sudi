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
        const modal = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
        if (!modal) return;
        modal.classList.remove('hidden');
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
        setTimeout(() => modal.classList.add('hidden'), 200);
    }

    function initModals(root = document) {
        root.querySelectorAll('[data-modal-open]').forEach((btn) => {
            btn.addEventListener('click', () => openModal(btn.getAttribute('data-modal-open')));
        });
        root.querySelectorAll('[data-modal-close]').forEach((btn) => {
            btn.addEventListener('click', () => closeModal(btn.closest('[data-modal]')));
        });
        root.querySelectorAll('[data-modal]').forEach((modal) => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal(modal);
            });
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('[data-modal].modal-open').forEach(closeModal);
            }
        });
    }

    // ---------------------------------------------------------------
    // Dropdowns simples (botón con data-dropdown-toggle -> panel data-dropdown)
    // ---------------------------------------------------------------
    function initDropdowns(root = document) {
        root.querySelectorAll('[data-dropdown-toggle]').forEach((btn) => {
            const panel = document.getElementById(btn.getAttribute('data-dropdown-toggle'));
            if (!panel) return;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = !panel.classList.contains('hidden');
                document.querySelectorAll('[data-dropdown]').forEach((p) => p.classList.add('hidden'));
                if (!isOpen) panel.classList.remove('hidden');
            });
        });
        document.addEventListener('click', () => {
            document.querySelectorAll('[data-dropdown]').forEach((p) => p.classList.add('hidden'));
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
        confirmBtn.className = `px-4 py-2 text-sm rounded-lg font-medium text-white transition-colors ${danger ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-orange hover:bg-orange-600'}`;
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

    window.App = {
        toast,
        openModal,
        closeModal,
        initModals,
        initDropdowns,
        initSearch,
        initPagination,
        confirmAction,
        initSidebarToggle,
        withLoading,
        fakeRequest,
    };

    document.addEventListener('DOMContentLoaded', () => {
        initModals();
        initDropdowns();
        initSidebarToggle();
    });
})();

const state = { orders: [], customers: [], products: [], materials: [], units: [], warehouse: { articles: [], materials: [] } };
const statusNames = { 1: 'Impegnato', 2: 'Consegnato', 3: 'Annullato', 4: 'Parzialmente consegnato' };
const statusClass = { 1: 'committed', 2: 'delivered', 3: 'cancelled', 4: 'partial' };
const lineStatusNames = { 1: 'Da consegnare', 2: 'Consegnata', 3: 'Annullata', 4: 'Parzialmente consegnata' };
const lineStatusClass = { 1: 'committed', 2: 'delivered', 3: 'cancelled', 4: 'partial' };

const $ = (selector) => document.querySelector(selector);
const formatMoney = (value) => Number(value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const formatDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('it-IT') : '—';
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));


async function checkSession() {
    const response = await fetch('/api/auth/me', {
        method: 'GET',
        credentials: 'include'
    });

    if (!response.ok) {
        return null;
    }

    const data = await response.json();

    if (!data.authenticated) {
        return null;
    }

    setLoggedUser(data.user);

    return data.user;
}

async function login(email, password) {
    const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
            email,
            password
        })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || 'Login fallito');
    }

    setLoggedUser(data.user);

    return data;
}

async function logout() {
    await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
    });

    document
        .getElementById('app-shell')
        .classList.add('hidden');

    document
        .getElementById('login-screen')
        .classList.remove('hidden');

    document
        .getElementById('login-password')
        .value = '';
}

const loginForm = document.getElementById('login-form');

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = document
        .getElementById('login-email')
        .value
        .trim();

    const password = document
        .getElementById('login-password')
        .value;

    const errorElement =
        document.getElementById('login-error');

    const loginButton =
        document.getElementById('login-button');

    errorElement.classList.add('hidden');
    errorElement.textContent = '';

    loginButton.disabled = true;
    loginButton.textContent = 'Accesso...';

    try {
        const data = await login(email, password);

        console.log('Login effettuato:', data.user);

        document
            .getElementById('login-screen')
            .classList.add('hidden');

        document
            .getElementById('app-shell')
            .classList.remove('hidden');

        await loadData();

    } catch (error) {

        errorElement.textContent =
            error.message || 'Credenziali non valide';

        errorElement.classList.remove('hidden');

    } finally {

        loginButton.disabled = false;
        loginButton.textContent = 'Accedi';
    }
});

async function initApp() {
    try {
        const user = await checkSession();

        if (user) {
            console.log('Sessione valida:', user);

            document
                .getElementById('login-screen')
                .classList.add('hidden');

            document
                .getElementById('app-shell')
                .classList.remove('hidden');

            await loadData();

        } else {

            console.log('Nessuna sessione attiva');

            document
                .getElementById('login-screen')
                .classList.remove('hidden');

            document
                .getElementById('app-shell')
                .classList.add('hidden');
        }

    } catch (error) {
        console.error('Errore inizializzazione:', error);

        document
            .getElementById('login-screen')
            .classList.remove('hidden');

        document
            .getElementById('app-shell')
            .classList.add('hidden');
    }
}

setCurrentDate();
initApp();

async function api(path, options = {}) {
    const response = await fetch(`/api/${path}`, {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    });
    const responseText = await response.text();
    let body = {};
    if (responseText) {
        try {
            body = JSON.parse(responseText);
        } catch (error) {
            if (!response.ok) throw new Error(responseText);
        }
    }
    if (!response.ok) {
        throw new Error(body.error || `Errore ${response.status}`);
    }
    return response.status === 204 || !responseText ? null : body;
}

function showToast(message, error = false) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.toggle('error', error);
    toast.classList.remove('hidden');
    window.setTimeout(() => toast.classList.add('hidden'), 3200);
}

function statusBadge(status) { return `<span class="status ${statusClass[status] || 'open'}">${statusNames[status] || 'Impegnato'}</span>`; }
function lineStatusBadge(status) { return `<span class="status ${lineStatusClass[status] || 'open'}">${lineStatusNames[status] || 'Da consegnare'}</span>`; }
function customerName(id) { return state.customers.find((customer) => customer.id === Number(id))?.nome || 'Cliente rimosso'; }
function productName(id) { const product = state.products.find((item) => item.id === Number(id)); return product ? `${product.codice} · ${product.descrizione || ''}` : 'Articolo'; }

function renderMetrics() {
    $('#metric-orders').textContent = state.orders.length;
    $('#metric-customers').textContent = state.customers.length;
    $('#metric-products').textContent = state.products.length;
    const pending = state.orders.filter((order) => [1, 4].includes(Number(order.stato))).length;
    $('#metric-pending').textContent = pending;
    $('#pending-progress').style.width = `${state.orders.length ? Math.max(10, (pending / state.orders.length) * 100) : 0}%`;
    $('#order-nav-count').textContent = state.orders.length;
}

function orderRow(order, compact = false) {
    const actions = `<span class="order-actions"><button class="row-action" data-order-id="${order.id}" title="Apri ordine" aria-label="Apri ordine">👓</button></span>`;
    return `<tr class="order-table-row" data-id="${order.id}"><td><span class="order-number">${String(order.id).padStart(4, '0')}</span></td><td><span class="table-link">${escapeHtml(order.cliente_nome || customerName(order.cliente_id))}</span></td><td>${escapeHtml(order.cliente_zona || '—')}</td><td>${formatDate(order.data)}</td><td><strong class="order-total-cell">${formatMoney(order.totale_ordine)}</strong></td>${compact ? `<td>${statusBadge(order.stato)}</td><td>${actions}</td>` : `<td><span class="pay ${Number(order.pagato) === 1 ? 'yes' : ''}">${Number(order.pagato) === 1 ? 'Pagato' : Number(order.pagato) === 3 ? 'Parzialmente pagato' : 'Da pagare'}</span></td><td>${statusBadge(order.stato)}</td><td>${actions}</td>`}</tr>`;
}

function renderOrders() {
    $('#order-search').placeholder = 'Cerca per numero, cliente o zona...';
    const toolbar = $('#order-filter').parentElement;
    let zoneFilter = $('#zone-filter');
    if (!zoneFilter) {
        zoneFilter = document.createElement('select');
        zoneFilter.id = 'zone-filter';
        zoneFilter.addEventListener('change', renderOrders);
        toolbar.appendChild(zoneFilter);
    }
    const selectedZone = zoneFilter.value;
    const zones = [...new Set(state.orders.map((order) => order.cliente_zona).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it'));
    zoneFilter.innerHTML = `<option value="all">Tutte le zone</option>${zones.map((zone) => `<option value="${escapeHtml(zone)}">${escapeHtml(zone)}</option>`).join('')}`;
    zoneFilter.value = zones.includes(selectedZone) ? selectedZone : 'all';
    const query = ($('#order-search')?.value || '').toLowerCase();
    const filter = $('#order-filter')?.value || 'all';
    const rows = state.orders.filter((order) => (!query || String(order.id).includes(query) || (order.cliente_nome || customerName(order.cliente_id)).toLowerCase().includes(query) || (order.cliente_zona || '').toLowerCase().includes(query)) && (filter === 'all' || String(order.stato) === filter) && (zoneFilter.value === 'all' || order.cliente_zona === zoneFilter.value));
    if ($('#order-filter') && $('#order-filter').options[1]?.textContent === 'Aperto') $('#order-filter').innerHTML = '<option value="all">Tutti gli stati</option><option value="1">Impegnato</option><option value="4">Parzialmente consegnato</option><option value="2">Consegnato</option><option value="3">Annullato</option>';
    $('#orders-table').closest('table').querySelector('thead tr').innerHTML = '<th>Numero</th><th>Cliente</th><th>Zona</th><th>Data</th><th>Totale</th><th>Pagamento</th><th>Stato</th><th></th>';
    $('#recent-orders').closest('table').querySelector('thead tr').innerHTML = '<th>Ordine</th><th>Cliente</th><th>Zona</th><th>Data</th><th>Totale</th><th>Stato</th><th></th>';
    $('#orders-table').innerHTML = rows.length ? rows.map((order) => orderRow(order)).join('') : '<tr><td colspan="8" class="empty">Nessun ordine trovato.</td></tr>';
    $('#recent-orders').innerHTML = state.orders.slice(0, 6).map((order) => orderRow(order, true)).join('') || '<tr><td colspan="7" class="empty">Nessun ordine disponibile.</td></tr>';
}

function renderCustomers() {
    const query = ($('#customer-search')?.value || '').toLowerCase();
    const rows = state.customers.filter((customer) => [customer.nome, customer.localita, customer.telefono, customer.zona].join(' ').toLowerCase().includes(query));
    $('#customers-table').innerHTML = rows.length ? rows.map((customer) => `<tr class="customer-table-row"><td><span class="table-link">${escapeHtml(customer.nome)}</span><small class="muted-cell">${escapeHtml(customer.zona || '')}</small></td><td>${escapeHtml(customer.localita || '—')}</td><td>${escapeHtml(customer.telefono || '—')}</td><td>${escapeHtml(customer.indirizzo || '—')}</td><td><span class="customer-actions"><button class="row-action" data-customer-id="${customer.id}" title="Apri cliente" aria-label="Apri cliente">👓</button></span></td></tr>`).join('') : '<tr><td colspan="5" class="empty">Nessun cliente trovato.</td></tr>';
}

function renderProducts() {
    const query = ($('#product-search')?.value || '').toLowerCase();
    const rows = state.products.filter((product) => `${product.codice} ${product.descrizione}`.toLowerCase().includes(query));
    $('#products-table').innerHTML = rows.length ? rows.map((product) => `<tr><td><span class="order-number">${escapeHtml(product.codice)}</span></td><td><span class="table-link">${escapeHtml(product.descrizione || '—')}</span></td><td>${escapeHtml(product.materiale_descrizione || product.materiale || '—')}</td><td>${escapeHtml(product.um_vendita_descrizione || product.um_vendita || '—')}</td><td>${formatMoney(product.prezzo_vendita)}</td><td><button class="row-action" data-product-id="${product.id}" title="Apri articolo">👓</button></td></tr>`).join('') : '<tr><td colspan="6" class="empty">Nessun articolo trovato.</td></tr>';
}

function stockValue(value) { return Number(value || 0).toLocaleString('it-IT', { maximumFractionDigits: 3 }); }
function formatMovementDate(value) { const text = String(value || ''); if (/^\d{2}-\d{2}-\d{4}$/.test(text)) return text; if (/^\d{4}-\d{2}-\d{2}/.test(text)) { const [year, month, day] = text.slice(0, 10).split('-'); return `${day}-${month}-${year}`; } return text || '—'; }
function renderWarehouse() {
    const articles = state.warehouse.articles || [];
    const materials = state.warehouse.materials || [];
    $('#warehouse-articles').innerHTML = articles.map((item) => `<tr class="warehouse-table-row"><td><span class="order-number">${escapeHtml(item.codice)}</span></td><td>${escapeHtml(item.descrizione || '—')}</td><td>${escapeHtml(item.unita_vendita_descrizione || item.unita_vendita || '—')}</td><td>${stockValue(item.giacenza_fisica)}</td><td>${stockValue(item.stock_impegnato)}</td><td><strong class="stock-${Number(item.stock_disponibile) < 0 ? 'negative' : 'positive'}">${stockValue(item.stock_disponibile)}</strong></td></tr>`).join('') || '<tr><td colspan="6" class="empty">Nessun articolo disponibile.</td></tr>';
    $('#warehouse-materials').innerHTML = materials.map((item) => `<tr class="warehouse-table-row"><td><span class="order-number">${escapeHtml(item.materiale_codice)}</span></td><td>${escapeHtml(item.materiale_descrizione || '—')}</td><td>${escapeHtml(item.unita_base_descrizione || item.unita_base || '—')}</td><td>${stockValue(item.giacenza_fisica)}</td><td>${stockValue(item.stock_impegnato)}</td><td><strong class="stock-${Number(item.stock_disponibile) < 0 ? 'negative' : 'positive'}">${stockValue(item.stock_disponibile)}</strong></td></tr>`).join('') || '<tr><td colspan="6" class="empty">Nessun materiale disponibile.</td></tr>';
}

function renderMovements() {
    const query = ($('#movement-filter')?.value || '').toLowerCase();
    const movements = (state.warehouse.movements || []).filter((item) => `${item.articolo_codice} ${item.articolo_descrizione || ''} ${item.tipo}`.toLowerCase().includes(query));
    $('#warehouse-movements').innerHTML = movements.map((item) => `<tr class="movement-table-row"><td>${formatMovementDate(item.data)}</td><td><strong>${escapeHtml(item.articolo_codice)}</strong><small class="muted-cell">${escapeHtml(item.articolo_descrizione || '')}</small></td><td>${escapeHtml(item.unita_vendita_descrizione || item.unita_vendita || '—')}</td><td><span class="movement-type ${String(item.tipo).toLowerCase()}">${escapeHtml(item.tipo)}</span></td><td class="movement-quantity ${Number(item.quantita) < 0 ? 'negative' : 'positive'}">${stockValue(item.quantita)}</td><td>${item.riferimento_ordine_id || item.riferimento_id || '—'}</td><td>${item.riferimento_riga_id || '—'}</td><td>${escapeHtml(item.note || '—')}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">Nessun movimento trovato.</td></tr>';
}

document.addEventListener('click', (event) => {
    const warehouseTab = event.target.closest('[data-warehouse-tab]');
    if (!warehouseTab) return;
    document.querySelectorAll('[data-warehouse-tab]').forEach((tab) => {
        const active = tab === warehouseTab;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', active);
    });
    document.querySelectorAll('[data-warehouse-panel]').forEach((panel) => panel.classList.toggle('hidden', panel.dataset.warehousePanel !== warehouseTab.dataset.warehouseTab));
});

document.addEventListener('input', (event) => {
    if (event.target.id === 'movement-filter') renderMovements();
});

function closeMobileMenu() {
    $('.sidebar').classList.remove('mobile-open');
    $('#mobile-nav-backdrop').classList.add('hidden');
    $('#menu-toggle').setAttribute('aria-expanded', 'false');
}

$('#menu-toggle').addEventListener('click', () => {
    const isOpen = $('.sidebar').classList.toggle('mobile-open');
    $('#mobile-nav-backdrop').classList.toggle('hidden', !isOpen);
    $('#menu-toggle').setAttribute('aria-expanded', String(isOpen));
});
$('#mobile-nav-backdrop').addEventListener('click', closeMobileMenu);
document.addEventListener('click', (event) => {
    if (event.target.closest('[data-view]')) closeMobileMenu();
});

function openDrawer(content) { $('#drawer-content').innerHTML = content.replace(/(ORDINE|Ordine) #(\d+)/g, '$1 $2'); $('#drawer-backdrop').classList.remove('hidden'); }
function closeDrawer() { $('#drawer-backdrop').classList.add('hidden'); }

function movementForm() {
    const today = new Date().toISOString().slice(0, 10);
    const productOptions = state.products.map((product) => `<option value="${product.id}">${escapeHtml(product.codice)} · ${escapeHtml(product.descrizione || '')} (${escapeHtml(product.um_vendita_codice || '')})</option>`).join('');
    openDrawer(`<p class="eyebrow">CONTROLLO MAGAZZINO</p><h2>Nuovo movimento</h2><p class="drawer-subtitle">Registra un carico, uno scarico o una rettifica.</p><form id="movement-form"><div class="form-grid"><div class="field full"><label>Articolo *</label><select name="articoloId" required><option value="">Seleziona articolo</option>${productOptions}</select></div><div class="field"><label>Tipo movimento *</label><select name="tipo" required><option value="CARICO">Carico</option><option value="SCARICO">Scarico</option><option value="RETTIFICA">Rettifica</option></select></div><div class="field numeric-field"><label>Quantità *</label><input name="quantita" type="number" step="0.01" required placeholder="0,00"><small class="line-hint">La quantità usa l'unità di vendita dell'articolo.</small></div><div class="field"><label>Data</label><input name="data" type="date" value="${today}"></div><div class="field full"><label>Note</label><textarea name="note" placeholder="Causale o riferimento"></textarea></div></div><div class="form-actions"><button type="button" class="secondary-button" id="cancel-form">Annulla</button><button class="primary-button">Registra movimento</button></div></form>`);
    $('#movement-form').addEventListener('submit', async (event) => { event.preventDefault(); const raw = Object.fromEntries(new FormData(event.currentTarget)); const endpoint = raw.tipo === 'CARICO' ? 'magazzino/carichi' : raw.tipo === 'SCARICO' ? 'magazzino/scarichi' : 'magazzino/rettifiche'; const data = raw.tipo === 'RETTIFICA' ? { articoloId: Number(raw.articoloId), delta: Number(raw.quantita), note: raw.note } : { articoloId: Number(raw.articoloId), quantita: Number(raw.quantita), data: raw.data, note: raw.note }; try { await api(endpoint, { method: 'POST', body: JSON.stringify(data) }); closeDrawer(); await loadWarehouse(); showToast('Movimento registrato'); } catch (error) { showToast(error.message, true); } });
    $('#cancel-form').addEventListener('click', closeDrawer);
}

function materialForm() {
    const unitOptions = state.units.map((unit) => `<option value="${unit.id}">${escapeHtml(unit.descrizione || unit.codice)}</option>`).join('');
    openDrawer(`<p class="eyebrow">ANAGRAFICA MATERIALI</p><h2>Nuovo materiale</h2><p class="drawer-subtitle">Definisci il materiale e la sua unità di misura base.</p><form id="material-form"><div class="form-grid"><div class="field"><label>Codice *</label><input name="codice" required></div><div class="field"><label>UM base *</label><select name="um_base" required><option value="">Seleziona</option>${unitOptions}</select></div><div class="field full"><label>Descrizione</label><input name="descrizione"></div><div class="field full"><label>Categoria</label><input name="categoria"></div></div><div class="form-actions"><button type="button" class="secondary-button" id="cancel-form">Annulla</button><button class="primary-button">Crea materiale</button></div></form>`);
    $('#material-form').addEventListener('submit', async (event) => { event.preventDefault(); const raw = Object.fromEntries(new FormData(event.currentTarget)); try { await api('materiali', { method: 'POST', body: JSON.stringify({ ...raw, um_base: Number(raw.um_base) }) }); closeDrawer(); await loadData(); showToast('Materiale creato'); } catch (error) { showToast(error.message, true); } });
    $('#cancel-form').addEventListener('click', closeDrawer);
}

async function copyOrder(id) {
    try {
        const order = await api(`ordini/${id}`);

        const customerId = Number(order.cliente_id);

       const customerExists = state.customers.some(
            customer => Number(customer.id) === customerId
        );

        if (!customerExists) {
            showToast(
                `Il cliente associato all'ordine ${String(order.id).padStart(4, '0')} non è presente in anagrafica!`,
                true
            );
            return;
        }

        const copiedLines = (order.righe || []).map(line => ({
            articolo_id: Number(line.articolo_id),
            quantita: Number(line.quantita),
            quantita_consegnata: 0,
            prezzo_applicato: Number(line.prezzo_applicato),
            stato_riga: 1,
            data_consegna: null
        }));

        orderForm({
            ...order,

            // IMPORTANTISSIMO
            cliente_id: customerId,

            righe: copiedLines,

            // La data va sempre riproposta come oggi, non quella del vecchio ordine
            data: null,
            stato: 1,
            pagato: 2
        }, true);

    } catch (error) {
        showToast(error.message, true);
    }
}

function copyCustomer(id) {
    const customer = state.customers.find((item) => item.id === Number(id));
    if (customer) customerForm({ ...customer, id: undefined, nome: `${customer.nome} (copia)` });
}

function customerForm(customer = {}) {
    const editing = Boolean(customer.id);
    openDrawer(`<p class="eyebrow">ANAGRAFICA CLIENTE</p><h2>${editing ? 'Modifica cliente' : 'Nuovo cliente'}</h2><p class="drawer-subtitle">Completa i dati essenziali del contatto.</p><form id="customer-form" data-id="${customer.id || ''}"><div class="form-grid"><div class="field full"><label>Nome / Ragione sociale *</label><input name="nome" required value="${escapeHtml(customer.nome)}"></div><div class="field full"><label>Indirizzo</label><input name="indirizzo" value="${escapeHtml(customer.indirizzo)}"></div><div class="field"><label>Località</label><input name="localita" value="${escapeHtml(customer.localita)}"></div><div class="field"><label>Telefono</label><input name="telefono" value="${escapeHtml(customer.telefono)}"></div><div class="field"><label>Zona</label><input name="zona" value="${escapeHtml(customer.zona)}"></div><div class="field full"><label>Note</label><textarea name="note">${escapeHtml(customer.note)}</textarea></div></div><div class="form-actions"><button type="button" class="secondary-button" id="cancel-form">Annulla</button><button class="primary-button">${editing ? 'Salva modifiche' : 'Crea cliente'}</button></div></form>`);
    if (editing) {
        $('#customer-form .form-actions').insertAdjacentHTML('afterbegin', '<button type="button" class="danger-button" id="delete-customer">Elimina</button><button type="button" class="secondary-button" id="copy-customer">Copia</button>');
        $('#delete-customer').addEventListener('click', async () => {
            if (!window.confirm(`Eliminare definitivamente il cliente "${customer.nome}"?`)) return;
            try {
                await api(`clienti/${customer.id}`, { method: 'DELETE' });
                closeDrawer();
                await loadData();
                showToast('Cliente eliminato');
            } catch (error) {
                showToast(error.message, true);
            }
        });
        $('#copy-customer').addEventListener('click', () => copyCustomer(customer.id));
    }
    $('#customer-form').addEventListener('submit', async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); try { await api(`clienti${editing ? `/${customer.id}` : ''}`, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(data) }); closeDrawer(); await loadData(); showToast(editing ? 'Cliente aggiornato' : 'Cliente creato'); } catch (error) { showToast(error.message, true); } });
    $('#cancel-form').addEventListener('click', closeDrawer);
}

function copyProduct(id) {
    const product = state.products.find((item) => Number(item.id) === Number(id));
    if (product) productForm({ ...product, id: undefined, codice: `${product.codice} (copia)` });
}

function productForm(product = {}) {
    const editing = Boolean(product.id);
    const materialOptions = state.materials.map((material) => `<option value="${material.id}" ${Number(product.materiale) === material.id ? 'selected' : ''}>${escapeHtml(material.codice)} · ${escapeHtml(material.descrizione || '')}</option>`).join('');
    const unitOptions = state.units.map((unit) => `<option value="${unit.id}" ${Number(product.um_vendita) === unit.id ? 'selected' : ''}>${escapeHtml(unit.codice)} · ${escapeHtml(unit.descrizione || '')}</option>`).join('');
    openDrawer(`<p class="eyebrow">CATALOGO ARTICOLI</p><h2>${editing ? 'Modifica articolo' : 'Nuovo articolo'}</h2><p class="drawer-subtitle">Aggiorna codice, unità e prezzi del listino.</p><form id="product-form" data-id="${product.id || ''}"><div class="form-grid"><div class="field"><label>Codice *</label><input name="codice" required value="${escapeHtml(product.codice)}"></div><div class="field"><label>UM vendita *</label><select name="um_vendita" required><option value="">Seleziona</option>${unitOptions}</select></div><div class="field full"><label>Descrizione</label><input name="descrizione" value="${escapeHtml(product.descrizione)}"></div><div class="field full"><label>Materiale *</label><select name="materiale" required><option value="">Seleziona</option>${materialOptions}</select></div><div class="field"><label>Moltiplicatore UM</label><input type="number" step="0.01" name="um_base_x_um" value="${product.um_base_x_um ?? ''}"></div><div class="field"><label>Prezzo vendita</label><input type="number" step="0.01" name="prezzo_vendita" value="${product.prezzo_vendita ?? 0}"></div><div class="field"><label>Prezzo acquisto</label><input type="number" step="0.01" name="prezzo_acquisto" value="${product.prezzo_acquisto ?? 0}"></div></div><div class="form-actions"><button type="button" class="secondary-button" id="cancel-form">Annulla</button><button class="primary-button">${editing ? 'Salva modifiche' : 'Crea articolo'}</button></div></form>`);
    if (editing) {
        $('#product-form .form-actions').insertAdjacentHTML('afterbegin', '<button type="button" class="secondary-button" id="copy-product">Copia</button>');
        $('#copy-product').addEventListener('click', () => copyProduct(product.id));
    }
    $('#product-form').addEventListener('submit', async (event) => { event.preventDefault(); const raw = Object.fromEntries(new FormData(event.currentTarget)); const data = { ...raw, materiale: Number(raw.materiale), um_vendita: Number(raw.um_vendita), um_base_x_um: raw.um_base_x_um ? Number(raw.um_base_x_um) : null, prezzo_vendita: Number(raw.prezzo_vendita || 0), prezzo_acquisto: Number(raw.prezzo_acquisto || 0) }; try { await api(`articoli${editing ? `/${product.id}` : ''}`, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(data) }); closeDrawer(); await loadData(); showToast(editing ? 'Articolo aggiornato' : 'Articolo creato'); } catch (error) { showToast(error.message, true); } });
    $('#cancel-form').addEventListener('click', closeDrawer);
}

function orderForm(existingOrder = null, copying = false) {
    const editing = Boolean(existingOrder?.id) && !copying;

    /*
     * Recuperiamo SEMPRE il cliente tramite cliente_id.
     * cliente_nome viene usato solo come fallback per vecchi dati
     * che eventualmente non abbiano più il campo cliente_id valorizzato.
     */
    let selectedCustomerId = Number(existingOrder?.cliente_id || 0);

    /*if (!Number.isInteger(selectedCustomerId) || selectedCustomerId <= 0) {
        const customerFromOrder = state.customers.find(
            (customer) =>
                String(customer.nome).trim().toLowerCase() ===
                String(existingOrder?.cliente_nome || "").trim().toLowerCase()
        );

        selectedCustomerId = Number(customerFromOrder?.id || 0);
    }*/

   if (existingOrder && selectedCustomerId > 0) {
    const customerExists = state.customers.some(
        customer => Number(customer.id) === selectedCustomerId
    );

    if (!customerExists) {
        showToast(
            `Il cliente associato all'ordine ${String(existingOrder.id).padStart(4, '0')} non è presente in anagrafica!`,
            true
        );
        return;
    }
}

    /*
     * Per un nuovo ordine il cliente deve essere scelto dall'utente.
     * Per modifica/copia deve invece essere già selezionato.
     */
    let lines = existingOrder?.righe?.length
        ? existingOrder.righe.map((line) => ({
              // Solo le righe di un ordine esistente (modifica) hanno un id reale:
              // serve al backend per riconoscere la riga e non confondere i movimenti
              // di magazzino quando due righe condividono lo stesso articolo.
              ...(copying ? {} : { id: line.id }),
              articolo_id: Number(line.articolo_id) || "",
              quantita: Number(line.quantita) || 1,
              quantita_consegnata: Number(line.quantita_consegnata) || 0,
              prezzo_applicato: Number(line.prezzo_applicato) || 0,
              stato_riga: Number(line.stato_riga) || 1
          }))
        : [
              {
                  articolo_id: "",
                  quantita: 1,
                  quantita_consegnata: 0,
                  prezzo_applicato: 0,
                  stato_riga: 1
              }
          ];

    const productOptions = (selectedId) =>
        state.products
            .map(
                (product) =>
                    `<option value="${product.id}" ${
                        Number(selectedId) === Number(product.id)
                            ? "selected"
                            : ""
                    }>${escapeHtml(product.codice)} · ${escapeHtml(
                        product.descrizione || ""
                    )}</option>`
            )
            .join("");

    const getTotal = () =>
        lines.reduce(
            (total, line) =>
                total +
                (Number(line.quantita) || 0) *
                    (Number(line.prezzo_applicato) || 0),
            0
        );

    const updateTotal = () => {
        $("#order-total").textContent = formatMoney(getTotal());
    };

    const renderLines = () =>
        lines
            .map((line, index) => {
                const product = state.products.find(
                    (item) => Number(item.id) === Number(line.articolo_id)
                );

                const unit = product?.um_vendita_codice || "";
                const baseUnit = product?.um_base_codice || "";
                const conversion = Number(product?.um_base_x_um) || 1;

                const requestedBase =
                    (Number(line.quantita) || 0) * conversion;

                const deliveredBase =
                    (Number(line.quantita_consegnata) || 0) * conversion;

                return `
                    <div class="line-editor">
                        <div class="line-editor-heading">
                            <span>Riga ${index + 1}</span>
                            ${
                                lines.length > 1
                                    ? `<button type="button" class="remove-line" data-remove-line="${index}">Rimuovi</button>`
                                    : ""
                            }
                        </div>

                        <div class="field full">
                            <div class="line-field">
                                <label>Articolo</label>
                                <select
                                    data-line-field="articolo_id"
                                    data-line="${index}"
                                    required
                                >
                                    <option value="">Seleziona articolo</option>
                                    ${productOptions(line.articolo_id)}
                                </select>
                            </div>

                            <div class="line-field numeric-field">
                                <label>
                                    Quantità ordinata
                                    ${unit ? `<em>${unit}</em>` : ""}
                                </label>

                                <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    data-line-field="quantita"
                                    data-line="${index}"
                                    value="${line.quantita}"
                                    required
                                >

                                <small class="line-hint">
                                    Materiale richiesto:
                                    ${stockValue(requestedBase)}
                                    ${baseUnit}
                                </small>
                            </div>
                        </div>

                        <div class="line-row">
                            <div class="line-field numeric-field">
                                <label>
                                    Quantità consegnata
                                    ${unit ? `<em>${unit}</em>` : ""}
                                </label>

                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    max="${line.quantita}"
                                    data-line-field="quantita_consegnata"
                                    data-line="${index}"
                                    value="${line.quantita_consegnata}"
                                    required
                                >

                                <small class="line-hint">
                                    Residua:
                                    ${Math.max(
                                        0,
                                        Number(line.quantita) -
                                            Number(
                                                line.quantita_consegnata || 0
                                            )
                                    )}
                                    ${unit}
                                    ·
                                    ${stockValue(
                                        Math.max(
                                            0,
                                            requestedBase - deliveredBase
                                        )
                                    )}
                                    ${baseUnit}
                                </small>
                            </div>

                            <div class="field full">
                                <label>Stato consegna</label>

                                <select
                                    data-line-field="stato_riga"
                                    data-line="${index}"
                                    style="margin-top: 20px;"
                                >
                                    <option
                                        value="1"
                                        ${
                                            Number(line.stato_riga || 1) === 1
                                                ? "selected"
                                                : ""
                                        }
                                    >
                                        Da consegnare
                                    </option>

                                    <option
                                        value="2"
                                        ${
                                            Number(line.stato_riga) === 2
                                                ? "selected"
                                                : ""
                                        }
                                    >
                                        Consegnata
                                    </option>

                                    <option
                                        value="4"
                                        ${
                                            Number(line.stato_riga) === 4
                                                ? "selected"
                                                : ""
                                        }
                                    >
                                        Parzialmente consegnata
                                    </option>

                                    <option
                                        value="3"
                                        ${
                                            Number(line.stato_riga) === 3
                                                ? "selected"
                                                : ""
                                        }
                                    >
                                        Annullata
                                    </option>
                                </select>
                            </div>
                        </div>

                        <div class="line-field numeric-field">
                            <label>Prezzo applicato</label>

                            <input
                                class="line-price"
                                type="number"
                                min="0"
                                step="0.01"
                                data-line-field="prezzo_applicato"
                                data-line="${index}"
                                value="${line.prezzo_applicato}"
                                required
                            >
                        </div>
                    </div>
                `;
            })
            .join("");

    const customerOptions = state.customers
        .map(
            (customer) =>
                `<option value="${customer.id}" ${
                    Number(customer.id) === selectedCustomerId
                        ? "selected"
                        : ""
                }>${escapeHtml(customer.nome)}</option>`
        )
        .join("");

    openDrawer(`
        <p class="eyebrow">
            ${editing ? "MODIFICA ORDINE" : "NUOVA COMMESSA"}
        </p>

        <h2>
            ${
                editing
                    ? `Ordine #${String(existingOrder.id).padStart(4, "0")}`
                    : "Inserisci ordine"
            }
        </h2>

        <p class="drawer-subtitle">
            Registra cliente, pagamento e articoli richiesti.
        </p>

        <form id="order-form">
            <div class="form-grid">
                <div class="field">
                    <label>Cliente *</label>

                    <select name="cliente_id" required>
                        <option value="">Seleziona cliente</option>
                        ${customerOptions}
                    </select>
                </div>

                <div class="field full">
                    <label>Data ordine</label>

                    <input
                        type="date"
                        name="data"
                        value="${
                            existingOrder?.data ||
                            new Date().toISOString().slice(0, 10)
                        }"
                    >
                </div>

                <div class="field">
                    <label>Stato</label>

                    <select name="stato">
                        <option
                            value="1"
                            ${
                                Number(existingOrder?.stato) === 1
                                    ? "selected"
                                    : ""
                            }
                        >
                            Impegnato
                        </option>

                        <option
                            value="4"
                            ${
                                Number(existingOrder?.stato) === 4
                                    ? "selected"
                                    : ""
                            }
                        >
                            Parzialmente consegnato
                        </option>

                        <option
                            value="2"
                            ${
                                Number(existingOrder?.stato) === 2
                                    ? "selected"
                                    : ""
                            }
                        >
                            Consegnato
                        </option>

                        <option
                            value="3"
                            ${
                                Number(existingOrder?.stato) === 3
                                    ? "selected"
                                    : ""
                            }
                        >
                            Annullato
                        </option>
                    </select>
                </div>

                <div class="field check-field">
                    <label>
                        <input
                            type="checkbox"
                            name="pagato"
                            ${
                                Number(existingOrder?.pagato) === 1
                                    ? "checked"
                                    : ""
                            }
                        >
                        Pagato
                    </label>
                </div>

                <div class="field full">
                    <label>Note</label>

                    <textarea name="note_ordine">${escapeHtml(
                        existingOrder?.note_ordine || ""
                    )}</textarea>
                </div>
            </div>

            <div id="line-editors">
                ${renderLines()}
            </div>

            <div class="order-total">
                <span>Totale ordine</span>
                <strong id="order-total">${formatMoney(getTotal())}</strong>
            </div>

            <button type="button" class="add-line" id="add-line">
                ＋ Aggiungi riga
            </button>

            <div class="form-actions">
                <button
                    type="button"
                    class="secondary-button"
                    id="cancel-form"
                >
                    Annulla
                </button>

                <button type="submit" class="primary-button">
                    ${editing ? "Salva modifiche" : "Salva ordine"}
                </button>
            </div>
        </form>
    `);

    const customerSelect = document.querySelector(
        '#order-form select[name="cliente_id"]'
    );

    /*
     * Impostazione esplicita del valore.
     * È importante soprattutto su Safari/iPhone.
     */
    if (customerSelect && selectedCustomerId > 0) {
        customerSelect.value = String(selectedCustomerId);
    }

    const syncLine = (event) => {
        const field = event.target.dataset.lineField;

        if (!field) {
            return;
        }

        const index = Number(event.target.dataset.line);

        if (!lines[index]) {
            return;
        }

        lines[index][field] =
            event.target.type === "number"
                ? Number(event.target.value)
                : event.target.value;

        if (
            field === "stato_riga" &&
            Number(event.target.value) === 2
        ) {
            lines[index].quantita_consegnata =
                Number(lines[index].quantita) || 0;

            const deliveredInput = document.querySelector(
                `[data-line-field="quantita_consegnata"][data-line="${index}"]`
            );

            if (deliveredInput) {
                deliveredInput.value =
                    lines[index].quantita_consegnata;
            }
        }

        if (field === "articolo_id") {
            const product = state.products.find(
                (item) =>
                    Number(item.id) === Number(event.target.value)
            );

            if (product) {
                lines[index].prezzo_applicato =
                    Number(product.prezzo_vendita) || 0;
            }

            // Cambiando articolo la consegna precedente non è più valida
            // per il nuovo articolo: azzeriamo consegnato e stato riga.
            lines[index].quantita_consegnata = 0;
            lines[index].stato_riga = 1;

            redrawLines();
        }

        updateTotal();
    };

    const redrawLines = () => {
        $("#line-editors").innerHTML = renderLines();
        updateTotal();
    };

    $("#line-editors").addEventListener("input", syncLine);
    $("#line-editors").addEventListener("change", syncLine);

    $("#line-editors").addEventListener("click", (event) => {
        const removeButton = event.target.closest("[data-remove-line]");

        if (!removeButton) {
            return;
        }

        lines.splice(Number(removeButton.dataset.removeLine), 1);
        redrawLines();
    });

    $("#add-line").addEventListener("click", () => {
        lines.push({
            articolo_id: "",
            quantita: 1,
            quantita_consegnata: 0,
            prezzo_applicato: 0,
            stato_riga: 1
        });

        redrawLines();
    });

    $("#cancel-form").addEventListener("click", closeDrawer);

    $("#order-form").addEventListener("submit", async (event) => {
        event.preventDefault();

        const form = event.currentTarget;
        const raw = Object.fromEntries(new FormData(form));
        const customerSelect = form.querySelector(
            'select[name="cliente_id"]'
        );

        const customerId = Number(customerSelect?.value || 0);

        /*
         * Controlliamo sia il valore selezionato sia l'esistenza
         * del cliente nell'anagrafica caricata.
         */
        const customerExists = state.customers.some(
            (customer) => Number(customer.id) === customerId
        );

        if (
            !Number.isInteger(customerId) ||
            customerId <= 0 ||
            !customerExists
        ) {
            showToast("Seleziona un cliente valido", true);
            return;
        }

        const requestedStatus = Number(raw.stato);

        const formLines = lines.map((line, index) => {
            const field = (name) =>
                form.querySelector(
                    `[data-line-field="${name}"][data-line="${index}"]`
                );

            const quantita = Number(
                field("quantita")?.value
            );

            const statoRiga = Number(
                field("stato_riga")?.value || 1
            );

            const quantitaConsegnata = Number(
                field("quantita_consegnata")?.value || 0
            );

            return {
                ...line,
                articolo_id: Number(
                    field("articolo_id")?.value
                ),
                quantita,
                quantita_consegnata:
                    statoRiga === 2 || requestedStatus === 2
                        ? quantita
                        : quantitaConsegnata,
                prezzo_applicato: Number(
                    field("prezzo_applicato")?.value || 0
                ),
                stato_riga: statoRiga
            };
        });

        const data = {
            ...raw,
            cliente_id: customerId,
            stato: requestedStatus,
            pagato: form.elements.pagato.checked,
            righe: formLines
        };

        try {
            await api(
                `ordini${editing ? `/${existingOrder.id}` : ""}`,
                {
                    method: editing ? "PUT" : "POST",
                    body: JSON.stringify(data)
                }
            );

            closeDrawer();
            await loadData();

            showToast(
                editing
                    ? "Ordine aggiornato"
                    : "Ordine creato"
            );
        } catch (error) {
            showToast(error.message, true);
        }
    });
}

async function showOrder(id) { try { const order = await api(`ordini/${id}`); const total = Number(order.totale_ordine) || 0; openDrawer(`<p class="eyebrow">ORDINE #${String(order.id).padStart(4, '0')}</p><h2>${escapeHtml(order.cliente_nome)}</h2><p class="drawer-subtitle">${formatDate(order.data)} · ${statusBadge(order.stato)}</p><div class="customer-details"><div><span>Indirizzo</span><strong>${escapeHtml(order.cliente_indirizzo || '—')}</strong></div><div><span>Località</span><strong>${escapeHtml(order.cliente_localita || '—')}</strong></div><div><span>Zona</span><strong>${escapeHtml(order.cliente_zona || '—')}</strong></div></div><div class="detail-list">${(order.righe || []).map((line) => `<div class="detail-line"><div><strong>${escapeHtml(line.articolo_codice)}</strong><small>${escapeHtml(line.articolo_categoria || '')}</small></div><span>${line.quantita} × ${formatMoney(line.prezzo_applicato)}<small>${lineStatusBadge(line.stato_riga)}</small></span></div>`).join('') || '<p class="empty">Nessuna riga.</p>'}</div><div class="order-total"><span>Totale ordine</span><strong>${formatMoney(total)}</strong></div><div class="form-actions"><button class="secondary-button" id="close-detail">Chiudi</button><button class="primary-button" id="edit-order">Modifica ordine</button><button class="secondary-button" id="copy-order">Copia ordine</button></div>`); $('#close-detail').addEventListener('click', closeDrawer); $('#edit-order').addEventListener('click', () => orderForm(order)); $('#copy-order').addEventListener('click', () => copyOrder(order.id)); } catch (error) { showToast(error.message, true); } }

async function loadWarehouse() { const [articles, materials, movements] = await Promise.all([api('magazzino'), api('magazzino/materiali'), api('movimenti')]); state.warehouse = { articles, materials, movements }; renderWarehouse(); renderMovements(); }
async function loadData() { try { const [orders, customers, products] = await Promise.all([api('ordini'), api('clienti'), api('articoli')]); state.orders = orders; state.customers = customers; state.products = products; state.materials = await api('materiali').catch(() => []); state.units = await api('um').catch(() => []); await loadWarehouse(); renderMetrics(); renderOrders(); renderCustomers(); renderProducts(); } catch (error) { showToast(`Impossibile caricare i dati: ${error.message}`, true); } }

function switchView(view) { document.querySelectorAll('.page').forEach((page) => page.classList.toggle('hidden', page.id !== `${view}-view`)); document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === view)); $('#page-kicker').textContent = { overview: 'Panoramica', orders: 'Ordini', customers: 'Clienti', products: 'Articoli', warehouse: 'Magazzino' }[view]; if (view === 'warehouse') loadWarehouse().catch((error) => showToast(error.message, true)); }

document.addEventListener('click', (event) => { const nav = event.target.closest('[data-view]'); if (nav) switchView(nav.dataset.view); const target = event.target.closest('[data-view-target]'); if (target) switchView(target.dataset.viewTarget); if (event.target.closest('[data-action="new-order"]')) orderForm(); if (event.target.closest('[data-action="new-customer"]')) customerForm(); if (event.target.closest('[data-action="new-product"]')) productForm(); if (event.target.closest('[data-action="new-material"]')) materialForm(); if (event.target.closest('[data-action="new-movement"]')) movementForm(); const orderButton = event.target.closest('[data-order-id]'); if (orderButton) showOrder(orderButton.dataset.orderId); const customerButton = event.target.closest('[data-customer-id]'); if (customerButton) customerForm(state.customers.find((item) => item.id === Number(customerButton.dataset.customerId))); const productButton = event.target.closest('[data-product-id]'); if (productButton) productForm(state.products.find((item) => item.id === Number(productButton.dataset.productId))); });
$('#drawer-close').addEventListener('click', closeDrawer); $('#drawer-backdrop').addEventListener('click', (event) => { if (event.target.id === 'drawer-backdrop') closeDrawer(); }); $('#refresh-button').addEventListener('click', loadData); $('#warehouse-refresh').addEventListener('click', () => loadWarehouse().catch((error) => showToast(error.message, true))); $('#order-search').addEventListener('input', renderOrders); $('#order-filter').addEventListener('change', renderOrders); $('#customer-search').addEventListener('input', renderCustomers); $('#product-search').addEventListener('input', renderProducts); $('#today').textContent = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }); loadData();

const userMenuButton = document.getElementById('user-menu-button');
const userDropdown = document.getElementById('user-dropdown');
const logoutButton = document.getElementById('logout-button');

userMenuButton.addEventListener('click', (event) => {
    event.stopPropagation();

    const isOpen = !userDropdown.classList.contains('hidden');

    if (isOpen) {
        userDropdown.classList.add('hidden');
        userMenuButton.setAttribute('aria-expanded', 'false');
    } else {
        userDropdown.classList.remove('hidden');
        userMenuButton.setAttribute('aria-expanded', 'true');
    }
});


document.addEventListener('click', (event) => {

    if (!event.target.closest('#user-menu')) {
        userDropdown.classList.add('hidden');
        userMenuButton.setAttribute('aria-expanded', 'false');
    }

});


logoutButton.addEventListener('click', async () => {

    try {

        logoutButton.disabled = true;
        logoutButton.textContent = 'Uscita...';

        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });

        if (!response.ok) {
            throw new Error('Errore durante il logout');
        }

        // Chiudi menu
        userDropdown.classList.add('hidden');

        // Nascondi applicazione
        document
            .getElementById('app-shell')
            .classList.add('hidden');

        // Mostra login
        document
            .getElementById('login-screen')
            .classList.remove('hidden');

        // Pulisci password
        const passwordInput =
            document.getElementById('login-password');

        if (passwordInput) {
            passwordInput.value = '';
        }

        // Focus sull'email
        const emailInput =
            document.getElementById('login-email');

        if (emailInput) {
            emailInput.focus();
        }

    } catch (error) {

        console.error('Errore logout:', error);

        showToast(
            error.message || 'Errore durante il logout',
            true
        );

    } finally {

        logoutButton.disabled = false;
        logoutButton.innerHTML = '<span>↪</span> Esci';
    }
});

function setLoggedUser(user) {
    if (!user) return;

    const nome = user.nome || '';
    const cognome = user.cognome || '';

    const nomeCompleto = `${nome} ${cognome}`.trim();

    // Nome nella pagina principale
    const welcomeName = $('#welcome-name');
    if (welcomeName) {
        welcomeName.textContent = nome || nomeCompleto;
    }

    // Nome nel menu utente
    const userMenuName = $('#user-menu-name');
    if (userMenuName) {
        userMenuName.textContent = nomeCompleto;
    }

    // Ruolo
    const userMenuRole = $('#user-menu-role');
    if (userMenuRole) {
        userMenuRole.textContent = user.ruolo || '';
    }

    // Iniziali avatar
    const avatar = $('#user-avatar');
    if (avatar) {
        const iniziali =
            `${nome.charAt(0)}${cognome.charAt(0)}`.toUpperCase();

        avatar.textContent = iniziali || '--';
    }
}
function setCurrentDate() {
    const now = new Date();

    const dateText = now.toLocaleDateString('it-IT', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });

    const welcomeDate = $('#welcome-date');

    if (welcomeDate) {
        welcomeDate.textContent = dateText.toUpperCase();
    }

    const today = $('#today');

    if (today) {
        today.textContent = now.toLocaleDateString('it-IT', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    }
}
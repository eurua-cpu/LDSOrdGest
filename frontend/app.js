const state = { orders: [], customers: [], products: [], materials: [], units: [] };
const statusNames = { 1: 'Impegnato', 2: 'Consegnato', 3: 'Annullato', 4: 'Parzialmente consegnato' };
const statusClass = { 1: 'committed', 2: 'delivered', 3: 'cancelled', 4: 'partial' };

const $ = (selector) => document.querySelector(selector);
const formatMoney = (value) => Number(value || 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const formatDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString('it-IT') : '—';
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;' }[char]));

async function api(path, options = {}) {
  const response = await fetch(`/api/${path}`, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Errore ${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}

function showToast(message, error = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.toggle('error', error);
  toast.classList.remove('hidden');
  window.setTimeout(() => toast.classList.add('hidden'), 3200);
}

function statusBadge(status) { return `<span class="status ${statusClass[status] || 'open'}">${statusNames[status] || 'Impegnato'}</span>`; }
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
  const actions = `<button class="row-action" data-order-id="${order.id}" title="Apri ordine">→</button><button class="row-action copy-action" data-copy-order-id="${order.id}" title="Copia ordine">⧉</button>`;
  return `<tr data-id="${order.id}"><td><span class="order-number">#${String(order.id).padStart(4, '0')}</span></td><td><span class="table-link">${escapeHtml(order.cliente_nome || customerName(order.cliente_id))}</span></td><td>${escapeHtml(order.cliente_zona || '—')}</td><td>${formatDate(order.data)}</td><td><strong class="order-total-cell">${formatMoney(order.totale_ordine)}</strong></td>${compact ? `<td>${statusBadge(order.stato)}</td><td>${actions}</td>` : `<td><span class="pay ${Number(order.pagato) === 1 ? 'yes' : ''}">${Number(order.pagato) === 1 ? 'Pagato' : Number(order.pagato) === 3 ? 'Parzialmente pagato' : 'Da pagare'}</span></td><td>${statusBadge(order.stato)}</td><td>${actions}</td>`}</tr>`;
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
  $('#customers-table').innerHTML = rows.length ? rows.map((customer) => `<tr><td><span class="table-link">${escapeHtml(customer.nome)}</span><small class="muted-cell">${escapeHtml(customer.indirizzo || '')}</small></td><td>${escapeHtml(customer.localita || '—')}</td><td>${escapeHtml(customer.telefono || '—')}</td><td>${escapeHtml(customer.zona || '—')}</td><td><button class="row-action" data-customer-id="${customer.id}" title="Modifica cliente">⋯</button></td></tr>`).join('') : '<tr><td colspan="5" class="empty">Nessun cliente trovato.</td></tr>';
}

function renderProducts() {
  const query = ($('#product-search')?.value || '').toLowerCase();
  const rows = state.products.filter((product) => `${product.codice} ${product.descrizione}`.toLowerCase().includes(query));
  $('#products-table').innerHTML = rows.length ? rows.map((product) => `<tr><td><span class="order-number">${escapeHtml(product.codice)}</span></td><td><span class="table-link">${escapeHtml(product.descrizione || '—')}</span></td><td>${escapeHtml(product.materiale_descrizione || product.materiale || '—')}</td><td>${escapeHtml(product.um_vendita_descrizione || product.um_vendita || '—')}</td><td>${formatMoney(product.prezzo_vendita)}</td><td><button class="row-action" data-product-id="${product.id}" title="Modifica articolo">⋯</button></td></tr>`).join('') : '<tr><td colspan="6" class="empty">Nessun articolo trovato.</td></tr>';
}

function openDrawer(content) { $('#drawer-content').innerHTML = content; $('#drawer-backdrop').classList.remove('hidden'); }
function closeDrawer() { $('#drawer-backdrop').classList.add('hidden'); }

async function copyOrder(id) {
  try {
    const order = await api(`ordini/${id}`);
    orderForm({ ...order, note_ordine: `Copia dell'ordine #${String(order.id).padStart(4, '0')}`, stato: 1, pagato: 2 }, true);
  } catch (error) {
    showToast(error.message, true);
  }
}

function customerForm(customer = {}) {
  const editing = Boolean(customer.id);
  openDrawer(`<p class="eyebrow">ANAGRAFICA CLIENTE</p><h2>${editing ? 'Modifica cliente' : 'Nuovo cliente'}</h2><p class="drawer-subtitle">Completa i dati essenziali del contatto.</p><form id="customer-form" data-id="${customer.id || ''}"><div class="form-grid"><div class="field full"><label>Nome / Ragione sociale *</label><input name="nome" required value="${escapeHtml(customer.nome)}"></div><div class="field full"><label>Indirizzo</label><input name="indirizzo" value="${escapeHtml(customer.indirizzo)}"></div><div class="field"><label>Località</label><input name="localita" value="${escapeHtml(customer.localita)}"></div><div class="field"><label>Telefono</label><input name="telefono" value="${escapeHtml(customer.telefono)}"></div><div class="field"><label>Zona</label><input name="zona" value="${escapeHtml(customer.zona)}"></div><div class="field full"><label>Note</label><textarea name="note">${escapeHtml(customer.note)}</textarea></div></div><div class="form-actions"><button type="button" class="secondary-button" id="cancel-form">Annulla</button><button class="primary-button">${editing ? 'Salva modifiche' : 'Crea cliente'}</button></div></form>`);
  $('#customer-form').addEventListener('submit', async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); try { await api(`clienti${editing ? `/${customer.id}` : ''}`, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(data) }); closeDrawer(); await loadData(); showToast(editing ? 'Cliente aggiornato' : 'Cliente creato'); } catch (error) { showToast(error.message, true); } });
  $('#cancel-form').addEventListener('click', closeDrawer);
}

function productForm(product = {}) {
  const editing = Boolean(product.id);
  const materialOptions = state.materials.map((material) => `<option value="${material.id}" ${Number(product.materiale) === material.id ? 'selected' : ''}>${escapeHtml(material.codice)} · ${escapeHtml(material.descrizione || '')}</option>`).join('');
  const unitOptions = state.units.map((unit) => `<option value="${unit.id}" ${Number(product.um_vendita) === unit.id ? 'selected' : ''}>${escapeHtml(unit.codice)} · ${escapeHtml(unit.descrizione || '')}</option>`).join('');
  openDrawer(`<p class="eyebrow">CATALOGO ARTICOLI</p><h2>${editing ? 'Modifica articolo' : 'Nuovo articolo'}</h2><p class="drawer-subtitle">Aggiorna codice, unità e prezzi del listino.</p><form id="product-form" data-id="${product.id || ''}"><div class="form-grid"><div class="field"><label>Codice *</label><input name="codice" required value="${escapeHtml(product.codice)}"></div><div class="field"><label>UM vendita *</label><select name="um_vendita" required><option value="">Seleziona</option>${unitOptions}</select></div><div class="field full"><label>Descrizione</label><input name="descrizione" value="${escapeHtml(product.descrizione)}"></div><div class="field full"><label>Materiale *</label><select name="materiale" required><option value="">Seleziona</option>${materialOptions}</select></div><div class="field"><label>Moltiplicatore UM</label><input type="number" step="0.01" name="um_base_x_um" value="${product.um_base_x_um ?? ''}"></div><div class="field"><label>Prezzo vendita</label><input type="number" step="0.01" name="prezzo_vendita" value="${product.prezzo_vendita ?? 0}"></div><div class="field"><label>Prezzo acquisto</label><input type="number" step="0.01" name="prezzo_acquisto" value="${product.prezzo_acquisto ?? 0}"></div></div><div class="form-actions"><button type="button" class="secondary-button" id="cancel-form">Annulla</button><button class="primary-button">${editing ? 'Salva modifiche' : 'Crea articolo'}</button></div></form>`);
  $('#product-form').addEventListener('submit', async (event) => { event.preventDefault(); const raw = Object.fromEntries(new FormData(event.currentTarget)); const data = { ...raw, materiale: Number(raw.materiale), um_vendita: Number(raw.um_vendita), um_base_x_um: raw.um_base_x_um ? Number(raw.um_base_x_um) : null, prezzo_vendita: Number(raw.prezzo_vendita || 0), prezzo_acquisto: Number(raw.prezzo_acquisto || 0) }; try { await api(`articoli${editing ? `/${product.id}` : ''}`, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(data) }); closeDrawer(); await loadData(); showToast(editing ? 'Articolo aggiornato' : 'Articolo creato'); } catch (error) { showToast(error.message, true); } });
  $('#cancel-form').addEventListener('click', closeDrawer);
}

function orderForm(existingOrder = null, copying = false) {
  const editing = Boolean(existingOrder?.id) && !copying;
  let lines = existingOrder?.righe?.length ? existingOrder.righe.map((line) => ({ articolo_id: line.articolo_id, quantita: line.quantita, prezzo_applicato: line.prezzo_applicato, stato_riga: line.stato_riga })) : [{ articolo_id: '', quantita: 1, prezzo_applicato: 0 }];
  const productOptions = (selectedId) => state.products.map((product) => `<option value="${product.id}" ${Number(selectedId) === product.id ? 'selected' : ''}>${escapeHtml(product.codice)} · ${escapeHtml(product.descrizione || '')}</option>`).join('');
  const getTotal = () => lines.reduce((total, line) => total + (Number(line.quantita) || 0) * (Number(line.prezzo_applicato) || 0), 0);
  const updateTotal = () => { $('#order-total').textContent = formatMoney(getTotal()); };
  const renderLines = () => lines.map((line, index) => `<div class="line-editor"><div class="line-editor-heading"><span>Riga ${index + 1}</span>${lines.length > 1 ? `<button type="button" class="remove-line" data-remove-line="${index}">Rimuovi</button>` : ''}</div><div class="line-row"><div class="line-field"><label>Articolo</label><select data-line-field="articolo_id" data-line="${index}" required><option value="">Seleziona articolo</option>${productOptions(line.articolo_id)}</select></div><div class="line-field"><label>Quantità</label><input type="number" min="0.01" step="0.01" data-line-field="quantita" data-line="${index}" value="${line.quantita}" required></div></div><div class="line-field"><label>Prezzo applicato</label><input class="line-price" type="number" min="0" step="0.01" data-line-field="prezzo_applicato" data-line="${index}" value="${line.prezzo_applicato}" required></div></div>`).join('');
  openDrawer(`<p class="eyebrow">${editing ? 'MODIFICA ORDINE' : 'NUOVA COMMESSA'}</p><h2>${editing ? `Ordine #${String(existingOrder.id).padStart(4, '0')}` : 'Inserisci ordine'}</h2><p class="drawer-subtitle">Registra cliente, pagamento e articoli richiesti.</p><form id="order-form"><div class="form-grid"><div class="field"><label>Cliente *</label><select name="cliente_id" required><option value="">Seleziona cliente</option>${state.customers.map((customer) => `<option value="${customer.id}" ${Number(existingOrder?.cliente_id) === customer.id ? 'selected' : ''}>${escapeHtml(customer.nome)}</option>`).join('')}</select></div><div class="field"><label>Data ordine</label><input type="date" name="data" value="${existingOrder?.data || new Date().toISOString().slice(0, 10)}"></div><div class="field"><label>Stato</label><select name="stato"><option value="1" ${Number(existingOrder?.stato) === 1 ? 'selected' : ''}>Impegnato</option><option value="4" ${Number(existingOrder?.stato) === 4 ? 'selected' : ''}>Parzialmente consegnato</option><option value="2" ${Number(existingOrder?.stato) === 2 ? 'selected' : ''}>Consegnato</option><option value="3" ${Number(existingOrder?.stato) === 3 ? 'selected' : ''}>Annullato</option></select></div><div class="field check-field"><label><input type="checkbox" name="pagato" ${Number(existingOrder?.pagato) === 1 ? 'checked' : ''}> Pagato</label></div><div class="field full"><label>Note</label><textarea name="note_ordine">${escapeHtml(existingOrder?.note_ordine || '')}</textarea></div></div><div id="line-editors">${renderLines()}</div><div class="order-total"><span>Totale ordine</span><strong id="order-total">${formatMoney(getTotal())}</strong></div><button type="button" class="add-line" id="add-line">＋ Aggiungi riga</button><div class="form-actions"><button type="button" class="secondary-button" id="cancel-form">Annulla</button><button class="primary-button">${editing ? 'Salva modifiche' : 'Salva ordine'}</button></div></form>`);
  const syncLine = (event) => { const field = event.target.dataset.lineField; if (!field) return; const index = Number(event.target.dataset.line); lines[index][field] = event.target.type === 'number' ? Number(event.target.value) : event.target.value; if (field === 'articolo_id') { const product = state.products.find((item) => item.id === Number(event.target.value)); if (product) { lines[index].prezzo_applicato = Number(product.prezzo_vendita) || 0; const priceInput = document.querySelector(`[data-line-field="prezzo_applicato"][data-line="${index}"]`); if (priceInput) priceInput.value = lines[index].prezzo_applicato; } } updateTotal(); };
  const redrawLines = () => { $('#line-editors').innerHTML = renderLines(); updateTotal(); };
  $('#line-editors').addEventListener('input', syncLine); $('#line-editors').addEventListener('change', syncLine);
  $('#line-editors').addEventListener('click', (event) => { const removeButton = event.target.closest('[data-remove-line]'); if (!removeButton) return; lines.splice(Number(removeButton.dataset.removeLine), 1); redrawLines(); });
  $('#add-line').addEventListener('click', () => { lines.push({ articolo_id: '', quantita: 1, prezzo_applicato: 0 }); redrawLines(); }); $('#cancel-form').addEventListener('click', closeDrawer);
  $('#order-form').addEventListener('submit', async (event) => { event.preventDefault(); const raw = Object.fromEntries(new FormData(event.currentTarget)); const data = { ...raw, cliente_id: Number(raw.cliente_id), stato: Number(raw.stato), pagato: event.currentTarget.pagato.checked, righe: lines.map((line) => ({ ...line, articolo_id: Number(line.articolo_id), quantita: Number(line.quantita), prezzo_applicato: Number(line.prezzo_applicato), stato_riga: Number(line.stato_riga || 1) })) }; try { await api(`ordini${editing ? `/${existingOrder.id}` : ''}`, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(data) }); closeDrawer(); await loadData(); showToast(editing ? 'Ordine aggiornato' : 'Ordine creato'); } catch (error) { showToast(error.message, true); } });
}

async function showOrder(id) { try { const order = await api(`ordini/${id}`); const total = Number(order.totale_ordine) || 0; openDrawer(`<p class="eyebrow">ORDINE #${String(order.id).padStart(4, '0')}</p><h2>${escapeHtml(order.cliente_nome)}</h2><p class="drawer-subtitle">${formatDate(order.data)} · ${statusBadge(order.stato)}</p><div class="customer-details"><div><span>Indirizzo</span><strong>${escapeHtml(order.cliente_indirizzo || '—')}</strong></div><div><span>Località</span><strong>${escapeHtml(order.cliente_localita || '—')}</strong></div><div><span>Zona</span><strong>${escapeHtml(order.cliente_zona || '—')}</strong></div></div><div class="detail-list">${(order.righe || []).map((line) => `<div class="detail-line"><div><strong>${escapeHtml(line.articolo_codice)}</strong><small>${escapeHtml(line.articolo_categoria || '')}</small></div><span>${line.quantita} × ${formatMoney(line.prezzo_applicato)}</span></div>`).join('') || '<p class="empty">Nessuna riga.</p>'}</div><div class="order-total"><span>Totale ordine</span><strong>${formatMoney(total)}</strong></div><div class="form-actions"><button class="secondary-button" id="close-detail">Chiudi</button><button class="primary-button" id="edit-order">Modifica ordine</button></div>`); $('#close-detail').addEventListener('click', closeDrawer); $('#edit-order').addEventListener('click', () => orderForm(order)); } catch (error) { showToast(error.message, true); } }

async function loadData() { try { const [orders, customers, products] = await Promise.all([api('ordini'), api('clienti'), api('articoli')]); state.orders = orders; state.customers = customers; state.products = products; state.materials = await api('materiali').catch(() => []); state.units = await api('um').catch(() => []); renderMetrics(); renderOrders(); renderCustomers(); renderProducts(); } catch (error) { showToast(`Impossibile caricare i dati: ${error.message}`, true); } }

function switchView(view) { document.querySelectorAll('.page').forEach((page) => page.classList.toggle('hidden', page.id !== `${view}-view`)); document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === view)); $('#page-kicker').textContent = { overview: 'Panoramica', orders: 'Ordini', customers: 'Clienti', products: 'Articoli' }[view]; }

document.addEventListener('click', (event) => { const nav = event.target.closest('[data-view]'); if (nav) switchView(nav.dataset.view); const target = event.target.closest('[data-view-target]'); if (target) switchView(target.dataset.viewTarget); if (event.target.closest('[data-action="new-order"]')) orderForm(); if (event.target.closest('[data-action="new-customer"]')) customerForm(); if (event.target.closest('[data-action="new-product"]')) productForm(); const orderButton = event.target.closest('[data-order-id]'); if (orderButton) showOrder(orderButton.dataset.orderId); const copyButton = event.target.closest('[data-copy-order-id]'); if (copyButton) copyOrder(copyButton.dataset.copyOrderId); const customerButton = event.target.closest('[data-customer-id]'); if (customerButton) customerForm(state.customers.find((item) => item.id === Number(customerButton.dataset.customerId))); const productButton = event.target.closest('[data-product-id]'); if (productButton) productForm(state.products.find((item) => item.id === Number(productButton.dataset.productId))); });
$('#drawer-close').addEventListener('click', closeDrawer); $('#drawer-backdrop').addEventListener('click', (event) => { if (event.target.id === 'drawer-backdrop') closeDrawer(); }); $('#refresh-button').addEventListener('click', loadData); $('#order-search').addEventListener('input', renderOrders); $('#order-filter').addEventListener('change', renderOrders); $('#customer-search').addEventListener('input', renderCustomers); $('#product-search').addEventListener('input', renderProducts); $('#today').textContent = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }); loadData();

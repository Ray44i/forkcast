const batch = {
  id: 'FC-024',
  quantity: 30,
  pickupBy: 20 * 60 + 30,
  prepFactsComplete: true,
  syntheticSafetyFlag: 'clear'
};

const recipients = [
  { id: 'sahil', name: 'Sahil Community Kitchen', capacity: 36, distanceKm: 1.2, etaMinutes: 8, closesAt: 20 * 60, available: true },
  { id: 'kadikoy', name: 'Kadıköy Community Pantry', capacity: 35, distanceKm: 2.6, etaMinutes: 17, closesAt: 21 * 60, available: true },
  { id: 'moda', name: 'Moda Neighbourhood Fridge', capacity: 18, distanceKm: 0.6, etaMinutes: 5, closesAt: 20 * 60 + 30, available: true }
];

const DEMO_NOW = 19 * 60 + 10;
const CANCEL_TIME = 19 * 60 + 25;
const HANDOFF_BUFFER_MINUTES = 10;

const state = {
  phase: 'proposed',
  cancelledRecipientId: null,
  selectedRecipientId: 'sahil',
  events: [
    { type: 'intake', title: 'Batch received', detail: '30 loaves · Apricot Bakehouse', time: '19:10', complete: true },
    { type: 'safety', title: 'Safety facts checked', detail: 'All configured demo rules passed', time: '19:10', complete: true },
    { type: 'proposal', title: 'Route proposed', detail: 'Sahil Community Kitchen · 8 min ETA', time: '19:10', complete: false }
  ]
};

const $ = (selector) => document.querySelector(selector);
const byId = (id) => document.getElementById(id);

function clockLabel(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function evaluateCandidates(nowMinutes, excludedIds = new Set()) {
  const checks = recipients.map((recipient) => {
    const reasons = [];
    if (excludedIds.has(recipient.id)) reasons.push('Recipient cancelled');
    if (!batch.prepFactsComplete) reasons.push('Missing preparation or storage facts');
    if (batch.syntheticSafetyFlag !== 'clear') reasons.push('Safety review required');
    if (!recipient.available) reasons.push('Recipient unavailable');
    if (recipient.capacity < batch.quantity) reasons.push(`Capacity ${recipient.capacity} is below ${batch.quantity}`);

    const readyAt = nowMinutes + recipient.etaMinutes + HANDOFF_BUFFER_MINUTES;
    const cutoff = Math.min(batch.pickupBy, recipient.closesAt);
    if (readyAt > cutoff) reasons.push(`Pickup window closes at ${clockLabel(recipient.closesAt)}`);

    return {
      ...recipient,
      readyAt,
      feasible: reasons.length === 0,
      reasons,
      score: recipient.etaMinutes + Math.max(0, recipient.capacity - batch.quantity) * 0.05
    };
  });

  const ranked = checks.filter((candidate) => candidate.feasible).sort((a, b) => a.score - b.score);
  return { checks, ranked, selected: ranked[0] || null };
}

function setSelectedRecipient(recipientId) {
  state.selectedRecipientId = recipientId;
  const selected = recipients.find((recipient) => recipient.id === recipientId);
  if (!selected) return;

  byId('selectedName').textContent = selected.name;
  byId('selectedEta').textContent = selected.etaMinutes;
  byId('selectedReason').textContent = state.phase === 'rerouted'
    ? `Best remaining feasible route · full batch capacity · pickup by ${clockLabel(Math.min(batch.pickupBy, selected.closesAt))}`
    : 'Fastest feasible pickup · full batch capacity';
  byId('selectedTag').textContent = state.phase === 'rerouted' ? 'REROUTED' : 'PROPOSED';

  recipients.forEach((recipient) => {
    const row = document.querySelector(`[data-candidate="${recipient.id}"]`);
    const status = byId(`state-${recipient.id}`);
    row.classList.remove('selected-candidate', 'new-selected', 'cancelled');

    if (recipient.id === state.cancelledRecipientId) {
      row.classList.add('cancelled');
      status.textContent = 'CANCELLED';
      return;
    }
    if (recipient.id === state.selectedRecipientId) {
      row.classList.add(state.phase === 'rerouted' ? 'new-selected' : 'selected-candidate');
      status.textContent = state.phase === 'rerouted' ? 'REROUTED' : 'SELECTED';
      return;
    }
    status.textContent = recipient.capacity < batch.quantity ? 'CAPACITY TOO LOW' : 'BACKUP';
  });
}

function renderTimeline() {
  const timeline = byId('timeline');
  timeline.replaceChildren();

  state.events.forEach((event, index) => {
    const item = document.createElement('div');
    item.className = `timeline-item ${event.complete ? 'completed' : 'current'} ${event.type === 'cancel' ? 'event' : ''}`;

    const marker = document.createElement('span');
    marker.className = 'timeline-marker';
    marker.textContent = event.complete ? '✓' : (event.type === 'cancel' ? '!' : String(index + 1));

    const content = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = event.title;
    const detail = document.createElement('span');
    detail.textContent = event.detail;
    const time = document.createElement('time');
    time.textContent = event.time;
    content.append(title, detail, time);
    item.append(marker, content);
    timeline.append(item);
  });
}

function showToast(message) {
  const toast = byId('toast');
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => toast.classList.remove('show'), 2600);
}

function cancelAndReplan() {
  if (state.phase !== 'proposed') return;

  state.phase = 'rerouted';
  state.cancelledRecipientId = state.selectedRecipientId;
  const result = evaluateCandidates(CANCEL_TIME, new Set([state.cancelledRecipientId]));
  const cancellationTime = clockLabel(CANCEL_TIME);

  state.events[state.events.length - 1].complete = true;
  state.events.push({
    type: 'cancel',
    title: 'Recipient cancelled',
    detail: `${recipients.find((item) => item.id === state.cancelledRecipientId).name} released the batch`,
    time: cancellationTime,
    complete: true
  });

  if (!result.selected) {
    state.phase = 'no-route';
    state.events.push({ type: 'replan', title: 'No safe route available', detail: 'No recipient passed every hard constraint', time: cancellationTime, complete: false });
    byId('batchStatus').textContent = 'NO FEASIBLE ROUTE';
    byId('routesTitle').textContent = 'No safe option remains';
    byId('selectedName').textContent = 'Batch held for review';
    byId('selectedEta').textContent = '—';
    byId('selectedTag').textContent = 'HOLD';
    byId('selectedReason').textContent = 'No recipient passed every hard constraint.';
    byId('actionCopy').innerHTML = '<span class="action-step">SAFE STOP</span><strong>Nothing is counted as rescued without a feasible handoff.</strong>';
    byId('cancelButton').hidden = true;
    return;
  }

  state.selectedRecipientId = result.selected.id;
  state.events.push({
    type: 'replan',
    title: 'Plan recalculated',
    detail: `${result.selected.name} · ${result.selected.etaMinutes} min ETA`,
    time: cancellationTime,
    complete: false
  });

  byId('batchStatus').textContent = 'REROUTED · AWAITING PICKUP';
  byId('routesTitle').textContent = 'Best remaining route';
  setSelectedRecipient(result.selected.id);
  byId('actionCopy').innerHTML = '<span class="action-step">NEXT EVENT</span><strong>Confirm the simulated pickup to record verified impact.</strong>';
  byId('cancelButton').hidden = true;
  byId('confirmButton').hidden = false;
  showToast(`Replanned to ${result.selected.name}.`);
  renderTimeline();
}

function confirmPickup() {
  if (state.phase !== 'rerouted') return;
  state.phase = 'confirmed';
  const recipient = recipients.find((item) => item.id === state.selectedRecipientId);
  const eventTime = clockLabel(CANCEL_TIME + recipient.etaMinutes + HANDOFF_BUFFER_MINUTES);
  state.events[state.events.length - 1].complete = true;
  state.events.push({
    type: 'confirm',
    title: 'Simulated pickup confirmed',
    detail: `${batch.quantity} loaves · ${recipient.name}`,
    time: eventTime,
    complete: true
  });
  byId('batchStatus').textContent = 'SIMULATED HANDOFF COMPLETE';
  byId('impactStatus').textContent = 'SIMULATED · VERIFIED';
  byId('rescuedDisplay').textContent = batch.quantity;
  byId('impactMessage').textContent = 'Pickup confirmation recorded in the demo outcome ledger.';
  byId('actionCopy').innerHTML = '<span class="action-step">SCENARIO COMPLETE</span><strong>30 loaves recorded after simulated pickup confirmation.</strong>';
  byId('confirmButton').hidden = true;
  renderTimeline();
  showToast('Simulated outcome recorded.');
}

function resetDemo() {
  state.phase = 'proposed';
  state.cancelledRecipientId = null;
  state.selectedRecipientId = 'sahil';
  state.events = [
    { type: 'intake', title: 'Batch received', detail: '30 loaves · Apricot Bakehouse', time: '19:10', complete: true },
    { type: 'safety', title: 'Safety facts checked', detail: 'All configured demo rules passed', time: '19:10', complete: true },
    { type: 'proposal', title: 'Route proposed', detail: 'Sahil Community Kitchen · 8 min ETA', time: '19:10', complete: false }
  ];
  byId('batchStatus').textContent = 'ROUTE PROPOSED';
  byId('routesTitle').textContent = 'Best available route';
  byId('rescuedDisplay').textContent = '0';
  byId('impactStatus').textContent = 'AWAITING CONFIRMATION';
  byId('impactMessage').textContent = 'Nothing counted as rescued until pickup is confirmed.';
  byId('actionCopy').innerHTML = '<span class="action-step">NEXT EVENT</span><strong>A recipient cancels shortly before pickup.</strong>';
  byId('cancelButton').hidden = false;
  byId('confirmButton').hidden = true;
  setSelectedRecipient('sahil');
  renderTimeline();
  showToast('Demo reset to the original route.');
}

byId('cancelButton').addEventListener('click', cancelAndReplan);
byId('confirmButton').addEventListener('click', confirmPickup);
byId('resetButton').addEventListener('click', resetDemo);

// Initial candidate selection uses hard constraints first, then deterministic ETA scoring.
const initialPlan = evaluateCandidates(DEMO_NOW);
if (initialPlan.selected) setSelectedRecipient(initialPlan.selected.id);

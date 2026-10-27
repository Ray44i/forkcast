const DEFAULT_BATCH = {
  id: 'FC-024',
  quantity: 30,
  itemName: 'sourdough',
  unit: 'loaves',
  pickupBy: 20 * 60 + 30,
  prepFactsComplete: true,
  syntheticSafetyFlag: 'clear'
};

const batch = { ...DEFAULT_BATCH };

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
    { type: 'intake', title: 'Batch received', detail: batchDescription(), time: '19:10', complete: true },
    { type: 'safety', title: 'Demo intake fields checked', detail: 'Configured fictional facts present; not a safety determination', time: '19:10', complete: true },
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

function batchDescription() {
  return `${batch.quantity} ${batch.itemName} ${batch.unit} · Apricot Bakehouse`;
}

function parseDonorNote(note) {
  const quantityMatch = note.match(/\b(\d{1,3})\s+([a-z][a-z' -]{0,35}?)\s+loaves?\b/i)
    || note.match(/\b(\d{1,3})\s+loaves?\s+of\s+([a-z][a-z' -]{0,35}?)(?=[,.;]|$)/i);
  const pickupMatch = note.match(/\b(?:pickup(?:\s+(?:by|at))?|pick\s*up(?:\s+(?:by|at))?|deadline(?:\s*(?:is|by|at|:))?|by|before|until)\s*(?:[:\-]\s*)?(\d{1,2}):([0-5]\d)\b/i);

  if (!quantityMatch || !pickupMatch) return null;

  const quantity = Number(quantityMatch[1]);
  const pickupHour = Number(pickupMatch[1]);
  const pickupMinute = Number(pickupMatch[2]);
  if (quantity < 1 || quantity > 999 || pickupHour > 23) return null;

  const itemName = quantityMatch[2]
    .replace(/\b(?:fresh|unsold|surplus|batch|of|we have|donating)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'bread';
  const hasPreparationFact = /\b(?:baked|prepared)\s+at\s+\d{1,2}:\d{2}\b/i.test(note);
  const hasStorageFact = /\b(?:stored|kept)\s+(?:at|below)\s+\d+(?:\.\d+)?\s*°?\s*C\b/i.test(note);

  return {
    quantity,
    itemName,
    unit: 'loaves',
    pickupBy: pickupHour * 60 + pickupMinute,
    prepFactsComplete: hasPreparationFact && hasStorageFact
  };
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

  const evaluation = evaluateCandidates(
    state.phase === 'rerouted' ? CANCEL_TIME : DEMO_NOW,
    state.cancelledRecipientId ? new Set([state.cancelledRecipientId]) : new Set()
  );
  recipients.forEach((recipient) => {
    const row = document.querySelector(`[data-candidate="${recipient.id}"]`);
    const status = byId(`state-${recipient.id}`);
    const candidate = evaluation.checks.find((item) => item.id === recipient.id);
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
    if (candidate?.reasons.includes('Missing preparation or storage facts')) status.textContent = 'FACTS MISSING';
    else if (candidate?.reasons.some((reason) => reason.startsWith('Capacity'))) status.textContent = 'CAPACITY TOO LOW';
    else if (!candidate?.feasible) status.textContent = 'WINDOW CLOSED';
    else status.textContent = 'BACKUP';
  });
}

function updateBatchDisplay() {
  byId('quantityDisplay').textContent = batch.quantity;
  byId('quantityUnit').textContent = batch.unit;
  byId('itemNameDisplay').textContent = `Fresh ${batch.itemName}`;
  byId('deadlineDisplay').textContent = clockLabel(batch.pickupBy);
  byId('timeRemaining').textContent = `${Math.max(0, batch.pickupBy - DEMO_NOW)} min remaining`;

  const safetyStrip = document.querySelector('.safety-strip');
  safetyStrip.classList.toggle('warning', !batch.prepFactsComplete);
  byId('safetyTitle').textContent = batch.prepFactsComplete ? 'Required demo facts present' : 'Required demo facts missing';
  byId('safetyDescription').textContent = batch.prepFactsComplete
    ? 'A preparation time and storage temperature were found. This is not a food-safety determination.'
    : 'Add a preparation time and storage temperature before the demo will consider routes.';
  byId('safetyIcon').textContent = batch.prepFactsComplete ? '✓' : '!';
}

function renderIntakePlan(parsed) {
  Object.assign(batch, parsed);
  state.phase = 'proposed';
  state.cancelledRecipientId = null;

  const result = evaluateCandidates(DEMO_NOW);
  state.selectedRecipientId = result.selected?.id || null;
  updateBatchDisplay();

  byId('routeCount').textContent = `${result.checks.length} checked · ${result.ranked.length} feasible`;
  recipients.forEach((recipient) => {
    document.querySelector(`[data-candidate="${recipient.id}"]`).classList.remove('selected-candidate', 'new-selected', 'cancelled');
  });
  result.checks.forEach((candidate) => {
    const status = byId(`state-${candidate.id}`);
    if (candidate.id === result.selected?.id) status.textContent = 'SELECTED';
    else if (candidate.feasible) status.textContent = 'BACKUP';
    else if (candidate.reasons.includes('Missing preparation or storage facts')) status.textContent = 'FACTS MISSING';
    else if (candidate.reasons.some((reason) => reason.startsWith('Capacity'))) status.textContent = 'CAPACITY TOO LOW';
    else status.textContent = 'WINDOW CLOSED';
  });

  state.events = [
    { type: 'intake', title: 'Donor note parsed · demo', detail: batchDescription(), time: '19:10', complete: true },
    {
      type: 'safety',
      title: batch.prepFactsComplete ? 'Required demo facts found' : 'Required demo facts missing',
      detail: batch.prepFactsComplete ? 'Preparation time and storage temperature were stated' : 'Routing held until required fields are provided',
      time: '19:10',
      complete: true
    }
  ];

  if (result.selected) {
    state.events.push({ type: 'proposal', title: 'Route proposed', detail: `${result.selected.name} · ${result.selected.etaMinutes} min ETA`, time: '19:10', complete: false });
    byId('batchStatus').textContent = 'ROUTE PROPOSED';
    byId('routesTitle').textContent = 'Best available route';
    setSelectedRecipient(result.selected.id);
    byId('actionCopy').innerHTML = '<span class="action-step">NEXT EVENT</span><strong>A recipient cancels shortly before pickup.</strong>';
    byId('cancelButton').hidden = false;
  } else {
    state.phase = 'no-route';
    state.events.push({ type: 'hold', title: 'Batch held for review', detail: batch.prepFactsComplete ? 'No recipient passed every hard constraint' : 'Complete the preparation and storage fields first', time: '19:10', complete: false });
    byId('batchStatus').textContent = batch.prepFactsComplete ? 'NO FEASIBLE ROUTE' : 'INTAKE NEEDS FACTS';
    byId('routesTitle').textContent = batch.prepFactsComplete ? 'No feasible route' : 'Routing paused';
    byId('selectedName').textContent = 'Batch held for review';
    byId('selectedEta').textContent = '—';
    byId('selectedTag').textContent = 'HOLD';
    byId('selectedReason').textContent = batch.prepFactsComplete ? 'No recipient passed every hard constraint.' : 'Provide the missing demo facts before routing.';
    byId('actionCopy').innerHTML = '<span class="action-step">SAFE STOP</span><strong>Forkcast will not propose a route until the checks pass.</strong>';
    byId('cancelButton').hidden = true;
  }
  byId('rescuedDisplay').textContent = '0';
  byId('impactStatus').textContent = 'AWAITING CONFIRMATION';
  byId('impactMessage').textContent = 'Nothing counted as rescued until pickup is confirmed.';
  byId('confirmButton').hidden = true;
  renderTimeline();
}

function parseIntake() {
  const parsed = parseDonorNote(byId('donorNote').value);
  const result = byId('intakeResult');
  if (!parsed) {
    result.className = 'intake-result error';
    result.textContent = 'Could not extract a loaf quantity and a pickup time. Try “30 sourdough loaves, pickup by 20:30”. Nothing changed.';
    return;
  }

  renderIntakePlan(parsed);
  result.className = `intake-result ${parsed.prepFactsComplete ? 'success' : 'error'}`;
  result.textContent = `${parsed.quantity} ${parsed.itemName} ${parsed.unit} · pickup by ${clockLabel(parsed.pickupBy)} · ${parsed.prepFactsComplete ? 'required demo fields found' : 'preparation or storage facts missing; routing paused'}. Extracted locally; no Meta API request was made.`;
  showToast(parsed.prepFactsComplete ? 'Demo batch extracted and checked.' : 'Intake saved; routing paused for missing facts.');
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
    detail: `${batch.quantity} ${batch.itemName} ${batch.unit} · ${recipient.name}`,
    time: eventTime,
    complete: true
  });
  byId('batchStatus').textContent = 'SIMULATED HANDOFF COMPLETE';
  byId('impactStatus').textContent = 'SIMULATED · VERIFIED';
  byId('rescuedDisplay').textContent = batch.quantity;
  byId('impactMessage').textContent = 'Pickup confirmation recorded in the demo outcome ledger.';
  byId('actionCopy').innerHTML = `<span class="action-step">SCENARIO COMPLETE</span><strong>${batch.quantity} ${batch.itemName} ${batch.unit} recorded after simulated pickup confirmation.</strong>`;
  byId('confirmButton').hidden = true;
  renderTimeline();
  showToast('Simulated outcome recorded.');
}

function resetDemo() {
  Object.assign(batch, DEFAULT_BATCH);
  byId('donorNote').value = '30 sourdough loaves, baked at 16:00, stored at 4°C, pickup by 20:30';
  const result = byId('intakeResult');
  result.className = 'intake-result';
  result.textContent = 'This local demo parser never sends your note anywhere. Extracted values update the fictional batch below.';
  renderIntakePlan(DEFAULT_BATCH);
  showToast('Demo reset to the original batch.');
}

byId('parseIntakeButton').addEventListener('click', parseIntake);
byId('cancelButton').addEventListener('click', cancelAndReplan);
byId('confirmButton').addEventListener('click', confirmPickup);
byId('resetButton').addEventListener('click', resetDemo);

// Initial candidate selection uses hard constraints first, then deterministic ETA scoring.
const initialPlan = evaluateCandidates(DEMO_NOW);
if (initialPlan.selected) setSelectedRecipient(initialPlan.selected.id);

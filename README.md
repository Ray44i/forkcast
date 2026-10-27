# Forkcast

**Rescue, recalculated.** Forkcast is a small interactive prototype for routing synthetic surplus food to a feasible recipient, then replanning when a pickup falls through.

## Run the demo

Open `index.html` in a browser. No installation, API key, backend, or network request is required.

1. Click **Simulate cancellation** to cancel the first recipient and recalculate the plan.
2. See why the nearby fridge is rejected: it cannot take all 30 loaves.
3. Click **Confirm simulated pickup** to record a handoff. The rescued count stays at zero until this confirmation.
4. Click **Reset** to replay the scenario.

## What the prototype demonstrates

- Synthetic batch intake with a pickup deadline and recorded preparation facts.
- Hard checks for safety facts, availability, recipient capacity, and pickup windows.
- A deterministic ETA ranking across feasible recipients.
- Cancellation handling, replanning, and an auditable decision trail.
- An outcome ledger that separates a proposed plan from a confirmed (simulated) handoff.

The demo uses fictional data and does not make real pickup commitments. Its safety gate only demonstrates configured rules; it is not food-safety or legal advice. No Meta Model API calls are made. The decision logic is isolated in `app.js` so a model adapter can be added later without letting a model override the hard constraints.

## Project direction

The hackathon MVP should stay focused on the cancellation-and-recovery loop. The next useful additions are editable synthetic scenarios, a no-feasible-recipient case, and a model adapter only after API access and cost controls are clear.

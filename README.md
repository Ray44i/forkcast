# Forkcast

**Rescue, recalculated.** Forkcast is a small interactive prototype for routing synthetic surplus food to a feasible recipient, then replanning when a pickup falls through.

## Run the demo

Open `index.html` in a browser. No installation, API key, backend, or network request is required.

1. Click **Extract & check** to parse the sample note and update the fictional batch.
2. Remove the preparation or storage phrase and extract again to see routing pause for missing facts.
3. Click **Simulate cancellation** to cancel the first recipient and recalculate the plan.
4. See why the nearby fridge is rejected: it cannot take all 30 loaves.
5. Click **Confirm simulated pickup** to record a handoff. The rescued count stays at zero until this confirmation.
6. Click **Reset** to replay the scenario.

## Donor-note intake

Enter a fictional donor note such as `30 sourdough loaves, baked at 16:00, stored at 4°C, pickup by 20:30`, then click **Extract & check**. The local demo parser extracts a supported loaf quantity, item label, pickup time, and whether preparation and storage facts were stated. Forkcast applies the resulting batch to its deterministic capacity and time-window checks; missing preparation or storage facts pause routing.

This is a local pattern-matching demo, not a Meta model response. The note stays in the browser and no API call or network request is made. A future Meta Model API adapter must run behind a server endpoint with its key kept outside this public repository. Model output must not decide food safety or override the deterministic route checks.

## What the prototype demonstrates

- Synthetic batch intake with a pickup deadline and recorded preparation facts.
- Hard checks for safety facts, availability, recipient capacity, and pickup windows.
- A deterministic ETA ranking across feasible recipients.
- Cancellation handling, replanning, and an auditable decision trail.
- An outcome ledger that separates a proposed plan from a confirmed (simulated) handoff.

The demo uses fictional data and does not make real pickup commitments. Its safety gate only demonstrates configured rules; it is not food-safety or legal advice. No Meta Model API calls are made. The decision logic is isolated in `app.js` so a model adapter can be added later without letting a model override the hard constraints.

## Project direction

The hackathon MVP should stay focused on the cancellation-and-recovery loop. The local donor-note parser previews the intake flow; it is not a Meta model response. The next step is a server-side Meta Model API adapter after credits are confirmed, while keeping the API key out of this public repository and keeping hard constraints deterministic.

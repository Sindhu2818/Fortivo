# STATUS.md — what's pending right now

**Deadline: 2026-07-26, 10:00 IST.**

Update this file at the end of every session. `TASKS.md` is the full checklist with
DoD commands; this file is the short answer to "what do I pick up next?".

---

## Right now

| | Sindhu (Windows + WSL — backend) | Charvitha (Fedora — frontend) |
|---|---|---|
| **Doing** | Backend verification and integration | Task 10 — Scan page |
| **Next** | Gemini integration → Golden run | Dashboard |
| **Blocked on** | nothing | nothing |

Backend architecture has been implemented. Scanner wrappers, normalization,
pipeline orchestration, storage, models and API endpoints are present.
Remaining work is validating the complete pipeline, integrating Gemini,
verifying attack-path generation and producing the final golden demo result.

The frontend already runs independently in demo mode using
`fixtures/mock_results.json`.

---

## One-time setup (do this first, both of you)

### Sindhu (Windows + WSL)

- [ ] WSL2 with Linux installed
- [ ] Create virtual environment
- [ ] Install backend requirements
- [ ] Install Trivy
- [ ] Install Semgrep
- [ ] Configure `.env`
- [ ] Add Gemini API key
- [ ] Verify both scanners work

### Charvitha (Fedora)

- [ ] Install Node 20 LTS
- [ ] Copy `.env.local`
- [ ] Keep `NEXT_PUBLIC_DEMO_MODE=true`

---

## Pending work

### Sindhu — backend chain

- [x] **1. Fixtures** — sample Trivy and Semgrep JSON added
- [x] **2. Demo app** — vulnerable demo application completed
- [x] **3. Scan endpoint + normalizer** — backend endpoints and normalizer implemented
- [~] **4. Reduction** — implementation present, needs validation
- [~] **5. Scoring** — implementation present, needs validation
- [~] **6. Attack paths** — implementation present, needs validation
- [ ] **7. LLM reasoning** — Gemini integration remaining
- [~] **8. Pipeline wire-up** — pipeline exists, end-to-end testing remaining
- [ ] **16. Golden run**
- [ ] **18. DECISIONS.md**

### Charvitha — frontend chain

- [x] **9. Scaffold + DEMO_MODE**
- [ ] **10. Scan page**
- [ ] **11. Dashboard**
- [ ] **12. Finding drawer**
- [ ] **13. Attack graph**
- [ ] **14. Polish**
- [ ] **17. Video**
- [ ] **19. Pitch**

### Together

- [ ] **15. Integration**

Backend will expose the live scan endpoint and frontend will switch
`NEXT_PUBLIC_DEMO_MODE=false` for the final demo.

---

## Current backend status

Implemented:

- FastAPI backend
- Scan API endpoints
- Scanner wrappers
- Result storage
- Data models
- Finding normalization
- Pipeline orchestration
- Demo application
- Sample scanner fixtures

Remaining:

- Validate reduction
- Validate scoring
- Validate attack paths
- Gemini reasoning
- Golden demo artifact
- Final integration

---

## Blockers

Currently no blocking issues between frontend and backend.
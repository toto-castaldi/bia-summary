# BIA Summary

## What This Is

Un tool CLI TypeScript che prende un report PDF di una BIA eseguita con macchina Akern BIA 101 Biva Pro (software Bodygram), lo invia a Claude via API multimodale per generare un riassunto comprensibile per il cliente, e produce un PDF pulito con i dati salienti della composizione corporea. Uso personale di un professionista che esegue esami BIA.

## Core Value

Il cliente riceve un riassunto chiaro e leggibile della propria composizione corporea, senza dover interpretare il report tecnico originale.

## Requirements

### Validated

- ✓ CLI accetta un file PDF BIA come input e produce un riassunto markdown — Phase 1
- ✓ Il PDF BIA viene inviato intero a Claude API (multimodale) per estrarre e riassumere i dati — Phase 1
- ✓ Il prompt per Claude è configurabile tramite un file di testo esterno — Phase 1
- ✓ Il tool gestisce dati anagrafici del cliente (nome, età, sesso, peso, altezza, data esame) — Phase 1
- ✓ Il tool gestisce i dati di composizione corporea (massa grassa/magra in kg e %, BMR, TDEE) — Phase 1

- ✓ L'output di Claude (markdown) viene convertito in PDF tramite CloudConvert API — Phase 2
- ✓ Il PDF generato è semplice e pulito: testo ben formattato, titoli, tabelle — Phase 2

- ✓ Retry con backoff esponenziale per errori API transitori — Phase 3
- ✓ Flag --verbose per logging step-by-step — Phase 3
- ✓ Messaggi di errore chiari per tutti i tipi di fallimento — Phase 3
- ✓ Template variables nel prompt ({{CLIENT_NAME}}, {{EXAM_DATE}}) — Phase 3

### Active

(All v1 requirements validated — milestone complete)

### Out of Scope

- Interfaccia web o GUI — è un tool CLI personale
- Supporto multi-utente o autenticazione — uso singolo professionista
- Parsing strutturato del PDF — si delega a Claude la lettura
- Archiviazione o storico dei report — genera e basta
- Design elaborato del PDF — semplice e pulito è sufficiente

## Context

- La macchina BIA è una Akern BIA 101 Biva Pro, il software che genera i report PDF è Bodygram
- Il report contiene: dati anagrafici, Biavector, Biagram, analisi quantitativa (PhA, TBW, ECW, ICW, FFM, FM, BCM, SMM, ASMM, BMR, TDEE), indici, idratazione (Hydragram), nutrizione (Nutrigram), glossario
- Il prompt di esempio include: estrazione dati salienti, tabella obiettivi (in forma/ottima definizione con soglie per sesso), prospetto metabolismo basale/TDEE, consigli nutrizionali, esclusione esplicita di BMI e idratazione
- Un report PDF di esempio è presente nel repo: `26_03_2026 - Angelina Jolie - Report di stampa _ Bodygram.pdf`
- Conversione markdown → PDF via CloudConvert API (https://api.cloudconvert.com/v2/jobs) — l'utente ha un abbonamento attivo
- Claude API per analisi multimodale del PDF

## Constraints

- **Tech stack**: TypeScript, Node.js
- **API esterne**: Claude API (Anthropic) per analisi, CloudConvert API per generazione PDF
- **Input**: PDF generati da Bodygram/Akern
- **Output**: PDF semplice e leggibile per il cliente finale

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PDF intero a Claude (multimodale) | Evita parsing complesso, i report possono variare leggermente | — Pending |
| Prompt da file di testo | Facile da modificare senza toccare il codice | — Pending |
| CloudConvert per markdown → PDF | Servizio già in abbonamento, evita dipendenze locali | — Pending |
| CLI senza GUI | Uso personale, semplicità massima | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-27 after Phase 3 completion — all v1 requirements validated*

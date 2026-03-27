# BIA Summary

## What This Is

Un tool CLI TypeScript che prende un report PDF di una BIA eseguita con macchina Akern BIA 101 Biva Pro (software Bodygram), lo invia a Claude via API multimodale per generare un riassunto comprensibile per il cliente, e produce un PDF pulito con i dati salienti della composizione corporea. Uso personale di un professionista che esegue esami BIA.

**Shipped v1.0** — 627 LOC TypeScript, 3 phases, 7 plans.

## Core Value

Il cliente riceve un riassunto chiaro e leggibile della propria composizione corporea, senza dover interpretare il report tecnico originale.

## Requirements

### Validated

- ✓ CLI accetta un file PDF BIA come input e produce un riassunto markdown — v1.0
- ✓ Il PDF BIA viene inviato intero a Claude API (multimodale) per estrarre e riassumere i dati — v1.0
- ✓ Il prompt per Claude è configurabile tramite un file di testo esterno — v1.0
- ✓ Il tool gestisce dati anagrafici del cliente (nome, età, sesso, peso, altezza, data esame) — v1.0
- ✓ Il tool gestisce i dati di composizione corporea (massa grassa/magra in kg e %, BMR, TDEE) — v1.0
- ✓ L'output di Claude (markdown) viene convertito in PDF tramite CloudConvert API — v1.0
- ✓ Il PDF generato è semplice e pulito: testo ben formattato, titoli, tabelle — v1.0
- ✓ Retry con backoff esponenziale per errori API transitori — v1.0
- ✓ Flag --verbose per logging step-by-step — v1.0
- ✓ Messaggi di errore chiari per tutti i tipi di fallimento — v1.0
- ✓ Template variables nel prompt ({{CLIENT_NAME}}, {{EXAM_DATE}}) — v1.0

### Active

(None — v1.0 milestone complete. Use `/gsd:new-milestone` to define v1.1 scope.)

### Out of Scope

- Interfaccia web o GUI — è un tool CLI personale
- Supporto multi-utente o autenticazione — uso singolo professionista
- Parsing strutturato del PDF — si delega a Claude la lettura
- Archiviazione o storico dei report — genera e basta
- Design elaborato del PDF — semplice e pulito è sufficiente

## Context

- Shipped v1.0 MVP on 2026-03-27
- Tech stack: TypeScript 6.0, Node.js ESM, Commander 14, Zod 4, ora 9
- API: Anthropic SDK (Claude Sonnet 4), CloudConvert SDK v3
- 627 LOC across 8 source files in `src/`
- La macchina BIA è una Akern BIA 101 Biva Pro, il software che genera i report PDF è Bodygram
- Conversione markdown → PDF via CloudConvert API (https://api.cloudconvert.com/v2/jobs)

## Constraints

- **Tech stack**: TypeScript, Node.js
- **API esterne**: Claude API (Anthropic) per analisi, CloudConvert API per generazione PDF
- **Input**: PDF generati da Bodygram/Akern
- **Output**: PDF semplice e leggibile per il cliente finale

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PDF intero a Claude (multimodale) | Evita parsing complesso, i report possono variare leggermente | ✓ Good |
| Prompt da file di testo | Facile da modificare senza toccare il codice | ✓ Good |
| CloudConvert per markdown → PDF | Servizio già in abbonamento, evita dipendenze locali | ✓ Good |
| CLI senza GUI | Uso personale, semplicità massima | ✓ Good |
| TypeScript 6.0 ESM-first | Allineato con ecosistema 2026, ora 9 richiede ESM | ✓ Good |
| Anthropic SDK maxRetries per Claude | Built-in retry evita wrapper custom e double-retry | ✓ Good |
| Custom withRetry per CloudConvert | SDK non ha retry built-in, serve wrapper dedicato | ✓ Good |
| Template vars da filename parsing | Nessun arg CLI aggiuntivo, dati già disponibili | ✓ Good |

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
*Last updated: 2026-03-27 after v1.0 milestone*

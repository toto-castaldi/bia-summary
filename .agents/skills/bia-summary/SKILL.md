---
name: bia-summary
description: Crea riassunti PDF da report di analisi corporea BIA Akern (Bodygram). Usa questa skill quando l'utente chiede di creare un riassunto BIA, analizzare un report Bodygram, o generare un PDF di composizione corporea. Funziona con file PDF BIA da qualsiasi posizione nel filesystem.
---

# BIA Summary - Generatore Riassunti Analisi Corporea

Questa skill analizza report PDF di analisi corporea BIA Akern (Bodygram) e genera riassunti PDF professionali e comprensibili per i clienti.

## Setup (una sola volta)

```bash
cd /home/toto/scm-projects/bia-summary/.agents/skills/bia-summary
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Workflow

### 1. Estrai i dati dal PDF BIA

```bash
cd /home/toto/scm-projects/bia-summary/.agents/skills/bia-summary
.venv/bin/python scripts/extract_bia.py "/percorso/al/file/bia.pdf"
```

Output: JSON con dati estratti (anagrafica, composizione corporea, metabolismo).

### 2. Crea il riassunto seguendo queste regole

Comportati come un **tecnico specializzato nella misurazione corporea con BIA**.

#### Struttura del riassunto:

1. **Intestazione** con dati anagrafici del cliente e data dell'esame

2. **Dati principali** - Estrai e mostra chiaramente:
   - Massa grassa: percentuale E kg
   - Massa magra: percentuale E kg

3. **Tabella obiettivi** con SOLO due righe:
   
   | Obiettivo | % Grasso Target | Kg da Perdere |
   |-----------|-----------------|---------------|
   | In Forma | vedi sotto | calcola |
   | Ottima Definizione | vedi sotto | calcola |
   
   Target per sesso:
   - **DONNA**: "ottima definizione" = 18%, "in forma" = 26%
   - **UOMO**: "ottima definizione" = 14%, "in forma" = 22%
   
   Calcola i kg da perdere per raggiungere ogni obiettivo.

4. **Metabolismo** - Prospetto con:
   - BMR (Metabolismo Basale): cosa significa, valore in kcal
   - TDEE (Dispendio Energetico Totale): cosa significa, valore in kcal

5. **Consigli nutrizionali** generali e pratici

6. **Idratazione** - Commenta lo stato di idratazione:
   - Idratazione tissutale (TBW/FFM): valori normali 72.7-74.3%
   - Rapporto acqua intra/extra cellulare
   - Consigli pratici per una corretta idratazione

7. **Qualità Cellulare** - Commenta l'angolo di fase:
   - Angolo di fase (PhA): valori normali adulto sano 5-7°
   - Cosa indica sulla salute cellulare e stato nutrizionale
   - Valori alti = buona integrità cellulare e massa muscolare
   - Valori bassi = possibile malnutrizione o perdita muscolare

#### Regole TASSATIVE:

- ❌ **NON menzionare MAI il BMI** (neanche la parola)
- ❌ **NON includere frasi tipo** "Se vuoi, posso anche prepararti..."
- ✅ Linguaggio chiaro e comprensibile per il cliente
- ✅ Formatta in Markdown per la conversione in PDF

### 3. Genera il PDF

Salva il contenuto Markdown in un file temporaneo (es. `/tmp/riassunto_temp.md`), poi:

```bash
cd /home/toto/scm-projects/bia-summary/.agents/skills/bia-summary
.venv/bin/python scripts/generate_pdf.py "/tmp/riassunto_temp.md" "/percorso/output.pdf"
```

### 4. Nome e posizione del file output

Il PDF deve essere salvato nella **stessa cartella del PDF BIA originale** con nome:

```
[NOME_FILE_BIA_SENZA_ESTENSIONE]_riassunto.pdf
```

**Esempio:**
- Input: `/home/utente/clienti/mario_rossi_bia.pdf`
- Output: `/home/utente/clienti/mario_rossi_bia_riassunto.pdf`

## File della Skill

- `scripts/extract_bia.py` - Estrae dati dal PDF BIA (output JSON)
- `scripts/generate_pdf.py` - Converte Markdown in PDF
- `templates/style.css` - Stile CSS personalizzabile per il PDF
- `requirements.txt` - Dipendenze Python

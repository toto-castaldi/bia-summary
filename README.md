BIA Summary
===========

Skill per [pi](https://pi.dev/) che genera riassunti PDF professionali da report di analisi corporea BIA Akern (Bodygram).

## 🎯 Cosa Fa

Trasforma un report tecnico BIA in un riassunto chiaro e comprensibile per il cliente:

```
┌─────────────────────┐      ┌─────────────────────┐
│  Report BIA Akern   │ ───▶ │  Riassunto PDF      │
│  (tecnico, 6 pag.)  │      │  (chiaro, 2 pag.)   │
└─────────────────────┘      └─────────────────────┘
```

### Contenuto del Riassunto

| Sezione | Descrizione |
|---------|-------------|
| 📋 Dati Cliente | Anagrafica e data esame |
| ⚖️ Composizione Corporea | Massa grassa e magra (kg e %) |
| 🎯 Obiettivi | Tabella con kg da perdere per "In Forma" e "Ottima Definizione" |
| 🔥 Metabolismo | BMR e TDEE con spiegazioni pratiche |
| 🥗 Consigli Nutrizionali | Indicazioni su proteine, carboidrati, grassi |
| 💧 Idratazione | Stato idrico e consigli |
| ⭐ Qualità Cellulare | Angolo di fase e salute cellulare |

## 🚀 Installazione

### Requisiti

- Python 3.10+
- [pi coding agent](https://pi.dev/)

### Setup

```bash
cd /path/to/bia-summary/.agents/skills/bia-summary
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## 📖 Uso

### Con pi (raccomandato)

```bash
# Metodo 1: Comando skill
/skill:bia-summary /percorso/al/report_bia.pdf

# Metodo 2: Linguaggio naturale
"Crea il riassunto BIA per /percorso/al/report_bia.pdf"
```

### Output

Il PDF viene salvato nella stessa cartella del file originale:

```
/cartella/report_bia.pdf           # Input
/cartella/report_bia_riassunto.pdf # Output generato
```

## 📁 Struttura

```
bia-summary/
├── README.md
└── .agents/skills/bia-summary/
    ├── SKILL.md              # Istruzioni per l'agente AI
    ├── requirements.txt      # Dipendenze Python
    ├── scripts/
    │   ├── extract_bia.py    # Estrazione dati da PDF
    │   └── generate_pdf.py   # Generazione PDF con WeasyPrint
    ├── templates/
    │   └── style.css         # Stile personalizzabile
    └── .venv/                # Virtual environment
```

## 🎨 Personalizzazione

### Stile PDF

Modifica `templates/style.css` per cambiare:

- Colori e font
- Margini e spaziature
- Stile tabelle
- Header/footer

```css
/* Esempio: cambiare colore titoli */
h1 {
    color: #1a5276;
    border-bottom: 3px solid #3498db;
}
```

### Obiettivi Massa Grassa

Gli obiettivi sono definiti in `SKILL.md`:

| Sesso | In Forma | Ottima Definizione |
|-------|----------|-------------------|
| Donna | 26% | 18% |
| Uomo | 22% | 14% |

## 🔧 Script Standalone

Gli script possono essere usati anche indipendentemente da pi:

```bash
# Estrai dati (output JSON)
.venv/bin/python scripts/extract_bia.py report.pdf

# Genera PDF da Markdown
.venv/bin/python scripts/generate_pdf.py input.md output.pdf
```

## 📋 Compatibilità

Testato con:
- BIA Akern 101 Biva Pro
- Software Bodygram v3.4.x
- Report PDF standard Bodygram

## 📄 Licenza

MIT

---

Made with ❤️ per semplificare la comunicazione con i clienti

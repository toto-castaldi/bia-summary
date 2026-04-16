#!/usr/bin/env python3
"""
Estrae i dati da un report PDF BIA Akern (Bodygram).
Output: JSON con tutti i dati rilevanti.

Uso: python extract_bia.py "/percorso/al/file.pdf"
"""

import sys
import json
import re
import pdfplumber


def extract_bia_data(pdf_path: str) -> dict:
    """Estrae i dati dal PDF BIA."""
    
    data = {
        "anagrafica": {},
        "misure": {},
        "composizione": {},
        "idratazione": {},
        "metabolismo": {},
        "raw_text": ""
    }
    
    with pdfplumber.open(pdf_path) as pdf:
        full_text = ""
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                full_text += text + "\n"
        
        data["raw_text"] = full_text
        
        # === ANAGRAFICA ===
        
        # Nome - cerca pattern "Nome Cognome (ETÀ: XX)"
        nome_match = re.search(r'^([A-Za-zÀ-ÿ\s]+)\s*\(ETÀ:\s*(\d+)\)', full_text, re.MULTILINE)
        if nome_match:
            data["anagrafica"]["nome"] = nome_match.group(1).strip()
            data["anagrafica"]["eta"] = int(nome_match.group(2))
        
        # Sesso
        sesso_match = re.search(r'Sesso:\s*(Femminile|Maschile)', full_text)
        if sesso_match:
            data["anagrafica"]["sesso"] = sesso_match.group(1)
        
        # Data di nascita
        nascita_match = re.search(r'Data di nascita:\s*(\d{2}/\d{2}/\d{4})', full_text)
        if nascita_match:
            data["anagrafica"]["data_nascita"] = nascita_match.group(1)
        
        # Data esame - cerca pattern "Esame del:" seguito da data
        esame_match = re.search(r'(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2})', full_text)
        if esame_match:
            data["anagrafica"]["data_esame"] = esame_match.group(1)
        
        # === MISURE ===
        
        # Peso
        peso_match = re.search(r'Peso:\s*([\d.]+)\s*kg', full_text)
        if peso_match:
            data["misure"]["peso_kg"] = float(peso_match.group(1))
        
        # Altezza
        altezza_match = re.search(r'Altezza:\s*([\d.]+)\s*cm', full_text)
        if altezza_match:
            data["misure"]["altezza_cm"] = float(altezza_match.group(1))
        
        # === COMPOSIZIONE CORPOREA ===
        
        # Massa Grassa (FM)
        fm_match = re.search(r'Massa Grassa \(FM\)\s+([\d.]+)\s*kg\s+([\d.]+)\s*%', full_text)
        if fm_match:
            data["composizione"]["massa_grassa_kg"] = float(fm_match.group(1))
            data["composizione"]["massa_grassa_perc"] = float(fm_match.group(2))
        
        # Massa Magra (FFM)
        ffm_match = re.search(r'Massa Magra \(FFM\)\s+([\d.]+)\s*kg\s+([\d.]+)\s*%', full_text)
        if ffm_match:
            data["composizione"]["massa_magra_kg"] = float(ffm_match.group(1))
            data["composizione"]["massa_magra_perc"] = float(ffm_match.group(2))
        
        # Massa Cellulare (BCM)
        bcm_match = re.search(r'Massa Cellulare \(BCM\)\s+([\d.]+)\s*kg\s+([\d.]+)\s*%', full_text)
        if bcm_match:
            data["composizione"]["massa_cellulare_kg"] = float(bcm_match.group(1))
            data["composizione"]["massa_cellulare_perc"] = float(bcm_match.group(2))
        
        # Massa Muscolo-Scheletrica (SMM)
        smm_match = re.search(r'Massa Muscolo-Scheletrica \(SMM\)\s+([\d.]+)\s*kg\s+([\d.]+)\s*%', full_text)
        if smm_match:
            data["composizione"]["massa_muscolare_kg"] = float(smm_match.group(1))
            data["composizione"]["massa_muscolare_perc"] = float(smm_match.group(2))
        
        # Angolo di Fase (indicatore qualità cellulare)
        pha_match = re.search(r'Angolo di Fase \(PhA\)\s+([\d.]+)\s*°', full_text)
        if pha_match:
            data["composizione"]["angolo_fase"] = float(pha_match.group(1))
        
        # === IDRATAZIONE ===
        
        # Acqua Totale (TBW)
        tbw_match = re.search(r'Acqua Totale \(TBW\)\s+([\d.]+)\s*L\s+([\d.]+)\s*%', full_text)
        if tbw_match:
            data["idratazione"]["acqua_totale_l"] = float(tbw_match.group(1))
            data["idratazione"]["acqua_totale_perc"] = float(tbw_match.group(2))
        
        # Acqua Extra Cellulare (ECW)
        ecw_match = re.search(r'Acqua Extra Cellulare \(ECW\)\s+([\d.]+)\s*L\s+([\d.]+)\s*%', full_text)
        if ecw_match:
            data["idratazione"]["acqua_extra_l"] = float(ecw_match.group(1))
            data["idratazione"]["acqua_extra_perc"] = float(ecw_match.group(2))
        
        # Acqua Intra Cellulare (ICW)
        icw_match = re.search(r'Acqua Intra Cellulare \(ICW\)\s+([\d.]+)\s*L\s+([\d.]+)\s*%', full_text)
        if icw_match:
            data["idratazione"]["acqua_intra_l"] = float(icw_match.group(1))
            data["idratazione"]["acqua_intra_perc"] = float(icw_match.group(2))
        
        # Idratazione tissutale (TBW/FFM)
        hydra_match = re.search(r'Idratazione tissutale:\s*([\d.]+)\s*%', full_text)
        if hydra_match:
            data["idratazione"]["idratazione_tissutale_perc"] = float(hydra_match.group(1))
        
        # === METABOLISMO ===
        
        # BMR
        bmr_match = re.search(r'Metabolismo Basale \(BMR\)\s+([\d.]+)\s*kcal', full_text)
        if bmr_match:
            data["metabolismo"]["bmr_kcal"] = float(bmr_match.group(1))
        
        # TDEE
        tdee_match = re.search(r'Dispendio Energetico Giornaliero Totale[^0-9]+([\d.]+)\s*kcal', full_text)
        if tdee_match:
            data["metabolismo"]["tdee_kcal"] = float(tdee_match.group(1))
    
    return data


def main():
    if len(sys.argv) < 2:
        print("Uso: python extract_bia.py <percorso_pdf>", file=sys.stderr)
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    try:
        data = extract_bia_data(pdf_path)
        # Rimuovi raw_text dall'output per leggibilità (ma disponibile se serve)
        output = {k: v for k, v in data.items() if k != "raw_text"}
        print(json.dumps(output, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Errore: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

/**
 * BIA Watcher Extension
 *
 * Monitora una cartella per nuovi report BIA PDF e li elabora automaticamente
 * usando la skill bia-summary.
 *
 * Comandi:
 *   /bia-watch <cartella>  - Imposta la cartella da monitorare
 *   /bia-scan              - Scansiona manualmente la cartella
 *   /bia-status            - Mostra stato del watcher
 *
 * Configurazione default: ~/BIA-Reports
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

// Stato persistente nella sessione
interface BiaWatcherState {
	watchFolder: string;
	processedFiles: string[]; // File già elaborati (path assoluti)
}

const DEFAULT_WATCH_FOLDER = path.join(process.env.HOME || "/home/toto", "BIA-Reports");

export default function biaWatcherExtension(pi: ExtensionAPI) {
	let watchFolder = DEFAULT_WATCH_FOLDER;
	let processedFiles = new Set<string>();
	let watcher: fs.FSWatcher | null = null;
	let isProcessing = false;

	// Persiste lo stato corrente
	function persistState() {
		pi.appendEntry<BiaWatcherState>("bia-watcher-config", {
			watchFolder,
			processedFiles: Array.from(processedFiles),
		});
	}

	// Controlla se un file è un PDF BIA (non è già un riassunto)
	function isBiaPdf(filename: string): boolean {
		const lower = filename.toLowerCase();
		return lower.endsWith(".pdf") && !lower.includes("_riassunto");
	}

	// Controlla se esiste già il riassunto per un file
	function hasExistingSummary(pdfPath: string): boolean {
		const dir = path.dirname(pdfPath);
		const basename = path.basename(pdfPath, ".pdf");
		const summaryPath = path.join(dir, `${basename}_riassunto.pdf`);
		return fs.existsSync(summaryPath);
	}

	// Trova nuovi file PDF da processare
	function findNewPdfs(): string[] {
		if (!fs.existsSync(watchFolder)) {
			return [];
		}

		const files = fs.readdirSync(watchFolder);
		const newPdfs: string[] = [];

		for (const file of files) {
			if (isBiaPdf(file)) {
				const fullPath = path.join(watchFolder, file);
				// È nuovo se non è stato processato E non ha già un riassunto
				if (!processedFiles.has(fullPath) && !hasExistingSummary(fullPath)) {
					newPdfs.push(fullPath);
				}
			}
		}

		return newPdfs;
	}

	// Processa un singolo file BIA
	async function processBiaFile(pdfPath: string, ctx: ExtensionContext) {
		if (isProcessing) {
			ctx.ui.notify("⏳ Elaborazione già in corso, attendere...", "warning");
			return;
		}

		isProcessing = true;
		const filename = path.basename(pdfPath);

		try {
			ctx.ui.notify(`📊 Nuovo report BIA rilevato: ${filename}`, "info");
			ctx.ui.setStatus("bia-watcher", `Elaborazione: ${filename}`);

			// Invia messaggio utente per triggerare la skill
			pi.sendUserMessage(
				`/skill:bia-summary\n\nElabora questo report BIA e genera il riassunto PDF:\n${pdfPath}`,
				{ deliverAs: "followUp" }
			);

			// Marca come processato
			processedFiles.add(pdfPath);
			persistState();

		} finally {
			isProcessing = false;
			ctx.ui.setStatus("bia-watcher", undefined);
		}
	}

	// Avvia il watcher sulla cartella
	function startWatcher(ctx: ExtensionContext) {
		stopWatcher();

		if (!fs.existsSync(watchFolder)) {
			try {
				fs.mkdirSync(watchFolder, { recursive: true });
				ctx.ui.notify(`📁 Creata cartella: ${watchFolder}`, "info");
			} catch (err) {
				ctx.ui.notify(`❌ Impossibile creare cartella: ${watchFolder}`, "error");
				return;
			}
		}

		try {
			watcher = fs.watch(watchFolder, (eventType, filename) => {
				if (eventType === "rename" && filename && isBiaPdf(filename)) {
					const fullPath = path.join(watchFolder, filename);
					// Aspetta un attimo che il file sia completamente scritto
					setTimeout(() => {
						if (fs.existsSync(fullPath) && !processedFiles.has(fullPath) && !hasExistingSummary(fullPath)) {
							processBiaFile(fullPath, ctx);
						}
					}, 1000);
				}
			});

			ctx.ui.setWidget("bia-watcher", [`👁️ Monitoraggio BIA: ${watchFolder}`], { placement: "belowEditor" });
			ctx.ui.notify(`👁️ Monitoraggio attivo su: ${watchFolder}`, "success");
		} catch (err) {
			ctx.ui.notify(`❌ Errore avvio watcher: ${err}`, "error");
		}
	}

	// Ferma il watcher
	function stopWatcher() {
		if (watcher) {
			watcher.close();
			watcher = null;
		}
	}

	// Ripristina stato dalla sessione
	function restoreState(ctx: ExtensionContext) {
		const entries = ctx.sessionManager.getBranch();

		for (const entry of entries) {
			if (entry.type === "custom" && entry.customType === "bia-watcher-config") {
				const data = entry.data as BiaWatcherState | undefined;
				if (data) {
					watchFolder = data.watchFolder || DEFAULT_WATCH_FOLDER;
					processedFiles = new Set(data.processedFiles || []);
				}
			}
		}
	}

	// === EVENTI ===

	pi.on("session_start", async (_event, ctx) => {
		restoreState(ctx);
		startWatcher(ctx);

		// Controlla subito se ci sono file da processare
		const newPdfs = findNewPdfs();
		if (newPdfs.length > 0) {
			ctx.ui.notify(`📋 Trovati ${newPdfs.length} nuovi report BIA da elaborare`, "info");
		}
	});

	pi.on("session_shutdown", async () => {
		stopWatcher();
	});

	// === COMANDI ===

	// Comando per impostare la cartella da monitorare
	pi.registerCommand("bia-watch", {
		description: "Imposta la cartella da monitorare per i report BIA",
		handler: async (args, ctx) => {
			const newFolder = args.trim();

			if (!newFolder) {
				// Mostra dialog per selezionare/inserire cartella
				const folder = await ctx.ui.input(
					"📁 Cartella da monitorare:",
					watchFolder
				);

				if (!folder) {
					ctx.ui.notify("Operazione annullata", "info");
					return;
				}

				watchFolder = path.resolve(folder);
			} else {
				watchFolder = path.resolve(newFolder);
			}

			persistState();
			startWatcher(ctx);
		},
	});

	// Comando per scansionare manualmente
	pi.registerCommand("bia-scan", {
		description: "Scansiona la cartella BIA e processa nuovi report",
		handler: async (_args, ctx) => {
			const newPdfs = findNewPdfs();

			if (newPdfs.length === 0) {
				ctx.ui.notify("✅ Nessun nuovo report BIA da elaborare", "info");
				return;
			}

			// Mostra lista e chiedi conferma
			const items = newPdfs.map(p => path.basename(p));
			const choice = await ctx.ui.select(
				`📊 Trovati ${newPdfs.length} nuovi report BIA.\nSeleziona quale elaborare:`,
				["📋 Elabora tutti", ...items, "❌ Annulla"]
			);

			if (!choice || choice === "❌ Annulla") {
				return;
			}

			if (choice === "📋 Elabora tutti") {
				// Elabora tutti in sequenza
				for (const pdfPath of newPdfs) {
					await processBiaFile(pdfPath, ctx);
					// Aspetta che l'agente finisca prima del prossimo
					await ctx.waitForIdle();
				}
			} else {
				// Elabora solo quello selezionato
				const selectedPath = newPdfs.find(p => path.basename(p) === choice);
				if (selectedPath) {
					await processBiaFile(selectedPath, ctx);
				}
			}
		},
	});

	// Comando per vedere lo stato
	pi.registerCommand("bia-status", {
		description: "Mostra lo stato del watcher BIA",
		handler: async (_args, ctx) => {
			const newPdfs = findNewPdfs();
			const allPdfs = fs.existsSync(watchFolder)
				? fs.readdirSync(watchFolder).filter(isBiaPdf)
				: [];

			const status = [
				`📁 Cartella: ${watchFolder}`,
				`📊 PDF totali: ${allPdfs.length}`,
				`✅ Già elaborati: ${processedFiles.size}`,
				`🆕 Da elaborare: ${newPdfs.length}`,
				`👁️ Watcher: ${watcher ? "attivo" : "inattivo"}`,
			];

			await ctx.ui.select("📊 Stato BIA Watcher", status);
		},
	});

	// Comando per resettare i file processati (utile per ri-elaborare)
	pi.registerCommand("bia-reset", {
		description: "Resetta la lista dei file BIA già elaborati",
		handler: async (_args, ctx) => {
			const confirm = await ctx.ui.confirm(
				"⚠️ Reset",
				`Vuoi resettare la lista dei ${processedFiles.size} file già elaborati?\nQuesto permetterà di ri-elaborarli.`
			);

			if (confirm) {
				processedFiles.clear();
				persistState();
				ctx.ui.notify("🔄 Lista file elaborati resettata", "success");
			}
		},
	});
}

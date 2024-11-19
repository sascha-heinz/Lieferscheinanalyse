document.getElementById("analyze-btn").addEventListener("click", analyzePDFs);
document.getElementById("export-btn").addEventListener("click", exportToExcel);
document.getElementById("reset-btn").addEventListener("click", resetPage);

const modal = document.getElementById("error-modal");
const closeModalBtn = document.querySelector(".close-btn");
const closeModalButton = document.getElementById("close-modal-btn");

closeModalBtn.onclick = closeModal;
closeModalButton.onclick = closeModal;

function closeModal() {
    modal.style.display = "none";
}

let headersSet = false;  // Flag, um sicherzustellen, dass die Header nur einmal gesetzt werden

async function analyzePDFs() {
    const fileInput = document.getElementById("file-input");
    const files = fileInput.files;
    if (!files.length) {
        alert("Bitte lade PDF-Dateien hoch.");
        return;
    }

    const progressBar = document.getElementById("progress-bar");
    const tableBody = document.querySelector("#results-table tbody");
    const errorList = document.getElementById("error-list");

    tableBody.innerHTML = ""; // Tabelle zurücksetzen
    errorList.innerHTML = ""; // Fehlerliste zurücksetzen
    progressBar.value = 0;

    let totalPagesProcessed = 0;
    let totalPages = 0;
    const errors = []; // Fehlerhafte Seiten speichern

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        const pdfFile = files[fileIndex];
        const pdfData = await pdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        totalPages += pdf.numPages;

        for (let i = 1; i <= pdf.numPages; i++) {
            try {
                const page = await pdf.getPage(i);
                const qrCodeData = await extractQRCodeFromPage(page);

                if (qrCodeData) {
                    const parsedData = parseQRCode(qrCodeData);

                    if (!headersSet) {
                        setTableHeaders(parsedData);
                        headersSet = true; // Header nur einmal setzen

                        // Tabelle und Header anzeigen, nachdem der erste QR-Code analysiert wurde
                        document.getElementById("results-table").style.display = "table";
                    }
                    addRowToTable(i, pdf.numPages, parsedData);
                } else {
                    // Fehler erfassen, wenn kein QR-Code erkannt wird
                    errors.push(`Datei: ${pdfFile.name}, Seite: ${i}`);
                }
            } catch (error) {
                errors.push(`Datei: ${pdfFile.name}, Seite: ${i} (Fehler: ${error.message})`);
            }

            totalPagesProcessed++;
            progressBar.value = (totalPagesProcessed / totalPages) * 100;
        }
    }

    if (errors.length > 0) {
        errors.forEach(error => {
            const listItem = document.createElement("li");
            listItem.textContent = error;
            errorList.appendChild(listItem);
        });
        modal.style.display = "block";
    } else {
        alert("Analyse abgeschlossen! Keine Fehler gefunden.");
    }
}

async function extractQRCodeFromPage(page) {
    const viewport = page.getViewport({ scale: 3 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = viewport.width * 2;
    canvas.height = viewport.height * 2;
    context.scale(2, 2);

    await page.render({ canvasContext: context, viewport }).promise;

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const qrCode = jsQR(imageData.data, canvas.width, canvas.height);

    return qrCode ? qrCode.data : null;
}

function parseQRCode(qrCodeData) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(qrCodeData, "text/xml");

    // Wir extrahieren alle Tags der untersten Ebene und speichern sie in einem Objekt
    const tags = {};

    extractTags(xml.documentElement, tags);

    return tags;
}

function extractTags(element, tags) {
    for (let child of element.children) {
        if (child.children.length === 0) {
            tags[child.nodeName] = child.textContent || "Unbekannt";
        } else {
            extractTags(child, tags);
        }
    }
}

function setTableHeaders(data) {
    const tableHeader = document.querySelector("#results-table thead tr");
    tableHeader.innerHTML = "<th>Laufende Nummer</th><th>Seitenanzahl</th>"; // Feste Header hinzufügen

    for (let key in data) {
        const th = document.createElement("th");
        th.textContent = key;
        tableHeader.appendChild(th);
    }
}

function addRowToTable(pageNumber, totalPages, data) {
    const tableBody = document.querySelector("#results-table tbody");
    const row = document.createElement("tr");

    // Laufende Nummer für diese Zeile (startet bei 1 und wird für jede Zeile erhöht)
    const laufendeNummer = tableBody.rows.length + 1;

    // Formatierte Seitenzahl: Seite X / Gesamtseitenzahl
    const formattedPageNumber = `${pageNumber} / ${totalPages}`;

    row.innerHTML = `
        <td>${laufendeNummer}</td>  <!-- Hier wird die laufende Nummer eingefügt -->
        <td>${formattedPageNumber}</td>  <!-- Hier wird die formatierte Seitenzahl eingefügt -->
    `;

    for (let key in data) {
        const td = document.createElement("td");
        td.textContent = data[key];
        row.appendChild(td);
    }

    tableBody.appendChild(row);
}


function exportToExcel() {
    const table = document.getElementById("results-table");
    const wb = XLSX.utils.table_to_book(table, { sheet: "Lieferscheine" });
    XLSX.writeFile(wb, "lieferscheine.xlsx");
}

function resetPage() {
    location.reload();  // Die Seite wird neu geladen und zurückgesetzt
}

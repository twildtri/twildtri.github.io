document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Element References ---
    const numVarsSelect = document.getElementById('num-vars');
    const varNamesContainer = document.getElementById('variable-names-container');
    const truthTableContainer = document.getElementById('truth-table-container');
    const kmapContainer = document.getElementById('kmap-container');
    const expressionEl = document.getElementById('minimized-expression');
    const piLegendEl = document.getElementById('pi-legend');
    
    // Removed: staticTableContainer, exportKmapBtn, exportTableBtn

    // --- Application State ---
    let state = {
        numVars: 3,
        variableNames: ['A', 'B', 'C'],
        truthTable: [], // Array of '0', '1', or 'x'
    };

    // --- K-Map Group Colors ---
    const GROUP_COLORS = [
        '#E6194B', '#3CB44B', '#FFE119', '#4363D8', '#F58231', '#911EB4',
        '#46F0F0', '#F032E6', '#BCF60C', '#FABEBE', '#008080', '#E6BEFF',
        '#9A6324', '#800000',
    ];

    // --- K-Map Layout Definitions ---
    const KMAP_LAYOUTS = { 2: [2, 2], 3: [2, 4], 4: [4, 4] };
    const GRAY_CODE = [['00', '01', '11', '10'], ['0', '1']];
    const KMAP_4_VAR_MAP = [
        [0, 0], [0, 1], [0, 3], [0, 2],
        [1, 0], [1, 1], [1, 3], [1, 2],
        [3, 0], [3, 1], [3, 3], [3, 2],
        [2, 0], [2, 1], [2, 3], [2, 2]
    ];
    const KMAP_4_VAR_REVERSE_MAP = [
        [0, 1, 3, 2],
        [4, 5, 7, 6],
        [12, 13, 15, 14],
        [8, 9, 11, 10]
    ];

    // --- Initialization ---
    function init() {
        state.numVars = parseInt(numVarsSelect.value);
        const defaultNames = ['A', 'B', 'C', 'D'];
        state.variableNames = defaultNames.slice(0, state.numVars);
        state.truthTable = Array(Math.pow(2, state.numVars)).fill('0');

        renderVariableNames();
        renderTruthTable();
        updateAllResults();

        // Bind event listeners
        numVarsSelect.addEventListener('change', init);
        varNamesContainer.addEventListener('input', handleVarNameChange);
        truthTableContainer.addEventListener('change', handleTruthTableChange);
        
        // Removed export button listeners
    }

    // --- UI Rendering Functions ---

    /**
     * Renders the input fields for variable names.
     */
    function renderVariableNames() {
        varNamesContainer.innerHTML = '';
        state.variableNames.forEach((name, index) => {
            const varDiv = document.createElement('div');
            
            const label = document.createElement('label');
            label.htmlFor = `var-name-${index}`;
            label.textContent = `Var ${index + 1}`;

            const input = document.createElement('input');
            input.type = 'text';
            input.id = `var-name-${index}`;
            input.dataset.index = index;
            input.value = name;
            input.maxLength = 10;

            varDiv.appendChild(label);
            varDiv.appendChild(input);
            varNamesContainer.appendChild(varDiv);
        });
        validateVariableNames();
    }

    /**
     * Renders the interactive truth table.
     */
    function renderTruthTable() {
        truthTableContainer.innerHTML = '';
        const table = document.createElement('table');
        table.className = 'truth-table';

        // Create Header
        const thead = document.createElement('thead');
        let headerRow = '<tr><th>Minterm</th>';
        state.variableNames.forEach(name => {
            headerRow += `<th>${name}</th>`;
        });
        headerRow += '<th>Output (F)</th></tr>';
        thead.innerHTML = headerRow;

        // Create Body
        const tbody = document.createElement('tbody');
        const numRows = Math.pow(2, state.numVars);
        for (let i = 0; i < numRows; i++) {
            const tr = document.createElement('tr');
            const binary = i.toString(2).padStart(state.numVars, '0');
            
            let rowHtml = `<td class="mono">m${i}</td>`;
            
            binary.split('').forEach(bit => {
                rowHtml += `<td class="mono">${bit}</td>`;
            });

            rowHtml += `<td><div class="radio-group" data-minterm="${i}">`;
            ['0', '1', 'x'].forEach(val => {
                const id = `radio-${i}-${val}`;
                const checked = state.truthTable[i] === val ? 'checked' : '';
                rowHtml += `
                    <input type="radio" id="${id}" name="minterm-${i}" value="${val}" data-index="${i}" ${checked}>
                    <label for="${id}">${val}</label>
                `;
            });
            rowHtml += '</div></td>';
            
            tr.innerHTML = rowHtml;
            tbody.appendChild(tr);
        }

        table.appendChild(thead);
        table.appendChild(tbody);
        truthTableContainer.appendChild(table);
    }

    // --- Function `renderStaticTruthTable()` has been removed ---

    /**
     * Renders the K-Map SVG, including grid, labels, values, and groups.
     * @param {Array} primeImplicants - Array of PI objects from the minimizer.
     */
    function renderKMap(primeImplicants = []) {
        kmapContainer.innerHTML = '';
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        
        const [rows, cols] = KMAP_LAYOUTS[state.numVars];
        const cellSize = 100;
        const labelOffset = 30;
        const totalWidth = cols * cellSize + labelOffset;
        const totalHeight = rows * cellSize + labelOffset;
        
        svg.setAttribute("viewBox", `0 0 ${totalWidth} ${totalHeight}`);

        // --- Draw Labels ---
        const [varsV, varsH] = getKMapVariableSplit();
        
        const hLabel = document.createElementNS(svgNS, "text");
        hLabel.setAttribute("x", labelOffset + (cols * cellSize) / 2);
        hLabel.setAttribute("y", labelOffset - 15);
        hLabel.setAttribute("class", "kmap-label");
        hLabel.textContent = varsH.join('');
        svg.appendChild(hLabel);

        const vLabel = document.createElementNS(svgNS, "text");
        vLabel.setAttribute("x", labelOffset - 15);
        vLabel.setAttribute("y", labelOffset + (rows * cellSize) / 2);
        vLabel.setAttribute("transform", `rotate(-90 ${labelOffset - 15} ${labelOffset + (rows * cellSize) / 2})`);
        vLabel.setAttribute("class", "kmap-label");
        vLabel.textContent = varsV.join('');
        svg.appendChild(vLabel);

        // Column Labels
        const colGrayCode = (cols === 2) ? GRAY_CODE[1] : GRAY_CODE[0];
        for (let c = 0; c < cols; c++) {
            const label = document.createElementNS(svgNS, "text");
            label.setAttribute("x", labelOffset + c * cellSize + cellSize / 2);
            label.setAttribute("y", labelOffset - 5);
            label.setAttribute("class", "kmap-label");
            label.textContent = colGrayCode[c];
            svg.appendChild(label);
        }

        // Row Labels
        const rowGrayCode = (rows === 2) ? GRAY_CODE[1] : GRAY_CODE[0];
         for (let r = 0; r < rows; r++) {
            const label = document.createElementNS(svgNS, "text");
            label.setAttribute("x", labelOffset - 5);
            label.setAttribute("y", labelOffset + r * cellSize + cellSize / 2);
            label.setAttribute("class", "kmap-label");
            label.setAttribute("text-anchor", "end");
            label.setAttribute("dominant-baseline", "middle");
            label.textContent = rowGrayCode[r];
            svg.appendChild(label);
        }

        // --- Draw Grid and Values ---
        const cellMap = {};
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const x = labelOffset + c * cellSize;
                const y = labelOffset + r * cellSize;

                const mintermIndex = getMintermFromCoords(r, c);
                
                cellMap[mintermIndex] = { x, y, w: cellSize, h: cellSize };

                const rect = document.createElementNS(svgNS, "rect");
                rect.setAttribute("x", x);
                rect.setAttribute("y", y);
                rect.setAttribute("width", cellSize);
                rect.setAttribute("height", cellSize);
                rect.setAttribute("class", "kmap-cell");
                svg.appendChild(rect);

                const value = state.truthTable[mintermIndex];
                const text = document.createElementNS(svgNS, "text");
                text.setAttribute("x", x + cellSize / 2);
                text.setAttribute("y", y + cellSize / 2);
                text.setAttribute("class", "kmap-value");
                text.textContent = value;
                svg.appendChild(text);
            }
        }

        // --- Draw Groups (Prime Implicants) ---
        primeImplicants.forEach((pi, index) => {
            const color = GROUP_COLORS[index % GROUP_COLORS.length];
            const term = pi.term;
            
            const rectsToDraw = getRectsForTerm(term, cellMap);

            rectsToDraw.forEach(rect => {
                const groupRect = document.createElementNS(svgNS, "rect");
                groupRect.setAttribute("x", rect.x + 2);
                groupRect.setAttribute("y", rect.y + 2);
                groupRect.setAttribute("width", rect.w - 4);
                groupRect.setAttribute("height", rect.h - 4);
                groupRect.setAttribute("class", "kmap-group");
                groupRect.setAttribute("fill", color);
                groupRect.setAttribute("stroke", color);
                svg.appendChild(groupRect);
            });
        });

        kmapContainer.appendChild(svg);
    }

    /**
     * Renders the legend for the K-Map groups.
     * @param {Array} primeImplicants - Array of PI objects.
     */
    function renderPiLegend(primeImplicants) {
        piLegendEl.innerHTML = '';
        if (primeImplicants.length === 0) {
            piLegendEl.innerHTML = '<p>No groups (all 0s).</p>';
            return;
        }

        primeImplicants.forEach((pi, index) => {
            const color = GROUP_COLORS[index % GROUP_COLORS.length];
            const expression = implicantToExpression(pi.term, state.variableNames);
            const mintermsStr = `(m${pi.minterms.join(', ')})`;
            
            const item = document.createElement('div');
            item.className = 'legend-item';
            
            const colorBox = document.createElement('div');
            colorBox.className = 'legend-color-box';
            colorBox.style.backgroundColor = color;
            colorBox.style.opacity = 0.5;

            const text = document.createElement('span');
            text.innerHTML = `<strong class="mono">${expression}</strong>&nbsp; <span class="mono">${mintermsStr}</span>`;

            item.appendChild(colorBox);
            item.appendChild(text);
            piLegendEl.appendChild(item);
        });
    }

    // --- K-Map Helper Functions ---

    /**
     * Gets the variable names for vertical and horizontal axes.
     * @returns {Array} [verticalVars, horizontalVars]
     */
    function getKMapVariableSplit() {
        const { numVars, variableNames } = state;
        switch (numVars) {
            case 2: return [[variableNames[0]], [variableNames[1]]];
            case 3: return [[variableNames[0]], [variableNames[1], variableNames[2]]];
            case 4: return [[variableNames[0], variableNames[1]], [variableNames[2], variableNames[3]]];
            default: return [[], []];
        }
    }

    /**
     * Finds the minterm index for a given K-Map [row, col].
     * @param {number} r - Row index.
     * @param {number} c - Column index.
     * @returns {number} Minterm index.
     */
    function getMintermFromCoords(r, c) {
        const { numVars } = state;
        switch (numVars) {
            case 2: return (r << 1) | c;
            case 3:
                const colMap3 = [0, 1, 3, 2];
                return (r << 2) | colMap3[c];
            case 4: return KMAP_4_VAR_REVERSE_MAP[r][c];
            default: return 0;
        }
    }

    /**
     * Finds the [row, col] for a given minterm index.
     * @param {number} minterm - Minterm index.
     * @returns {Array} [row, col]
     */
    function getCoordsFromMinterm(minterm) {
        const { numVars } = state;
        switch (numVars) {
            case 2: return [(minterm >> 1) & 1, minterm & 1];
            case 3:
                const revColMap3 = [0, 1, 3, 2];
                const a = (minterm >> 2) & 1;
                const bc = minterm & 3;
                return [a, revColMap3.indexOf(bc)];
            case 4: return KMAP_4_VAR_MAP[minterm];
            default: return [0, 0];
        }
    }

    /**
     * Calculates the bounding rectangles for a prime implicant term.
     * @param {string} term - The term (e.g., '1-0-').
     * @param {Object} cellMap - Map of minterm -> {x, y, w, h}.
     * @returns {Array} Array of {x, y, w, h} objects.
     */
    function getRectsForTerm(term, cellMap) {
        const { numVars } = state;
        const [varsV, varsH] = getKMapVariableSplit();
        
        const minterms = [];
        const numDashes = (term.match(/-/g) || []).length;
        for (let i = 0; i < Math.pow(2, numDashes); i++) {
            let tempTerm = term;
            const binaryRep = i.toString(2).padStart(numDashes, '0');
            let k = 0;
            for (let j = 0; j < term.length; j++) {
                if (tempTerm[j] === '-') {
                    tempTerm = tempTerm.substring(0, j) + binaryRep[k++] + tempTerm.substring(j + 1);
                }
            }
            minterms.push(parseInt(tempTerm, 2));
        }

        const coords = minterms.map(getCoordsFromMinterm);
        const [rows, cols] = KMAP_LAYOUTS[numVars];
        
        const r_indices = [...new Set(coords.map(c => c[0]))].sort((a, b) => a - b);
        const c_indices = [...new Set(coords.map(c => c[1]))].sort((a, b) => a - b);
        
        // Use the corrected findContiguousGroups function
        const rowGroups = findContiguousGroups(r_indices, rows);
        const colGroups = findContiguousGroups(c_indices, cols);

        const rects = [];
        const baseCell = cellMap[0];
        
        for (const rg of rowGroups) {
            for (const cg of colGroups) {
                const r_start = rg[0];
                const r_end = rg[rg.length - 1];
                const c_start = cg[0];
                const c_end = cg[cg.length - 1];
                
                const startCell = cellMap[getMintermFromCoords(r_start, c_start)];
                const endCell = cellMap[getMintermFromCoords(r_end, c_end)];
                
                const x = startCell.x;
                const y = startCell.y;
                const w = (endCell.x + endCell.w) - startCell.x;
                const h = (endCell.y + endCell.h) - startCell.y;

                rects.push({ x, y, w, h });
            }
        }
        return rects;
    }

    /**
     * (This is the corrected version from our previous fix)
     * Helper for getRectsForTerm. Finds contiguous blocks in a sorted list of indices.
     * @param {Array} indices - Sorted array of indices (e.g., [0, 2, 3])
     * @param {number} max - The size of the dimension (e.g., 4).
     * @returns {Array} Array of groups (e.g., [[0], [2, 3]])
     */
    function findContiguousGroups(indices, max) {
        if (indices.length === 0) return [];
        
        indices.sort((a, b) => a - b);
        
        const groups = [];
        let currentGroup = [indices[0]];

        for (let i = 1; i < indices.length; i++) {
            if (indices[i] === indices[i-1] + 1) {
                currentGroup.push(indices[i]);
            } else {
                groups.push(currentGroup);
                currentGroup = [indices[i]];
            }
        }
        groups.push(currentGroup);
        return groups;
    }


    // --- Event Handlers ---

    /**
     * Handles changes to the variable name inputs.
     */
    function handleVarNameChange(e) {
        if (e.target.tagName === 'INPUT') {
            const index = parseInt(e.target.dataset.index);
            const value = e.target.value.trim();
            
            state.variableNames[index] = value;
            
            if (validateVariableNames()) {
                updateAllResults();
            } else {
                // If invalid, clear results (but not the removed static table)
                expressionEl.textContent = 'Invalid variable names';
                kmapContainer.innerHTML = '';
                piLegendEl.innerHTML = '';
            }
        }
    }

    /**
     * Handles clicks on the truth table radio buttons.
     */
    function handleTruthTableChange(e) {
        if (e.target.type === 'radio') {
            const index = parseInt(e.target.dataset.index);
            const value = e.target.value;
            state.truthTable[index] = value;
            
            updateAllResults();
        }
    }

    /**
     * Validates all variable name inputs for empty or duplicate values.
     * @returns {boolean} True if all names are valid.
     */
    function validateVariableNames() {
        const inputs = varNamesContainer.querySelectorAll('input');
        const names = Array.from(inputs).map(input => input.value.trim());
        let allValid = true;

        inputs.forEach((input, index) => {
            const value = names[index];
            let isValid = true;
            
            if (value === '') isValid = false;
            if (names.some((name, i) => name === value && i !== index)) isValid = false;

            input.classList.toggle('invalid', !isValid);
            if (!isValid) allValid = false;
        });
        return allValid;
    }

    // --- Main Update Function ---

    /**
     * Runs the minimization and updates all result components.
     */
    function updateAllResults() {
        if (!validateVariableNames()) {
            expressionEl.textContent = 'Error: Fix invalid variable names.';
            kmapContainer.innerHTML = ''; // Clear K-Map on error
            piLegendEl.innerHTML = ''; // Clear legend on error
            return;
        }

        const minterms = [];
        const dontCares = [];
        state.truthTable.forEach((val, i) => {
            if (val === '1') minterms.push(i);
            else if (val === 'x') dontCares.push(i);
        });

        const { primeImplicants, expression } = quineMcCluskey(minterms, dontCares, state.numVars);

        expressionEl.textContent = expression || "0";
        renderKMap(primeImplicants);
        renderPiLegend(primeImplicants);
        
        // Removed call to renderStaticTruthTable()
    }


    // --- Quine-McCluskey Algorithm ---

    /**
     * Main Q-M function.
     * @param {Array} minterms - Minterms where output is 1.
     * @param {Array} dontCares - Minterms where output is x.
     * @param {number} numVars - Number of variables.
     * @returns {Object} { primeImplicants, expression }
     */
    function quineMcCluskey(minterms, dontCares, numVars) {
        const allMinterms = [...minterms, ...dontCares].sort((a, b) => a - b);
        if (allMinterms.length === 0) return { primeImplicants: [], expression: "0" };
        if (minterms.length === 0) return { primeImplicants: [], expression: "0" };
        if (minterms.length + dontCares.length === Math.pow(2, numVars)) {
            return { 
                primeImplicants: [{ term: '-'.repeat(numVars), minterms: allMinterms }], 
                expression: "1" 
            };
        }

        let groups = Array.from({ length: numVars + 1 }, () => []);
        allMinterms.forEach(minterm => {
            const binary = minterm.toString(2).padStart(numVars, '0');
            const ones = (binary.match(/1/g) || []).length;
            groups[ones].push({ term: binary, minterms: [minterm], used: false });
        });

        let primeImplicants = [];
        while (true) {
            let nextGroups = Array.from({ length: numVars + 1 }, () => []);
            let combined = false;

            for (let i = 0; i < groups.length - 1; i++) {
                for (const term1 of groups[i]) {
                    for (const term2 of groups[i + 1]) {
                        const combinedTerm = combineTerms(term1.term, term2.term);
                        if (combinedTerm) {
                            term1.used = true;
                            term2.used = true;
                            combined = true;
                            
                            const newMinterms = [...new Set([...term1.minterms, ...term2.minterms])].sort((a,b) => a-b);
                            const newImplicant = {
                                term: combinedTerm,
                                minterms: newMinterms,
                                used: false
                            };

                            if (!nextGroups[i].some(t => t.term === newImplicant.term)) {
                                nextGroups[i].push(newImplicant);

                            }
                        }
                    }
                }
            }

            for (const group of groups) {
                for (const term of group) {
                    if (!term.used) primeImplicants.push(term);
                }
            }

            if (!combined) break;
            groups = nextGroups;
        }
        
        const piMap = new Map();
        primeImplicants.forEach(pi => piMap.set(pi.term, pi));
        primeImplicants = [...piMap.values()];

        // --- Step 2: Prime Implicant Chart (Selection) ---
        let mintermsToCover = new Set(minterms);
        const selectedPIs = [];
        
        // 1. Find Essential Prime Implicants
        const essentialPIs = [];
        const coveredByCount = {};
        minterms.forEach(mt => { coveredByCount[mt] = []; });
        
        primeImplicants.forEach((pi, pi_index) => {
           pi.minterms.forEach(mt => {
               if (mintermsToCover.has(mt)) {
                   coveredByCount[mt].push(pi_index);
               }
           });
        });
        
        minterms.forEach(mt => {
            if (coveredByCount[mt].length === 1) {
                const pi_index = coveredByCount[mt][0];
                if (!essentialPIs.some(p => p.term === primeImplicants[pi_index].term)) {
                    essentialPIs.push(primeImplicants[pi_index]);
                }
            }
        });
        
        essentialPIs.forEach(pi => {
            selectedPIs.push(pi);
            pi.minterms.forEach(mt => mintermsToCover.delete(mt));
        });

        // 2. Cover remaining minterms (Greedy)
        let remainingPIs = primeImplicants.filter(pi => !selectedPIs.some(p => p.term === pi.term));

        while (mintermsToCover.size > 0 && remainingPIs.length > 0) {
            let bestPI = null;
            let maxCovered = -1;

            remainingPIs.forEach(pi => {
                let coveredCount = 0;
                pi.minterms.forEach(mt => {
                    if (mintermsToCover.has(mt)) coveredCount++;
                });
                
                if (coveredCount > maxCovered) {
                    maxCovered = coveredCount;
                    bestPI = pi;
                }
            });

            if (bestPI && maxCovered > 0) {
                selectedPIs.push(bestPI);
                bestPI.minterms.forEach(mt => mintermsToCover.delete(mt));
                remainingPIs = remainingPIs.filter(pi => pi.term !== bestPI.term);
            } else {
                break;
            }
        }
        
        // --- Step 3: Format Expression ---
        const expression = selectedPIs
            .map(pi => implicantToExpression(pi.term, state.variableNames))
            .join(' + ');
        
        return { primeImplicants: selectedPIs, expression: expression };
    }

    /**
     * Q-M Helper: Tries to combine two binary terms.
     * @returns {string|null} Combined term (e.g., '1-0') or null.
     */
    function combineTerms(term1, term2) {
        let diff = 0;
        let diffIndex = -1;
        for (let i = 0; i < term1.length; i++) {
            if (term1[i] !== term2[i]) {
                diff++;
                diffIndex = i;
            }
        }
        if (diff === 1) {
            return term1.substring(0, diffIndex) + '-' + term1.substring(diffIndex + 1);
        }
        return null;
    }

    /**
     * Q-M Helper: Converts an implicant term to a human-readable expression.
     * @param {string} term - e.g., '01-'
     * @param {Array} variables - e.g., ['A', 'B', 'C']
     * @returns {string} - e.g., "A'B"
     */
    function implicantToExpression(term, variables) {
        let parts = [];
        for (let i = 0; i < term.length; i++) {
            if (term[i] === '1') parts.push(variables[i]);
            else if (term[i] === '0') parts.push(variables[i] + "'");
        }
        if (parts.length === 0) return '1';
        return parts.join('');
    }


    // --- Export Functions Have Been Removed ---


    // --- Start the app ---
    init();
});
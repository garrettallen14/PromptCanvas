class CanvasManager {
    constructor() {
        this.setupCanvas();
        this.setupGrid();
        this.setupHistory();
        this.setColor('#000000'); // Initialize with black
        this.currentTool = 'pencil';
        this.debug = true; // Enable debug logging
        this.userChanges = new Set(); // Track unique pixel changes
        this.isTrackingChanges = false; // Flag to control when we track changes
    }

    setPixel(x, y, color) {
        if (!this.isValidCoordinate(x, y)) {
            // console.log(`Invalid coordinate (${x},${y})`);
            return false;
        }
        
        const oldColor = [...this.grid[y][x]];
        this.grid[y][x] = [...color];
        this.coloredPixels[y][x] = true;
        
        if (this.debug) {
            // console.log(`Pixel (${x},${y}): ${oldColor.join(',')} -> ${color.join(',')}`);
        }
        
        // Track user changes if enabled and colors are different
        if (this.isTrackingChanges && oldColor.toString() !== color.toString()) {
            this.userChanges.add({
                x,
                y,
                color: [...color]
            });
        }
        
        return true;
    }

    setupCanvas() {
        this.mainCanvas = document.createElement('canvas');
        this.mainCanvas.width = 500;
        this.mainCanvas.height = 500;
        this.ctx = this.mainCanvas.getContext('2d');
        
        // Set canvas background to white
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
        
        document.getElementById('canvas-container').appendChild(this.mainCanvas);
        
        this.setupEventListeners();
    }

    setupGrid() {
        const gridSize = 100;
        this.pixelSize = this.mainCanvas.width / gridSize;
        this.dimensions = { width: gridSize, height: gridSize };
        
        // Initialize grid with white color
        this.grid = Array(gridSize).fill().map(() => 
            Array(gridSize).fill().map(() => [255, 255, 255])
        );
        
        // Track colored pixels
        this.coloredPixels = Array(gridSize).fill().map(() => 
            Array(gridSize).fill(false)
        );
    }

    setupHistory() {
        this.history = [];
        this.currentStep = -1;
        this.saveState();
    }

    setupEventListeners() {
        let isDrawing = false;
        let lastX = 0;
        let lastY = 0;

        // Add resize button listener
        document.getElementById('resizeButton').addEventListener('click', () => {
            const modal = document.getElementById('resizeModal');
            const widthInput = document.getElementById('canvasWidth');
            const heightInput = document.getElementById('canvasHeight');
            
            // Set current values
            widthInput.value = this.dimensions.width;
            heightInput.value = this.dimensions.height;
            
            // Show modal
            modal.style.display = 'flex';
            
            // Handle cancel
            document.getElementById('cancelResize').onclick = () => {
                modal.style.display = 'none';
            };
            
            // Handle resize
            document.getElementById('confirmResize').onclick = () => {
                const width = parseInt(widthInput.value);
                const height = parseInt(heightInput.value);
                
                if (width && height && width > 0 && width <= 1000 && height > 0 && height <= 1000) {
                    this.resizeCanvas(width, height);
                    modal.style.display = 'none';
                } else {
                    alert('Please enter valid dimensions (1-1000)');
                }
            };
            
            // Close modal when clicking outside
            modal.onclick = (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                }
            };
        });

        const getGridPosition = (e) => {
            const rect = this.mainCanvas.getBoundingClientRect();
            const x = Math.floor((e.clientX - rect.left) / this.pixelSize);
            const y = Math.floor((e.clientY - rect.top) / this.pixelSize);
            return { 
                x: Math.max(0, Math.min(x, this.dimensions.width - 1)), 
                y: Math.max(0, Math.min(y, this.dimensions.height - 1)) 
            };
        };

        this.mainCanvas.addEventListener('mousedown', (e) => {
            isDrawing = true;
            const pos = getGridPosition(e);
            lastX = pos.x;
            lastY = pos.y;
            // console.log('Mouse down at:', pos);
            this.draw(pos.x, pos.y);
        });

        this.mainCanvas.addEventListener('mousemove', (e) => {
            if (!isDrawing) return;
            const pos = getGridPosition(e);
            // console.log('Mouse move at:', pos);
            if (this.currentTool === 'pencil' || this.currentTool === 'eraser') {
                this.drawLine(lastX, lastY, pos.x, pos.y);
            }
            lastX = pos.x;
            lastY = pos.y;
        });

        this.mainCanvas.addEventListener('mouseup', () => {
            if (isDrawing) {
                isDrawing = false;
                // console.log('Mouse up, saving state');
                this.saveState();
            }
        });

        this.mainCanvas.addEventListener('mouseleave', () => {
            isDrawing = false;
        });
    }

    resizeCanvas(newWidth, newHeight) {
        // Store old dimensions for message
        const oldWidth = this.dimensions.width;
        const oldHeight = this.dimensions.height;

        // Update dimensions
        this.dimensions = { width: newWidth, height: newHeight };
        
        // Calculate new pixel size to fit the canvas container
        const containerWidth = this.mainCanvas.parentElement.clientWidth;
        const containerHeight = this.mainCanvas.parentElement.clientHeight;
        
        // Calculate the pixel size that would fit both dimensions
        const horizontalPixelSize = containerWidth / newWidth;
        const verticalPixelSize = containerHeight / newHeight;
        this.pixelSize = Math.min(horizontalPixelSize, verticalPixelSize);

        // Update canvas size
        this.mainCanvas.width = newWidth * this.pixelSize;
        this.mainCanvas.height = newHeight * this.pixelSize;

        // Create new grid with white background
        this.grid = Array(newHeight).fill().map(() => 
            Array(newWidth).fill().map(() => [255, 255, 255])
        );
        
        // Create new colored pixels tracking array
        this.coloredPixels = Array(newHeight).fill().map(() => 
            Array(newWidth).fill(false)
        );

        // Clear history and save new state
        this.history = [];
        this.currentStep = -1;
        this.saveState();
        
        // Redraw the canvas
        this.redraw();

        // Add message about dimension change
        window.app.messages.addSystemMessage(
            `Dimensions changed from (0-${oldWidth-1}) to (0-${newWidth-1}) and (0-${oldHeight-1}) to (0-${newHeight-1})`
        );
    }

    setColor(color) {
        // console.log('Setting color:', color);
        this.currentColor = color;
        // Convert hex to RGB
        const r = parseInt(color.substr(1,2), 16);
        const g = parseInt(color.substr(3,2), 16);
        const b = parseInt(color.substr(5,2), 16);
        this.currentRGB = [r, g, b];
        // console.log('Color set:', {
            // hex: this.currentColor,
            // rgb: this.currentRGB
        // });
    }

    setTool(tool) {
        this.currentTool = tool;
    }

    draw(x, y) {
        if (x < 0 || x >= this.dimensions.width || y < 0 || y >= this.dimensions.height) {
            // console.log('Draw: Invalid coordinates:', x, y);
            return;
        }

        // console.log('Drawing at', x, y, 'with tool:', this.currentTool);
        // console.log('Current RGB:', this.currentRGB);

        // Ensure we have valid RGB values
        if (!this.currentRGB || this.currentRGB.length !== 3) {
            console.error('Invalid RGB values:', this.currentRGB);
            this.setColor('#000000'); // Reset to black if invalid
        }

        const rgb = this.currentTool === 'eraser' ? [255, 255, 255] : this.currentRGB;
        // console.log('Using RGB:', rgb);

        this.setPixel(x, y, rgb);
        this.redraw();
    }

    drawLine(x1, y1, x2, y2) {
        // console.log('Drawing line from', x1, y1, 'to', x2, y2);
        // console.log('Current tool:', this.currentTool);
        // console.log('Current RGB:', this.currentRGB);

        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const sx = x1 < x2 ? 1 : -1;
        const sy = y1 < y2 ? 1 : -1;
        let err = dx - dy;

        while (true) {
            this.draw(x1, y1);
            if (x1 === x2 && y1 === y2) break;
            const e2 = 2 * err;
            if (e2 > -dy) { err -= dy; x1 += sx; }
            if (e2 < dx) { err += dx; y1 += sy; }
        }
    }

    fill(x, y) {
        const targetColor = this.grid[y][x];
        const newColor = this.currentRGB;
        
        if (targetColor.toString() === newColor.toString()) return;
        
        const stack = [[x, y]];
        while (stack.length) {
            const [cx, cy] = stack.pop();
            if (cx < 0 || cx >= this.dimensions.width || cy < 0 || cy >= this.dimensions.height) continue;
            if (this.grid[cy][cx].toString() !== targetColor.toString()) continue;
            
            this.setPixel(cx, cy, newColor);
            
            stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
        }
        this.redraw();
    }

    redraw() {
        // Clear the entire canvas with white background
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.fillRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
        
        // Draw pixels without any additional styling or gaps
        for (let y = 0; y < this.dimensions.height; y++) {
            for (let x = 0; x < this.dimensions.width; x++) {
                const [r, g, b] = this.grid[y][x];
                
                // Only draw if not white
                if (r !== 255 || g !== 255 || b !== 255) {
                    const pixelX = Math.floor(x * this.pixelSize);
                    const pixelY = Math.floor(y * this.pixelSize);
                    
                    this.ctx.fillStyle = `rgb(${r},${g},${b})`;
                    this.ctx.fillRect(
                        pixelX, 
                        pixelY, 
                        Math.ceil(this.pixelSize), 
                        Math.ceil(this.pixelSize)
                    );
                }
            }
        }
    }

    drawCircle(centerX, centerY, radius, color) {
        // console.log(`Drawing circle at (${centerX},${centerY}) with radius ${radius} and color rgb(${color.join(',')})`);
        let pixelsSet = 0;
        let pixelCoords = [];
        
        for (let y = centerY - radius; y <= centerY + radius; y++) {
            for (let x = centerX - radius; x <= centerX + radius; x++) {
                const dx = x - centerX;
                const dy = y - centerY;
                if (dx * dx + dy * dy <= radius * radius) {
                    if (this.setPixel(x, y, color)) {
                        pixelsSet++;
                        pixelCoords.push([x, y]);
                    }
                }
            }
        }
        // console.log(`Circle complete: ${pixelsSet} pixels set at coordinates:`, pixelCoords);
    }

    saveState() {
        this.currentStep++;
        this.history = this.history.slice(0, this.currentStep);
        this.history.push({
            grid: this.grid.map(row => row.map(cell => [...cell])),
            coloredPixels: this.coloredPixels.map(row => [...row])
        });
    }

    undo() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.loadState(this.history[this.currentStep]);
        }
    }

    redo() {
        if (this.currentStep < this.history.length - 1) {
            this.currentStep++;
            this.loadState(this.history[this.currentStep]);
        }
    }

    loadState(state) {
        this.grid = state.grid.map(row => row.map(cell => [...cell]));
        this.coloredPixels = state.coloredPixels.map(row => [...row]);
        this.redraw();
    }

    clear() {
        this.setupGrid();
        this.redraw();
        this.saveState();
    }

    getCanvasState() {
        return {
            dimensions: this.dimensions,
            grid: this.grid,
            coloredPixels: this.coloredPixels
        };
    }

    getCanvasStateCapture() {
        const state = {
            dimensions: this.dimensions,
            pixelSize: this.pixelSize,
            pixels: [],
            imageData: this.mainCanvas.toDataURL('image/png')
        };

        // Store non-white pixels
        for (let y = 0; y < this.dimensions.height; y++) {
            for (let x = 0; x < this.dimensions.width; x++) {
                const [r, g, b] = this.grid[y][x];
                if (r !== 255 || g !== 255 || b !== 255) {
                    state.pixels.push({
                        x,
                        y,
                        color: [r, g, b]
                    });
                }
            }
        }
        
        return state;
    }

    loadStateCapture(state) {
        // Reset canvas
        this.clear();
        
        // Restore dimensions and pixel size
        this.dimensions = state.dimensions;
        this.pixelSize = state.pixelSize;
        
        // Restore pixels
        for (const pixel of state.pixels) {
            this.setPixel(pixel.x, pixel.y, pixel.color);
        }
        
        this.redraw();
    }

    parseCommand(line) {
        if (!line.trim()) return null;

        // Skip non-command lines (don't start with a command keyword)
        if (!line.match(/^(BACKGROUND|BOX_FILL|CIRCLE|LINE|COLOR|TRIANGLE):/)) {
            return null;
        }

        // Try to match each command pattern
        const bgMatch = line.match(/BACKGROUND:\s*\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (line.startsWith('BACKGROUND:')) {
            if (!bgMatch) {
                return {
                    type: 'error',
                    command: 'BACKGROUND',
                    message: 'Invalid format. Use: BACKGROUND: (r,g,b)'
                };
            }
            const [r, g, b] = [parseInt(bgMatch[1]), parseInt(bgMatch[2]), parseInt(bgMatch[3])];
            if (!this.isValidColor([r, g, b])) {
                return {
                    type: 'error',
                    command: 'BACKGROUND',
                    message: 'Invalid color values. Each value must be between 0-255'
                };
            }
            return {
                type: 'background',
                color: { r, g, b }
            };
        }

        const boxMatch = line.match(/BOX_FILL:\s*\((\d+),\s*(\d+)\)\s*\((\d+),\s*(\d+)\)\s*\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (line.startsWith('BOX_FILL:')) {
            if (!boxMatch) {
                return {
                    type: 'error',
                    command: 'BOX_FILL',
                    message: 'Invalid format. Use: BOX_FILL: (x1,y1) (x2,y2) (r,g,b)'
                };
            }
            const [x1, y1, x2, y2, r, g, b] = boxMatch.slice(1).map(n => parseInt(n));
            if (!this.isValidCoordinate(x1, y1) || !this.isValidCoordinate(x2, y2)) {
                return {
                    type: 'error',
                    command: 'BOX_FILL',
                    message: `Invalid coordinates. Must be within canvas bounds (0-${this.dimensions.width-1}, 0-${this.dimensions.height-1})`
                };
            }
            if (!this.isValidColor([r, g, b])) {
                return {
                    type: 'error',
                    command: 'BOX_FILL',
                    message: 'Invalid color values. Each value must be between 0-255'
                };
            }
            return {
                type: 'box_fill',
                start: { x: x1, y: y1 },
                end: { x: x2, y: y2 },
                color: { r, g, b }
            };
        }

        const circleMatch = line.match(/CIRCLE:\s*\((\d+),\s*(\d+)\)\s*(\d+)\s*\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (line.startsWith('CIRCLE:')) {
            if (!circleMatch) {
                return {
                    type: 'error',
                    command: 'CIRCLE',
                    message: 'Invalid format. Use: CIRCLE: (x,y) radius (r,g,b)'
                };
            }
            const [x, y, radius, r, g, b] = circleMatch.slice(1).map(n => parseInt(n));
            if (!this.isValidCoordinate(x, y)) {
                return {
                    type: 'error',
                    command: 'CIRCLE',
                    message: `Invalid center coordinates. Must be within canvas bounds (0-${this.dimensions.width-1}, 0-${this.dimensions.height-1})`
                };
            }
            if (radius <= 0) {
                return {
                    type: 'error',
                    command: 'CIRCLE',
                    message: 'Invalid radius. Must be greater than 0'
                };
            }
            if (!this.isValidColor([r, g, b])) {
                return {
                    type: 'error',
                    command: 'CIRCLE',
                    message: 'Invalid color values. Each value must be between 0-255'
                };
            }
            return {
                type: 'circle',
                center: { x, y },
                radius,
                color: { r, g, b }
            };
        }

        const lineMatch = line.match(/LINE:\s*\((\d+),\s*(\d+)\)\s*\((\d+),\s*(\d+)\)\s*\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (line.startsWith('LINE:')) {
            if (!lineMatch) {
                return {
                    type: 'error',
                    command: 'LINE',
                    message: 'Invalid format. Use: LINE: (x1,y1) (x2,y2) (r,g,b)'
                };
            }
            const [x1, y1, x2, y2, r, g, b] = lineMatch.slice(1).map(n => parseInt(n));
            if (!this.isValidCoordinate(x1, y1) || !this.isValidCoordinate(x2, y2)) {
                return {
                    type: 'error',
                    command: 'LINE',
                    message: `Invalid coordinates. Must be within canvas bounds (0-${this.dimensions.width-1}, 0-${this.dimensions.height-1})`
                };
            }
            if (!this.isValidColor([r, g, b])) {
                return {
                    type: 'error',
                    command: 'LINE',
                    message: 'Invalid color values. Each value must be between 0-255'
                };
            }
            return {
                type: 'line',
                start: { x: x1, y: y1 },
                end: { x: x2, y: y2 },
                color: { r, g, b }
            };
        }

        const colorMatch = line.match(/COLOR:\s*\((\d+),\s*(\d+)\)\s*\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (line.startsWith('COLOR:')) {
            if (!colorMatch) {
                return {
                    type: 'error',
                    command: 'COLOR',
                    message: 'Invalid format. Use: COLOR: (x,y) (r,g,b)'
                };
            }
            const [x, y, r, g, b] = colorMatch.slice(1).map(n => parseInt(n));
            if (!this.isValidCoordinate(x, y)) {
                return {
                    type: 'error',
                    command: 'COLOR',
                    message: `Invalid coordinates. Must be within canvas bounds (0-${this.dimensions.width-1}, 0-${this.dimensions.height-1})`
                };
            }
            if (!this.isValidColor([r, g, b])) {
                return {
                    type: 'error',
                    command: 'COLOR',
                    message: 'Invalid color values. Each value must be between 0-255'
                };
            }
            return {
                type: 'color',
                x: x,
                y: y,
                color: { r, g, b }
            };
        }

        const triangleMatch = line.match(/TRIANGLE:\s*\((\d+),\s*(\d+)\)\s*\((\d+),\s*(\d+)\)\s*\((\d+),\s*(\d+)\)\s*\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (line.startsWith('TRIANGLE:')) {
            if (!triangleMatch) {
                return {
                    type: 'error',
                    command: 'TRIANGLE',
                    message: 'Invalid format. Use: TRIANGLE: (x1,y1) (x2,y2) (x3,y3) (r,g,b)'
                };
            }
            const [x1, y1, x2, y2, x3, y3, r, g, b] = triangleMatch.slice(1).map(n => parseInt(n));
            if (!this.isValidCoordinate(x1, y1) || !this.isValidCoordinate(x2, y2) || !this.isValidCoordinate(x3, y3)) {
                return {
                    type: 'error',
                    command: 'TRIANGLE',
                    message: `Invalid coordinates. Must be within canvas bounds (0-${this.dimensions.width-1}, 0-${this.dimensions.height-1})`
                };
            }
            if (!this.isValidColor([r, g, b])) {
                return {
                    type: 'error',
                    command: 'TRIANGLE',
                    message: 'Invalid color values. Each value must be between 0-255'
                };
            }
            return {
                type: 'triangle',
                vertices: [
                    { x: x1, y: y1 },
                    { x: x2, y: y2 },
                    { x: x3, y: y3 }
                ],
                color: { r, g, b }
            };
        }

        return null;
    }

    processCommands(text) {
        if (!text) return;

        const lines = text.split('\n');
        const errors = [];

        for (const line of lines) {
            if (!line.trim() || line.startsWith('#')) continue;
            
            const command = this.parseCommand(line);
            if (command) {
                if (command.type === 'error') {
                    errors.push(`${command.command} failed: ${command.message}`);
                } else {
                    this.executeCommand(command);
                }
            }
        }
        
        // Save state after processing all commands
        this.saveState();

        // Report any errors
        if (errors.length > 0) {
            window.app.messages.addSystemMessage(
                'Commands failed:\n' + errors.join('\n')
            );
        }
    }

    executeCommand(command) {
        // console.log('Executing command:', command);
        const formatColor = color => `rgb(${color.r}, ${color.g}, ${color.b})`;
        
        switch (command.type) {
            case 'background':
                // console.log(`Setting background color: ${formatColor(command.color)}`);
                let backgroundPixelsSet = 0;
                for (let y = 0; y < this.dimensions.height; y++) {
                    for (let x = 0; x < this.dimensions.width; x++) {
                        // For background, always set the pixel
                        this.setPixel(x, y, [command.color.r, command.color.g, command.color.b]);
                        backgroundPixelsSet++;
                    }
                }
                // console.log(`Background set: ${backgroundPixelsSet} pixels modified`);
                break;

            case 'box_fill':
                // console.log(`BOX_FILL: Drawing box from (${command.start.x},${command.start.y}) to (${command.end.x},${command.end.y}) with color ${formatColor(command.color)}`);
                if (this.isValidCoordinate(command.start.x, command.start.y) && 
                    this.isValidCoordinate(command.end.x, command.end.y) && 
                    this.isValidColor([command.color.r, command.color.g, command.color.b])) {
                    const [startX, endX] = [Math.min(command.start.x, command.end.x), Math.max(command.start.x, command.end.x)];
                    const [startY, endY] = [Math.min(command.start.y, command.end.y), Math.max(command.start.y, command.end.y)];
                    let boxPixelsSet = 0;
                    let boxCoords = [];
                    
                    for (let y = startY; y <= endY; y++) {
                        for (let x = startX; x <= endX; x++) {
                            if (this.setPixel(x, y, [command.color.r, command.color.g, command.color.b])) {
                                boxPixelsSet++;
                                boxCoords.push([x, y]);
                            }
                        }
                    }
                    // console.log(`Box complete: ${boxPixelsSet} pixels set at:`, boxCoords);
                }
                break;

            case 'circle':
                // console.log(`CIRCLE: Drawing circle at (${command.center.x},${command.center.y}) radius ${command.radius} color ${formatColor(command.color)}`);
                if (this.isValidCoordinate(command.center.x, command.center.y) && 
                    command.radius > 0 && 
                    this.isValidColor([command.color.r, command.color.g, command.color.b])) {
                    this.drawCircle(command.center.x, command.center.y, command.radius, [command.color.r, command.color.g, command.color.b]);
                }
                break;

            case 'line':
                // console.log(`LINE: Drawing line from (${command.start.x},${command.start.y}) to (${command.end.x},${command.end.y}) color ${formatColor(command.color)}`);
                if (this.isValidCoordinate(command.start.x, command.start.y) && 
                    this.isValidCoordinate(command.end.x, command.end.y) && 
                    this.isValidColor([command.color.r, command.color.g, command.color.b])) {
                    let x = command.start.x;
                    let y = command.start.y;
                    const dx = Math.abs(command.end.x - command.start.x);
                    const dy = Math.abs(command.end.y - command.start.y);
                    const sx = command.start.x < command.end.x ? 1 : -1;
                    const sy = command.start.y < command.end.y ? 1 : -1;
                    let err = dx - dy;
                    let linePixelsSet = 0;
                    let lineCoords = [];

                    while (true) {
                        if (this.setPixel(x, y, [command.color.r, command.color.g, command.color.b])) {
                            linePixelsSet++;
                            lineCoords.push([x, y]);
                        }
                        if (x === command.end.x && y === command.end.y) break;
                        const e2 = 2 * err;
                        if (e2 > -dy) {
                            err -= dy;
                            x += sx;
                        }
                        if (e2 < dx) {
                            err += dx;
                            y += sy;
                        }
                    }
                    // console.log(`Line complete: ${linePixelsSet} pixels set at:`, lineCoords);
                }
                break;

            case 'color':
                // console.log(`COLOR: Drawing color at (${command.x},${command.y}) with color ${formatColor(command.color)}`);
                if (this.isValidCoordinate(command.x, command.y) && 
                    this.isValidColor([command.color.r, command.color.g, command.color.b])) {
                    this.setPixel(command.x, command.y, [command.color.r, command.color.g, command.color.b]);
                }
                break;

            case 'triangle':
                // console.log(`TRIANGLE: Drawing triangle at (${command.vertices[0].x},${command.vertices[0].y}) (${command.vertices[1].x},${command.vertices[1].y}) (${command.vertices[2].x},${command.vertices[2].y}) with color ${formatColor(command.color)}`);
                if (this.isValidCoordinate(command.vertices[0].x, command.vertices[0].y) && 
                    this.isValidCoordinate(command.vertices[1].x, command.vertices[1].y) && 
                    this.isValidCoordinate(command.vertices[2].x, command.vertices[2].y) && 
                    this.isValidColor([command.color.r, command.color.g, command.color.b])) {
                    this.drawTriangle(command.vertices[0].x, command.vertices[0].y, command.vertices[1].x, command.vertices[1].y, command.vertices[2].x, command.vertices[2].y, [command.color.r, command.color.g, command.color.b]);
                }
                break;
        }
        
        // Force a redraw after each command
        this.redraw();
        
        // Debug: Print current grid state
        let coloredPixels = [];
        for (let y = 0; y < this.dimensions.height; y++) {
            for (let x = 0; x < this.dimensions.width; x++) {
                const [r, g, b] = this.grid[y][x];
                if (r !== 255 || g !== 255 || b !== 255) {
                    coloredPixels.push({x, y, color: [r,g,b]});
                }
            }
        }
        // console.log('Grid state after command:', {
            // command: command.type,
            // totalColoredPixels: coloredPixels.length,
            // samplePixels: coloredPixels.slice(0, 5)
        // });
    }

    drawTriangle(x1, y1, x2, y2, x3, y3, color) {
        // console.log(`Drawing triangle from (${x1},${y1}) to (${x2},${y2}) to (${x3},${y3}) with color rgb(${color.join(',')})`);
        let pixelsSet = 0;
        let pixelCoords = [];
        
        for (let y = Math.min(y1, y2, y3); y <= Math.max(y1, y2, y3); y++) {
            for (let x = Math.min(x1, x2, x3); x <= Math.max(x1, x2, x3); x++) {
                const dx1 = x - x1;
                const dy1 = y - y1;
                const dx2 = x - x2;
                const dy2 = y - y2;
                const dx3 = x - x3;
                const dy3 = y - y3;
                const area = Math.abs((x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)) / 2);
                const area1 = Math.abs((x * (y2 - y3) + x2 * (y3 - y) + x3 * (y - y2)) / 2);
                const area2 = Math.abs((x1 * (y - y3) + x * (y3 - y1) + x3 * (y1 - y)) / 2);
                const area3 = Math.abs((x1 * (y2 - y) + x2 * (y - y1) + x * (y1 - y2)) / 2);
                if (area === area1 + area2 + area3) {
                    if (this.setPixel(x, y, color)) {
                        pixelsSet++;
                        pixelCoords.push([x, y]);
                    }
                }
            }
        }
        // console.log(`Triangle complete: ${pixelsSet} pixels set at coordinates:`, pixelCoords);
    }

    startTrackingChanges() {
        this.userChanges.clear();
        this.isTrackingChanges = true;
    }

    stopTrackingChanges() {
        this.isTrackingChanges = false;
    }

    getUserChanges() {
        // Convert Set to array and sort for consistent output
        return Array.from(this.userChanges).sort((a, b) => {
            if (a.y !== b.y) return a.y - b.y;
            return a.x - b.x;
        });
    }

    isValidCoordinate(x, y) {
        const valid = x >= 0 && x < this.dimensions.width && y >= 0 && y < this.dimensions.height;
        // console.log(`Validating coordinate (${x},${y}): ${valid}`);
        return valid;
    }

    isValidColor(color) {
        const valid = color.length === 3 && color.every(c => c >= 0 && c <= 255);
        // console.log(`Validating color ${color}: ${valid}`);
        return valid;
    }
}

// Export class
window.CanvasManager = CanvasManager;

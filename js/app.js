class App {
    constructor() {
        this.setupElements();
        this.messages = new MessageHandler();
        this.canvas = new CanvasManager();
        this.llm = null;
        this.isGenerating = false;
        this.apiKeyMask = '';

        this.setupEventListeners();
        
        // Set up message handler callbacks
        this.messages.setCallbacks({
            onMessage: (message) => this.renderMessage(message),
            onThinking: (isThinking) => this.updateThinkingState(isThinking),
            onError: (error) => this.handleError(error)
        });

        // Initialize LLM handler with any existing API key
        this.updateApiKey();

        // Add welcome message
        this.messages.addMessage('assistant', 'Welcome to PromptCanvas! What would you like to draw?');
    }

    setupElements() {
        // Chat elements
        this.elements = {
            sendButton: document.getElementById('sendButton'),
            chatInput: document.getElementById('chatInput'),
            chatMessages: document.getElementById('chatMessages'),
            apiKey: document.getElementById('apiKey'),
            model: document.getElementById('model'),
            canvasLoading: document.getElementById('canvas-loading'),
            
            // Tools
            tools: {
                pencil: document.getElementById('pencilTool'),
                eraser: document.getElementById('eraserTool'),
                fill: document.getElementById('fillTool'),
                color: document.getElementById('colorPicker'),
                undo: document.getElementById('undoButton'),
                redo: document.getElementById('redoButton'),
                clear: document.getElementById('clearButton'),
                download: document.getElementById('downloadButton')
            }
        };
    }

    setupEventListeners() {
        // Chat listeners
        this.elements.sendButton.addEventListener('click', () => this.handleUserInput());
        this.elements.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleUserInput();
            }
        });

        // Add this to the existing setupEventListeners method
        this.elements.model.addEventListener('change', () => {
            const customModelContainer = document.getElementById('customModelContainer');
            customModelContainer.style.display = this.elements.model.value === 'other' ? 'block' : 'none';
        });

        // Tool listeners
        Object.entries(this.elements.tools).forEach(([tool, element]) => {
            if (element) {
                if (tool === 'color') {
                    element.addEventListener('input', (e) => this.canvas.setColor(e.target.value));
                } else if (['undo', 'redo', 'clear', 'download'].includes(tool)) {
                    element.addEventListener('click', () => this.handleToolAction(tool));
                } else {
                    element.addEventListener('click', () => this.setActiveTool(tool));
                }
            }
        });

        // API key and model listeners
        this.elements.apiKey.addEventListener('change', () => this.updateApiKey());
        this.elements.apiKey.addEventListener('focus', () => {
            // If masked, clear for input
            if (this.elements.apiKey.value === this.actualApiKey) {
                this.elements.apiKey.type = 'text';
            }
        });

        this.elements.apiKey.addEventListener('blur', () => {
            // Mask the key when focus is lost
            if (this.elements.apiKey.value) {
                this.updateApiKey();
            }
        });

        this.elements.model.addEventListener('change', () => this.updateApiKey());

        // Enable/disable send button based on input
        this.elements.chatInput.addEventListener('input', () => {
            this.elements.sendButton.disabled = !this.elements.chatInput.value.trim() || this.isGenerating;
        });
    }

    async handleUserInput() {
        const userMessage = this.elements.chatInput.value.trim();
        if (!userMessage || this.isGenerating) return;
        if (!this.validateApiKey()) return;

        // Clear input
        this.elements.chatInput.value = '';

        try {
            // Stop tracking changes and get current changes
            this.canvas.stopTrackingChanges();
            const userChanges = this.canvas.getUserChanges();
            
            // Add user message with current canvas state and changes
            await this.messages.addMessage('user', userMessage, { 
                canvasState: {
                    ...this.canvas.getCanvasStateCapture(),
                    userChanges
                }
            });
            
            // Show thinking indicator
            this.isGenerating = true;
            this.messages.setThinking(true);

            // Get AI response
            const response = await this.llm.generateResponse(this.messages.getHistory());

            // Process commands and add AI response
            await this.canvas.processCommands(response);
            
            // Start tracking new changes after AI response
            this.canvas.startTrackingChanges();
            
            const newState = this.canvas.getCanvasStateCapture();
            await this.messages.addMessage('assistant', response, { canvasState: newState });

        } catch (error) {
            console.error('Error handling user input:', error);
            this.messages.handleError(error);
        } finally {
            this.isGenerating = false;
            this.messages.setThinking(false);
        }
    }

    setActiveTool(tool) {
        Object.entries(this.elements.tools).forEach(([name, element]) => {
            if (element && element.classList) {
                element.classList.toggle('active', name === tool);
            }
        });
        this.canvas.setTool(tool);
    }

    handleToolAction(tool) {
        switch (tool) {
            case 'undo':
                this.canvas.undo();
                break;
            case 'redo':
                this.canvas.redo();
                break;
            case 'clear':
                this.canvas.clear();
                break;
            case 'download':
                this.downloadCanvas();
                break;
        }
    }

    downloadCanvas() {
        const link = document.createElement('a');
        link.download = 'llm-painter.png';
        link.href = this.canvas.mainCanvas.toDataURL();
        link.click();
    }

    updateApiKey() {
        const apiKey = this.elements.apiKey.value;
        const model = this.elements.model.value === 'other' 
            ? document.getElementById('customModelInput').value 
            : this.elements.model.value;
        
        if (apiKey) {
            // Change input type to password to mask
            this.elements.apiKey.type = 'password';
            
            // Store the actual key
            this.actualApiKey = apiKey;
            
            this.llm = new LLMAPIHandler(apiKey, model);
        } else {
            this.actualApiKey = '';
            this.llm = null;
        }
    }
    
    validateApiKey() {
        if (!this.actualApiKey) {
            this.messages.handleError(new Error('Please enter your API key'));
            return false;
        }
        return true;
    }

    renderMessage(message) {
        if (!message) return;

        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${message.role}`;
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        // Split content by newlines and create paragraphs
        const lines = message.content.split('\n');
        lines.forEach((line, index) => {
            if (line.trim()) {
                const p = document.createElement('p');
                p.textContent = line;
                content.appendChild(p);
            } else if (index < lines.length - 1) {
                content.appendChild(document.createElement('br'));
            }
        });
        
        const timestamp = document.createElement('div');
        timestamp.className = 'message-time';
        timestamp.textContent = new Date(message.timestamp).toLocaleTimeString();
        
        messageElement.appendChild(content);
        messageElement.appendChild(timestamp);
        
        this.elements.chatMessages.appendChild(messageElement);
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }

    updateThinkingState(isThinking) {
        this.isGenerating = isThinking;
        this.elements.sendButton.disabled = isThinking;
        this.elements.chatInput.disabled = isThinking;
        
        // Show/hide canvas loading overlay
        if (this.elements.canvasLoading) {
            this.elements.canvasLoading.style.display = isThinking ? 'flex' : 'none';
        }
        
        // Disable tools during generation
        Object.values(this.elements.tools).forEach(element => {
            if (element) element.disabled = isThinking;
        });
    }

    handleError(error) {
        console.error('Error:', error);
    }
}

// Initialize app when document is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
